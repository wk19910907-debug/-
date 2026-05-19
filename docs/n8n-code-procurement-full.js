// 粘贴到 n8n「Normalize ack」Code 节点（替换默认脚本）。依赖 n8n Code 支持 async/await。
// 可选环境变量（在 n8n Settings → Variables 或进程环境配置）：
//   FEISHU_ORDER_MIRROR_URL — 飞书自定义机器人 Webhook；仅当 order.status === paid_success 时 POST 一条文本镜像。

const root = $input.first().json;
const body = root.body !== undefined ? root.body : root;
const order = body.order || {};

const ack = {
  ok: true,
  received_at: new Date().toISOString(),
  event: body.event,
  version: body.version,
  sent_at: body.sent_at,
  order_id: order.order_id,
  status: order.status,
  source: order.source,
  total: order.total,
  items_count: Array.isArray(order.items) ? order.items.length : 0,
  feishu_mirror: "skipped",
};

const mirrorUrl =
  typeof process !== "undefined" && process.env && process.env.FEISHU_ORDER_MIRROR_URL
    ? String(process.env.FEISHU_ORDER_MIRROR_URL).trim()
    : "";

if (mirrorUrl && String(order.status || "") === "paid_success") {
  try {
    const lines = (Array.isArray(order.items) ? order.items : []).map((it) => {
      const n = String((it && it.name) || "").trim();
      const q = Number((it && it.qty) || 0);
      let trace = "";
      if (it && it.supply_snapshot && typeof it.supply_snapshot === "object") {
        const s = it.supply_snapshot;
        const plat = String(s.platform || "").trim();
        const url0 = String(
          s.listing_url || (Array.isArray(s.source_urls) && s.source_urls[0]) || ""
        ).trim();
        trace = plat ? ` [${plat}${url0 ? " " + url0.slice(0, 48) : ""}]` : "";
      }
      return `- ${n} x${q}${trace}`;
    });
    const text = [
      "【采购镜像·已支付】",
      `订单: ${String(order.order_id || "")}`,
      `收货: ${String(order.name || "")} ${String(order.phone || "")}`,
      `合计: ¥${Number(order.total || 0).toFixed(2)}`,
      "",
      "明细:",
      lines.length ? lines.join("\n") : "- (无行项目)",
    ].join("\n");

    await this.helpers.httpRequest({
      method: "POST",
      url: mirrorUrl,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: { msg_type: "text", content: { text } },
      timeout: 12000,
    });
    ack.feishu_mirror = "sent";
  } catch (e) {
    ack.feishu_mirror = "error:" + String(e && e.message ? e.message : e);
  }
}

return [{ json: ack }];
