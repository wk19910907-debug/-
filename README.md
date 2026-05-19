# lhasasa-tashidelek.com

**宠物用品电商**（`/shop/`）：`data/products.json` 商品、购物车 `localStorage`、结算页可跳转 **空中云汇 Airwallex** 托管收银台。部署于 [Vercel](https://vercel.com)。

### 空中云汇对接（与本地 `CascadeProjects/thangka-shop` 一致）

1. 将 **thangka-shop** 部署到公网，在 Vercel 环境变量中配置 `AIRWALLEX_CLIENT_ID`、`AIRWALLEX_API_KEY`、`AIRWALLEX_ENV`，并将 **`AIRWALLEX_INTENT_ALLOWED_ORIGINS`** 设为：  
   `https://lhasasa-tashidelek.com,https://www.lhasasa-tashidelek.com`  
2. 在本仓库编辑 **`js/payment-config.js`**：填入 `clientId`（Web App Client ID）、`intentUrl`（例如 `https://你的-thangka.vercel.app/api/airwallex/intent`）、`env`（`demo`/`prod`）、`currency`（默认 `CNY`）。金额按「元 ×100」以分为单位发往 Intent API。  
3. 重新部署本站点。支付成功后跳转到 `/shop/payment-success.html` 并清空购物车；取消/失败可跳转 `/shop/payment-fail.html`（若空中云汇 SDK 接受 `failUrl`）。

## 留言系统

- 页面：`/guestbook.html`；精选展示读 `data/guestbook.json`（人工审核后合并进仓库）。
- 提交：`POST /api/guestbook`（Vercel Serverless，见 `api/guestbook.js`）。在 Vercel 配置 **`GUESTBOOK_WEBHOOK_URL`** 转发到 Discord/Slack/自建服务接收 JSON。
- 环境变量示例见 **`vercel-env.example.txt`**。

## 下单通知（飞书/企业微信）

已内置接口：`POST /api/order-notify`（文件：`api/order-notify.js`）

用途：
- 用户在 `shop/checkout.html` 提交订单后，自动推送订单信息到群机器人。
- 不影响支付流程：通知失败不会阻断结算。

配置环境变量（Vercel）：
- `FEISHU_ORDER_WEBHOOK_URL`：飞书机器人 Webhook（可选）
- `WECOM_ORDER_WEBHOOK_URL`：企业微信机器人 Webhook（可选）
- `PROCUREMENT_WEBHOOK_URL`：采购/编排中枢 URL（可选，如 n8n、自建 Node、OpenClaw 网关 HTTP 入口）
- `PROCUREMENT_WEBHOOK_SECRET`：选填；若设置，请求体会带签名头 `X-LTS-Signature: sha256=<hex>`（对 **原始 JSON 字符串** 做 HMAC-SHA256）

说明：
- 飞书、企微、采购 Webhook **至少配置其一**，否则接口返回 `No webhook configured`。
- 支付链路通知分三段：
  - 结算提交时发送 `status=pending_payment`（预下单）
  - 支付成功页回跳后发送 `status=paid_success`（支付确认）
  - 支付失败/取消页回跳后发送 `status=payment_failed`（失败通知）
- 飞书默认使用卡片消息（更易读）；企业微信保持文本消息。
- **货源追溯**：结账请求里每个 `item` 可含 `supply_snapshot`（由 `js/shop.js` 从 `data/products.json` 的 `supply` 或 `product_url` 推断）。`order-notify` 会在商品清单下附带 `[货源] …` 一行摘要，便于后台对接采购/议价流程。详见 `skills/lhasa-pet-curation/SKILL.md` 的 `supply` 字段约定。
- **采购 Webhook**：若配置了 `PROCUREMENT_WEBHOOK_URL`，在订单校验与落库之后，会向该 URL `POST` 如下 JSON（便于 n8n 分支：写飞书多维表、排队人工议价、将来接 1688 API 等）：

```json
{
  "event": "lhasasa.order_notify",
  "version": 1,
  "sent_at": "2026-05-19T12:00:00.000Z",
  "order": {
    "order_id": "...",
    "status": "created",
    "name": "...",
    "phone": "...",
    "address": "...",
    "items": [{ "id": "...", "name": "...", "qty": 1, "price": 89, "supply_snapshot": { } }]
  }
}
```

- 可同时配置飞书 + 企微，系统会双发；采购 Webhook 失败**不会**阻断飞书/企微（错误会出现在接口 JSON 的 `errors` 数组中）。
- **验签、n8n 对接、本地联调**：见 **`docs/procurement-webhook.md`**；一键 POST 示例体：`scripts/test-order-notify.ps1`（需 `vercel dev` 或填 `-BaseUrl` 指向已部署站点）。**n8n 导入**：`docs/n8n-lhasasa-procurement.workflow.json`。**已支付联调 / n8n 飞书镜像**：`scripts/sample-order-notify-paid-success.json` + **`docs/n8n-feishu-mirror.md`**。
- 前端内置去重：同一 `order_id + status` 仅发送一次，避免用户刷新页面导致重复通知。
- 服务端也做“最佳努力去重”：同一 `order_id + status` 在一段时间窗口内只发送一次（默认 1 小时，可用环境变量 `ORDER_NOTIFY_DEDUPE_TTL_SEC` 调整）。  
  注：这是 Serverless 内存级去重，非数据库级强一致，但能显著减少重复推送。

## 订单落库 + 后台列表（Supabase，可选）

如果你需要“销售系统/订单系统”，推荐使用 Supabase（免费额度足够起步）：

1) 在 Supabase 新建表 `orders`（SQL）：

