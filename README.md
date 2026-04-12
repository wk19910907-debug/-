# lhasasa-tashidelek.com

静态官网源码，部署于 [Vercel](https://vercel.com)。根目录 `index.html` 可直接构建。

## Vercel 控制台（推荐）

Import 本仓库 → Framework **Other** → Output Directory **`.`** → 在 **Domains** 绑定 `lhasasa-tashidelek.com`，再按提示在阿里云 DNS 添加记录。

## GitHub Actions（可选）

在仓库 **Settings → Secrets and variables → Actions** 添加 `VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID` 后，到 **Actions** 手动运行 **Vercel Production**（`workflow_dispatch`）。令牌与 ID 见 [Vercel 账号 Token](https://vercel.com/account/tokens) 与项目 **Settings → General**。若已在 Vercel 里连接本 GitHub 仓库，通常不必使用该 workflow。
