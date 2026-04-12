# lhasasa-tashidelek.com

**宠物用品电商**（`/shop/`）：`data/products.json` 商品、购物车 `localStorage`、结算页可跳转 **空中云汇 Airwallex** 托管收银台。部署于 [Vercel](https://vercel.com)。

### 空中云汇对接（与本地 `CascadeProjects/thangka-shop` 一致）

1. 将 **thangka-shop** 部署到公网，在 Vercel 环境变量中配置 `AIRWALLEX_CLIENT_ID`、`AIRWALLEX_API_KEY`、`AIRWALLEX_ENV`，并将 **`AIRWALLEX_INTENT_ALLOWED_ORIGINS`** 设为：  
   `https://lhasasa-tashidelek.com,https://www.lhasasa-tashidelek.com`  
2. 在本仓库编辑 **`js/payment-config.js`**：填入 `clientId`（Web App Client ID）、`intentUrl`（例如 `https://你的-thangka.vercel.app/api/airwallex/intent`）、`env`（`demo`/`prod`）、`currency`（默认 `CNY`）。金额按「元 ×100」以分为单位发往 Intent API。  
3. 重新部署本站点。支付成功后跳转到 `/shop/payment-success.html` 并清空购物车。

## Vercel 控制台（推荐）

Import 本仓库 → Framework **Other** → Output Directory **`.`** → 在 **Domains** 绑定 `lhasasa-tashidelek.com`，再按提示在阿里云 DNS 添加记录。

## GitHub Actions（可选）

在仓库 **Settings → Secrets and variables → Actions** 添加 `VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID` 后，到 **Actions** 手动运行 **Vercel Production**（`workflow_dispatch`）。令牌与 ID 见 [Vercel 账号 Token](https://vercel.com/account/tokens) 与项目 **Settings → General**。若已在 Vercel 里连接本 GitHub 仓库，通常不必使用该 workflow。