```sql
create table if not exists public.orders (
  order_id text primary key,
  status text,
  source text,
  name text,
  phone text,
  address text,
  note text,
  total numeric,
  items jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

2) 在 Vercel 环境变量配置：
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`（仅服务端使用）
- `ORDERS_ADMIN_TOKEN`（后台查看订单用的口令，自己生成一段随机字符串）

3) 下单后会自动落库（通过 `api/order-notify.js` 内置的 best-effort upsert）。

4) 打开后台页查看订单：
- `/admin/orders.html`

注意：
- 后台页会提示你输入 `ORDERS_ADMIN_TOKEN`，它只保存在浏览器本地 `localStorage`。

留言通知补充：
- 可选环境变量 `GUESTBOOK_FEISHU_TITLE`，用于自定义飞书消息标题前缀（默认：`LA网站留言告警`）。
- 可选环境变量 `GUESTBOOK_FEISHU_MENTION_ALL=true`，开启后留言消息会 `@所有人`。
- 可选环境变量 `GUESTBOOK_FEISHU_MENTION_OPEN_IDS`，逗号分隔多个飞书成员 `open_id`，用于 `@指定成员`。

## OpenClaw / Cursor 选品技能

- 仓库内 **`skills/lhasa-pet-curation/SKILL.md`**：选品与维护 `products.json` 的流程说明；可复制到 OpenClaw 工作区 `skills/`。
- Cursor 项目内副本：**`.cursor/skills/lhasa-pet-curation/SKILL.md`**。

## 商品图价自动更新（Apify）

可用脚本：`scripts/import_products_from_apify.py`

用途：
- 读取 `data/products.json` 里的 `product_url`
- 调用 Apify Actor 抓取商品信息
- 回写 `image_url`、`price`、`price_cny` 等字段

使用步骤（PowerShell）：

1. 配置环境变量：
   - `$env:APIFY_TOKEN="你的 token"`
   - `$env:APIFY_ACTOR_ID="pizani/taobao-product-scraper"`（可不填，默认这个）
2. 运行导入：
   - `python scripts/import_products_from_apify.py`
3. 发布到生产：
   - `vercel --prod --yes`

说明：
- 脚本会按 `product_url` 合并，尽量保留现有分类和 `badge`。
- 不同 Actor 返回字段不完全一致，脚本做了常见字段兼容。
- 如果 Actor 返回 403（订阅/权限限制），可改用已跑好的 Dataset：
  - `$env:APIFY_DATASET_ID="你的 dataset id"`
  - `python scripts/import_products_from_apify.py`

## Python RPA（淘宝自动选品）

脚本：
- `scripts/taobao_rpa_pipeline.py`
- `scripts/run_taobao_rpa.ps1`

安装依赖：

```powershell
pip install -r .\scripts\requirements-rpa.txt
python -m playwright install chromium
```

运行（推荐）：

```powershell
.\scripts\run_taobao_rpa.ps1 -Keyword "宠物饮水机" -Pages 3
```

先手动登录再采集（推荐，降低验证码拦截）：

```powershell
python .\scripts\prepare_taobao_login.py --storage-state ".\outputs\taobao_storage_state.json"
.\scripts\run_taobao_rpa.ps1 -Keyword "宠物饮水机" -Pages 3 -TopN 50 -StorageState ".\outputs\taobao_storage_state.json"
```

或手动运行：

```powershell
python .\scripts\taobao_rpa_pipeline.py --keyword "宠物饮水机" --pages 3
```

输出：
- `outputs/taobao_raw.csv`（去重后全量）
- `outputs/taobao_top20.csv`（按评分排序的 Top20）

说明：
- 首次运行会打开浏览器，若出现登录/验证码，请手动完成后回到终端按回车继续。
- 评分模型为实战初版：需求 + 竞争 + 利润 + 风险，可按业务再调权重。

## Shopify 同类站点热卖采集

脚本：
- `scripts/shopify_best_sellers_research.py`
- `scripts/run_shopify_research.ps1`

