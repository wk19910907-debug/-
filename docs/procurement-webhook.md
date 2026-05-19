# 采购 / 编排 Webhook（`PROCUREMENT_WEBHOOK_URL`）

独立站 `POST /api/order-notify` 在校验订单、去重、落库（内存或 Supabase）之后，若配置了 **`PROCUREMENT_WEBHOOK_URL`**，会向该地址再发送 **一份结构化 JSON**，便于 n8n、自建 Node、云函数等做：

- 写入飞书多维表 / 数据库
- 生成「待议价」队列（人工 + LLM 草稿）
- 将来对接 1688 等开放平台（建议在下游做二次签名校验与人工/规则审批）

## 环境变量（Vercel）

| 变量 | 必填 | 说明 |
|------|------|------|
| `PROCUREMENT_WEBHOOK_URL` | 否 | HTTPS 接收端；与飞书/企微至少配其一，`order-notify` 才会处理订单 |
| `PROCUREMENT_WEBHOOK_SECRET` | 否 | 若设置，会对 **原始 HTTP body 字符串** 计算 HMAC-SHA256，并设置请求头：`X-LTS-Signature: sha256=<小写 hex>` |

## HTTP 请求

- **Method**：`POST`
- **Content-Type**：`application/json; charset=utf-8`
- **Body**（固定 envelope）：

```json
{
  "event": "lhasasa.order_notify",
  "version": 1,
  "sent_at": "2026-05-19T12:00:00.000Z",
  "order": {
    "order_id": "pet-1730000000-abc12",
    "status": "paid_success",
    "source": "payment_success_page",
    "name": "张三",
    "phone": "13800138000",
    "address": "上海市…",
    "note": "",
    "total": 178,
    "items": [
      {
        "id": "pet-01-xxxx",
        "name": "示例商品",
        "qty": 2,
        "price": 89,
        "supply_snapshot": {
          "platform": "京东",
          "listing_url": "https://item.jd.com/…",
          "source_urls": ["https://item.jd.com/…"],
          "mapped_at": "2026-05-19T09:45:01Z",
          "provenance": "inferred_from_selection_row",
          "sealed_at": "2026-05-19T12:00:01.234Z"
        }
      }
    ]
  }
}
```

**注意**：`order` 与前端结账 POST 的 `body.order` 一致；`items[].supply_snapshot` 在结算时由 `js/checkout-page.js` 写入（货源来自 `data/products.json` 的 `supply` 或推断字段）。

## n8n 导入模板（可选）

- 文件：**`docs/n8n-lhasasa-procurement.workflow.json`**
- n8n：**Import from File** → 打开该 JSON → **Activate** → 复制 Webhook 的 **Production URL** 填到 Vercel `PROCUREMENT_WEBHOOK_URL`。
- 模板流程：`Procurement POST`（Webhook，`responseMode: responseNode`）→ `Normalize ack`（Code，兼容 `body` 在根或 `json.body`；可选 **`FEISHU_ORDER_MIRROR_URL`** 在 `paid_success` 时向飞书再发一条文本镜像）→ `Respond 200`（返回 JSON ack，响应体里含 `feishu_mirror`：`sent` / `skipped` / `error:…`）。
- 飞书镜像说明：**`docs/n8n-feishu-mirror.md`**；脚本源码（可单独粘贴更新）：**`docs/n8n-code-procurement-full.js`**。
- 若你的 n8n 版本导入报错，可手动建三节点，并把 Code 节点脚本从 JSON 里复制出来。
- OpenClaw 工作区说明（与独立站仓库配合）：`~/.openclaw/workspace/docs/lhasasa-procurement-n8n.md`

## 验签（接收端）

1. 读取 **原始 body 字节/字符串**（勿用「先 parse JSON 再 stringify」作为验签字段，除非你能保证与发送方 **逐字节一致**；最稳妥是读 raw body）。
2. 若配置了 `PROCUREMENT_WEBHOOK_SECRET`，计算：

   `expected = HMAC_SHA256(secret, rawBodyHexAsUtf8)` → 小写 hex  
   与请求头 `X-LTS-Signature` 去掉前缀 `sha256=` 后比较（常量时间比较更佳）。

3. 验签通过后再 `JSON.parse(rawBody)`。

