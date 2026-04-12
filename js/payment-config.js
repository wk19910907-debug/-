/**
 * 空中云汇（Airwallex）前端配置 — 与另一站点 `thangka-shop` 的 `/api/airwallex/intent` 对接。
 *
 * 必填：
 * - clientId：Airwallex 控制台 Web App 的 Client ID（可暴露给浏览器）。
 * - intentUrl：已部署的 Next 站点完整地址 + `/api/airwallex/intent`，例如
 *   https://你的-thangka-shop.vercel.app/api/airwallex/intent
 *
 * 在 thangka-shop 的 Vercel 环境变量中设置：
 *   AIRWALLEX_INTENT_ALLOWED_ORIGINS=https://lhasasa-tashidelek.com,https://www.lhasasa-tashidelek.com
 *
 * 服务端仍需：AIRWALLEX_CLIENT_ID、AIRWALLEX_API_KEY、AIRWALLEX_ENV、默认币种 CNY 等（见该仓库 .env.example）。
 */
window.LTS_AIRWALLEX = {
  clientId: "",
  env: "demo",
  intentUrl: "",
  countryCode: "CN",
  currency: "CNY",
};