用途：
- 自动搜索 Shopify 同类站点（可叠加你指定的店铺域名）
- 抓取各站点 `best-selling` 列表
- 汇总出“热卖代理分”最高商品清单（按榜单排名计算，不是官方销量）

运行示例：

```powershell
.\scripts\run_shopify_research.ps1 -Keyword "pet supplies" -SeedDomains "example-store.myshopify.com,another-store.com" -MaxSites 12 -PerStoreTop 20 -TopN 100
```

输出：
- `outputs/shopify_top_products.csv`
- `outputs/shopify_store_report.csv`

### 一键：采集 -> 生成商城数据 -> 发布

```powershell
.\scripts\run_rpa_to_site.ps1 -Keyword "宠物饮水机" -Pages 3
```

该命令会自动完成：
1. 采集并输出 `outputs/taobao_top20.csv`
2. 转换为 `data/products.json`
3. 自动巡检并修复不可访问图片链接
4. 自动执行 `vercel --prod --yes` 发布

转换脚本增强项：
- 自动类目映射（主粮/饮水/出行/玩具/清洁美容/医疗保健/智能用品）
- 自动 `badge`（热销/推荐/高端/潜力）
- 自动价格分层 `price_tier`（入门/中档/进阶/高端）

### 一键：多关键词批量 -> 总榜 -> 发布

```powershell
.\scripts\run_rpa_batch_to_site.ps1 -Keywords "宠物饮水机,猫砂盆,猫粮" -Pages 2 -TopN 50 -MinPerKeyword 8 -PerKeywordTopN 20
```

说明：
- `--Keywords` 用英文逗号分隔多个关键词。
- 可配合 `-StorageState ".\outputs\taobao_storage_state.json"` 复用手动登录态，减少重复扫码。
- 会产出 `outputs/taobao_top_batch.csv`，再转换到 `data/products.json` 并发布。
- `--MinPerKeyword` 可设置“每个关键词保底入榜条数”，避免单关键词挤占总榜。
- `--PerKeywordTopN` 会额外导出每个关键词的榜单文件到 `outputs/by_keyword/`。
- `-AutoRefill` 当总榜条数小于 `TopN` 时自动补抓（加页重跑）。
- `-MaxExtraRounds` 自动补抓最大轮数（默认 2）。
- `-PagesStep` 每轮补抓增加页数（默认 +1 页）。
- 若自动补抓结束后仍不足 `TopN`，脚本会输出“下一轮调参建议”（如降低 `MinMargin`、增加 `Pages`、扩关键词）并尝试基于 `run_report.csv` 给出低留存关键词诊断。
- `--BlockTerms` 黑名单过滤（默认已过滤二手/维修/配件等无效词）。
- `--AllowTerms` 白名单保留（命中白名单词可覆盖黑名单拦截）。
- `--BrandBlockTerms` 品牌黑名单（标题命中即过滤）。
- `--MinPrice / --MaxPrice` 价格区间过滤（0 表示不设上限）。
- `--MinMargin` 利润率硬阈值（默认 30%，低于阈值直接剔除）。
- 已内置“反人机友好模式”：检测到验证码/人机页面会自动暂停，等待你手动通过后回车继续。
- 可调慢速参数：
  - `-PageDelayMinMs / -PageDelayMaxMs`：每页随机停顿
  - `-KeywordCooldownMs`：关键词之间冷却时间
  - `-KeywordRetries`：单关键词无数据时自动重试次数（默认 2）
  - `-ResumeMode`：断点续跑模式（`resume`=继续未完成关键词，`reset`=从头重跑）
- 运行后会输出 `outputs/run_report.csv`，按关键词统计每层过滤后的留存与入榜率。
- `run_report.csv` 已含 `rag_status`（RED/YELLOW/GREEN）与 `next_action` 建议，可直接当看板使用。
- 批量发布链路已包含图片巡检脚本 `scripts/repair_product_images.py`，避免线上出现空图/失效图。
- 批量发布结束会自动生成 `outputs/run_summary.txt`，可直接复制到飞书汇报。
- 若设置环境变量 `FEISHU_WEBHOOK_URL`，批量流程会自动调用
  `scripts/send_summary_to_feishu.py` 推送摘要到飞书群；
  未设置时会自动跳过，不影响发布。
- 新增发布闸门 `-DeployPolicy`：
  - `green_only`（默认）：仅 `__TOTAL__` 为 GREEN 才发布
  - `yellow_or_green`：YELLOW/GREEN 都发布
  - `always`：总是发布

示例（充电品类过滤）：

