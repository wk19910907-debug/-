# n8n 内可选：已支付订单 → 飞书「采购镜像」

与 Vercel 里 **`FEISHU_ORDER_WEBHOOK_URL`**（`order-notify` 直连飞书）**并行、独立**的一条通道：仅在 **n8n** 里配置，用于把「经 PROCUREMENT 转发的订单」再打一份到**另一个**飞书群机器人（例如采购群），便于在 n8n Execution 里留痕后再接多维表 / 议价。

## 条件

- 工作流 Code 已使用 **`docs/n8n-code-procurement-full.js`**（或导入的 JSON 已内嵌同逻辑）。
- 仅当 `order.status === 'paid_success'` 时尝试 POST（与支付成功页回跳后二次 `order-notify` 一致）。

## n8n 环境变量

| 变量 | 说明 |
|------|------|
| `FEISHU_ORDER_MIRROR_URL` | 飞书自定义机器人 Webhook 完整 URL（与 `FEISHU_ORDER_WEBHOOK_URL` 可不同群） |

在 **n8n** 侧配置（Settings → Variables，或 Docker/compose 注入 `environment`），**不要**写进 Git。

## 飞书机器人消息体

使用自定义机器人支持的 **text** 类型：

```json
{ "msg_type": "text", "content": { "text": "多行文本…" } }
```

正文由 Code 拼装，含订单号、收货、合计、行项目；行项目会附带 `supply_snapshot` 的平台与链接前缀（若有）。

## 联调

1. 在飞书再建一个机器人，关键词如「采购镜像」，复制 Webhook。
2. n8n 设置 `FEISHU_ORDER_MIRROR_URL` 为该 Webhook。
3. 用 **`scripts/sample-order-notify-paid-success.json`**（若已提供）或把 `sample-order-notify.json` 里 `status` 改为 `paid_success` 后执行 `test-order-notify.ps1`。
4. 看 n8n Execution 返回 JSON 中 `feishu_mirror`：`sent` / `error:…` / `skipped`。

若你的 n8n 版本 Code 节点**不支持** `await this.helpers.httpRequest`，请删除镜像段，改用 **HTTP Request** 节点 + **IF** 分支（见 `procurement-webhook.md` 中的手工搭建说明）。