### n8n 示例（Function 或 Code 节点）

n8n Webhook 若开启「Raw Body」或从 `Binary` 取原始数据更稳；若只有已解析的 JSON，可与发送方约定「对 `JSON.stringify(envelope)` 无空格」一致后再算 HMAC（当前服务端使用 `JSON.stringify(envelope)` 默认格式）。

与 **Vercel 本实现** 对齐的验签方式（Node）：

```javascript
const crypto = require("crypto");

function verifyLtsSignature(rawBodyString, headerValue, secret) {
  if (!secret) return true;
  const prefix = "sha256=";
  const sig = String(headerValue || "").trim();
  if (!sig.startsWith(prefix)) return false;
  const want = sig.slice(prefix.length);
  const h = crypto.createHmac("sha256", secret).update(rawBodyString, "utf8").digest("hex");
  return want.length === h.length && crypto.timingSafeEqual(Buffer.from(want, "hex"), Buffer.from(h, "hex"));
}
```

将 `rawBodyString` 设为与发送方完全相同的字符串（Vercel 侧为 `JSON.stringify(envelope)`）。

## 接口响应（`/api/order-notify`）

成功时 JSON 中会多一项：

```json
"procurement": { "skipped": false, "ok": true }
```

未配置采购 URL 时：

```json
"procurement": { "skipped": true, "ok": true }
```

失败时 `ok: false`，且 `errors` 数组中会有 `procurement_webhook_*` 条目；**飞书/企微仍会尽量发送**（与采购失败独立）。

## 本地联调

见仓库 `scripts/test-order-notify.ps1` 与 `scripts/sample-order-notify.json`。需本地 `vercel dev` 或已部署的站点 URL。

### 快速命令（Windows）

1. 终端 A：在站点仓库根目录执行 `vercel dev`（端口以终端提示为准，常见为 `3000`）。
2. 终端 B：

```powershell
cd $env:USERPROFILE\lhasasa-tashidelek-web
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-order-notify.ps1 -BaseUrl "http://localhost:3000"
```

3. 若返回里含 `deduped: true`，说明同一 `order_id` + `status` 在服务端去重窗口内重复提交；请改 `sample-order-notify.json` 里的 `order_id` 再试。

4. 仅测 **采购转发**：在 Vercel 环境变量配置 `PROCUREMENT_WEBHOOK_URL`（可用 [webhook.site](https://webhook.site) 临时 URL）及可选 `PROCUREMENT_WEBHOOK_SECRET`；本地 `vercel dev` 会读取项目根 `.env.local`（勿提交密钥到 Git）。

### 生成与站点一致的 `X-LTS-Signature`（调试用）

与发送方相同：对 **整段 POST body 字符串**（与 `sample-order-notify.json` 磁盘内容一致，注意换行与空格）做 HMAC-SHA256。PowerShell 示例：

```powershell
$secret = "your-shared-secret"
$raw = [IO.File]::ReadAllText("$PWD\scripts\sample-order-notify.json")
$h = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($secret))
$hex = [BitConverter]::ToString($h.ComputeHash([Text.Encoding]::UTF8.GetBytes($raw))).Replace("-","").ToLowerInvariant()
Write-Host "X-LTS-Signature: sha256=$hex"
```

**注意**：若你对 JSON 做了「美化/重排」，签名会变；与 Vercel 发出的 `JSON.stringify(envelope)` 必须逐字节策略一致时，接收端才可用 parse 后再 stringify 对齐（脆弱）；生产环境接收端优先用 **raw body**。

### 本地生成签名（对照 Vercel）

```powershell
cd $env:USERPROFILE\lhasasa-tashidelek-web
node scripts\verify-procurement-signature.js --secret "你的密钥" --body scripts\sample-order-notify.json
```

输出 `X-LTS-Signature: sha256=...` 可与自建接收端或 n8n 验签逻辑对照。

## OpenClaw 采购队列（议价草稿）

订单 JSON 入队 + 自动生成 Markdown 议价草稿（**不自动下单**）：见  
`~/.openclaw/workspace/docs/procurement-openclaw-handler.md`  
脚本：`~/.openclaw/scripts/procurement-enqueue-order.ps1`、`workspace/scripts/procurement_build_rfq.py`。