```powershell
.\scripts\run_rpa_batch_to_site.ps1 `
  -Keywords "充电桩,充电模块,EV charger" `
  -Pages 2 -TopN 50 -MinPerKeyword 8 -PerKeywordTopN 20 `
  -AllowTerms "直流快充,液冷,模块,桩,charger" `
  -BlockTerms "二手,维修,安装服务,租赁,代发,教程" `
  -BrandBlockTerms "特斯拉,小鹏,蔚来" `
  -MinPrice 300 -MaxPrice 30000 `
  -MinMargin 0.30 `
  -DeployPolicy green_only `
  -PageDelayMinMs 3200 -PageDelayMaxMs 6200 `
  -KeywordCooldownMs 3000 `
  -KeywordRetries 3 `
  -ResumeMode resume
```

断点文件：
- `outputs/resume_state.json`（自动维护）
- 如需清空断点，可用 `-ResumeMode reset` 重跑全部关键词。

### 双赛道同轮运行（高客单 + 快消）

```powershell
.\scripts\run_dual_tracks.ps1
```

说明：
- 顺序执行两套参数：高客单赛道 + 快消赛道。
- 每个赛道执行后会将当前 `outputs/` 快照到独立目录：
  - `outputs_high/`
  - `outputs_fast/`
- 若只做数据不想触发发布，可传：

```powershell
.\scripts\run_dual_tracks.ps1 -SkipDeploy
```

## 电商图片与参数处理（开源最小版）

脚本：
- `scripts/unify_product_images.py`：风格统一（白底、尺寸统一、轻增强）
- `scripts/delegate_images_to_stitch.py`：导出 Stitch 修图委派工单（JSONL/CSV，并可入队 dashboard）
- `scripts/extract_specs.py`：从标题/副标题提取规格参数
- `scripts/replace_cn_text_to_en.py`：基础中->英文案映射
- `scripts/run_ecom_image_pipeline.ps1`：一键串联执行

安装依赖：

```powershell
pip install pillow requests
```

运行：

```powershell
.\scripts\run_ecom_image_pipeline.ps1
```

改为 Stitch 委派模式：

```powershell
.\scripts\run_ecom_image_pipeline.ps1 -ImageProvider stitch
```

说明：
- `local`（默认）：本地 Pillow 自动修图，直接生成 `outputs/processed_images/*.jpg`。
- `stitch`：生成委派工单，不直接在本地修图：
  - `outputs/stitch_jobs.jsonl`
  - `outputs/stitch_jobs.csv`
  - 同步写入 `outputs/edit_requests.csv`（状态 `pending`），可在 dashboard 里继续回写 `done/rejected`。
- 当前接入方式是“Stitch 工单委派流”，用于将任务统一交接到 Stitch 侧执行，再回传结果路径。

Stitch 结果回填（可选）：

```powershell
.\scripts\run_ecom_image_pipeline.ps1 -ImageProvider stitch -StitchResultsCsv ".\outputs\stitch_jobs.csv" -RequireDone
```

说明：
- 新增脚本 `scripts/import_stitch_results.py`，按 `product_id` 将结果路径回写到 `data/products.json` 的 `processed_image_path`。
- `delegate_images_to_stitch.py` 会写出 `product_index`，回填时优先按 `product_index` 精确定位（避免重复 `id` 串写）。
- 结果 CSV 支持以下任一列作为输出路径：`result_image_path` / `result_path` / `processed_image_path` / `output_path` / `target_output_path`。
- 传 `-RequireDone` 时，仅导入 `status=done` 的行。

输出：
- `outputs/processed_images/*.jpg`
- `outputs/products_enriched.json`

## 排版规范（2026-04）

- **统一标题比例**：模块主标题统一使用 `--title-clamp` 与 `--title-kern`，避免页面间字阶漂移。
- **统一正文节奏**：导语/说明文本统一使用 `--body-size` 与 `--body-line`。
- **统一卡片体系**：卡片容器统一复用 `--card-pad`、`--card-border`、`--card-bg`（首页精选、商品卡、结算卡、留言卡）。
- **统一容器宽度**：内容宽度遵循 `--module-max` 与 `--module-read`，首选在 CSS 变量层改，不在 HTML 内联宽度。
- **统一区块留白**：主区块纵向间距遵循 `--pad-section-y` / `--pad-strip-y` / `--module-block-gap`。

## Vercel 控制台（推荐）

Import 本仓库 → Framework **Other** → Output Directory **`.`** → 在 **Domains** 绑定 `lhasasa-tashidelek.com`，再按提示在阿里云 DNS 添加记录。

## GitHub Actions（可选）

在仓库 **Settings → Secrets and variables → Actions** 添加 `VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID` 后，到 **Actions** 手动运行 **Vercel Production**（`workflow_dispatch`）。令牌与 ID 见 [Vercel 账号 Token](https://vercel.com/account/tokens) 与项目 **Settings → General**。若已在 Vercel 里连接本 GitHub 仓库，通常不必使用该 workflow。
