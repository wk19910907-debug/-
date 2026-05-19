const crypto = require("crypto");

function sendJson(res, code, data) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    return xff.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "";
}

function getDedupeStore() {
  // Best-effort in-memory store for warm serverless instances.
  // Not a durable DB; still prevents most duplicate refresh bursts.
  if (!globalThis.__lts_order_dedupe_v1) {
    globalThis.__lts_order_dedupe_v1 = new Map();
  }
  return globalThis.__lts_order_dedupe_v1;
}

function nowMs() {
  return Date.now();
}

function parseTtlMs() {
  const raw = process.env.ORDER_NOTIFY_DEDUPE_TTL_SEC || "";
  const n = Number(raw);
  const sec = Number.isFinite(n) && n > 0 ? n : 3600; // default 1h
  return sec * 1000;
}

function dedupeKey(order) {
  const oid = String(order.order_id || "").trim();
  const st = String(order.status || "").trim();
  return `${oid}::${st}`;
}

function isDuplicateAndMark(key) {
  const store = getDedupeStore();
  const ttl = parseTtlMs();
  const t = nowMs();

  // Lazy cleanup (bounded).
  let cleaned = 0;
  for (const [k, exp] of store.entries()) {
    if (exp <= t) {
      store.delete(k);
      cleaned += 1;
      if (cleaned >= 80) break;
    }
  }

  const exp = store.get(key);
  if (exp && exp > t) return true;
  store.set(key, t + ttl);
  return false;
}

function getOrdersStore() {
  // Best-effort in-memory orders store (fallback when Supabase not configured).
  if (!globalThis.__lts_orders_store_v1) {
    globalThis.__lts_orders_store_v1 = new Map();
  }
  return globalThis.__lts_orders_store_v1;
}

function storeOrderInMemory(order) {
  try {
    const store = getOrdersStore();
    const oid = String(order.order_id || "").trim();
    if (!oid) return false;
    const row = {
      order_id: oid,
      status: String(order.status || "created").trim(),
      source: String(order.source || "checkout").trim(),
      name: String(order.name || "").trim(),
      phone: String(order.phone || "").trim(),
      address: String(order.address || "").trim(),
      note: String(order.note || "").trim(),
      total: Number(order.total || 0),
      items: Array.isArray(order.items) ? order.items : [],
      created_at: order.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const prev = store.get(oid);
    if (prev && prev.created_at) row.created_at = prev.created_at;
    store.set(oid, row);
    return true;
  } catch {
    return false;
  }
}

function truncateText(s, maxLen) {
  const t = String(s || "").trim();
  if (!t) return "";
  const n = Number(maxLen) > 0 ? Number(maxLen) : 120;
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
}

/** One-line source trace for Feishu / WeCom (item.supply_snapshot from checkout). */
function formatSupplyLine(it) {
  const s = it && typeof it.supply_snapshot === "object" ? it.supply_snapshot : null;
  if (!s) return "";
  const parts = [];
  if (s.platform) parts.push(`平台:${String(s.platform)}`);
  if (s.seller_name) parts.push(`卖家:${truncateText(s.seller_name, 24)}`);
  if (s.offer_id) parts.push(`offer:${String(s.offer_id)}`);
  if (s.spec_id) parts.push(`spec:${String(s.spec_id)}`);
  if (s.sku_id) parts.push(`sku:${String(s.sku_id)}`);
  const url = String(s.listing_url || (Array.isArray(s.source_urls) ? s.source_urls[0] : "") || "").trim();
  if (url) parts.push(`链:${truncateText(url, 72)}`);
  if (!parts.length && Array.isArray(s.source_urls) && s.source_urls[0])
    parts.push(`链:${truncateText(s.source_urls[0], 72)}`);
  return parts.length ? `  [货源] ${parts.join(" · ")}` : "";
}

function withFeishuSign(payload, secret) {
  const s = String(secret || "").trim();
  if (!s) return payload;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const sign = crypto
    .createHmac("sha256", `${timestamp}\n${s}`)
    .update("")
    .digest("base64");
  return { ...payload, timestamp, sign };
}

async function postJson(url, payload, provider = "generic") {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let txt = "";
  try {
    txt = await r.text();
  } catch {}
  if (!r.ok) return { ok: false, error: `http_${r.status}` };
  if (provider === "feishu") {
    try {
      const j = txt ? JSON.parse(txt) : {};
      if (Number(j.code) === 0) return { ok: true };
      return { ok: false, error: `feishu_code_${j.code || "unknown"}_${j.msg || ""}` };
    } catch {
      return { ok: false, error: "feishu_parse_error" };
    }
  }
  if (provider === "wecom") {
    try {
      const j = txt ? JSON.parse(txt) : {};
      if (Number(j.errcode) === 0) return { ok: true };
      return { ok: false, error: `wecom_errcode_${j.errcode || "unknown"}_${j.errmsg || ""}` };
    } catch {
      return { ok: false, error: "wecom_parse_error" };
    }
  }
  return { ok: true };
}

function buildFeishuCard(order, text) {
  const items = Array.isArray(order.items) ? order.items : [];
  const itemLines = items.slice(0, 12).map((it) => {
    const n = String(it.name || "").trim();
    const q = Number(it.qty || 0);
    const p = Number(it.price || 0);
    const trace = formatSupplyLine(it);
    return `- ${n} x${q}  ¥${(p * q).toFixed(2)}${trace}`;
  });
  const body = [
    `状态：${String(order.status || "created")}`,
    `订单号：${String(order.order_id || "-")}`,
    `收货人：${String(order.name || "-")}`,
    `电话：${String(order.phone || "-")}`,
    `地址：${String(order.address || "-")}`,
    `备注：${String(order.note || "-")}`,
    `合计：¥${Number(order.total || 0).toFixed(2)}`,
    "",
    "商品清单：",
    itemLines.join("\n") || "- (无商品)",
    "",
    "----",
    text,
  ].join("\n");

  return {
    msg_type: "post",
    content: {
      post: {
        zh_cn: {
          title: "宠物馆新订单通知",
          content: [[{ tag: "text", text: body }]],
        },
      },
    },
  };
}

function buildOrderText(order, req) {
  const items = Array.isArray(order.items) ? order.items : [];
  const itemLines = items
    .map((it) => {
      const n = String(it.name || "").trim();
      const q = Number(it.qty || 0);
      const p = Number(it.price || 0);
      const trace = formatSupplyLine(it);
      return `- ${n} x${q} (¥${(p * q).toFixed(2)})${trace}`;
    })
    .join("\n");

  const total = Number(order.total || 0);
  const name = String(order.name || "").trim();
  const phone = String(order.phone || "").trim();
  const address = String(order.address || "").trim();
  const note = String(order.note || "").trim();
  const source = String(order.source || "").trim() || "checkout";
  const status = String(order.status || "").trim() || "created";
  const orderId = String(order.order_id || "").trim() || "-";
  const now = new Date().toISOString();
  const ip = getClientIp(req);

  return [
    "【新订单通知】",
    `时间: ${now}`,
    `订单号: ${orderId}`,
    `状态: ${status}`,
    `来源: ${source}`,
    `收货人: ${name}`,
    `电话: ${phone}`,
    `地址: ${address || "-"}`,
    `备注: ${note || "-"}`,
    `合计: ¥${total.toFixed(2)}`,
    `IP: ${ip || "-"}`,
    "",
    "商品清单:",
    itemLines || "- (无商品)",
  ].join("\n");
}

/** Optional n8n / OpenClaw / 自建采购中枢：接收完整 order（含 items[].supply_snapshot）。 */
async function forwardProcurementWebhook(order, errors) {
  const url = String(process.env.PROCUREMENT_WEBHOOK_URL || "").trim();
  if (!url) return { skipped: true, ok: true };

  const secret = String(process.env.PROCUREMENT_WEBHOOK_SECRET || "").trim();
  const envelope = {
    event: "lhasasa.order_notify",
    version: 1,
    sent_at: new Date().toISOString(),
    order,
  };
  const raw = JSON.stringify(envelope);
  const headers = { "Content-Type": "application/json; charset=utf-8" };
  if (secret) {
    const sig = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    headers["X-LTS-Signature"] = `sha256=${sig}`;
  }
  try {
    const r = await fetch(url, { method: "POST", headers, body: raw });
    if (!r.ok) {
      errors.push(`procurement_webhook_http_${r.status}`);
      return { skipped: false, ok: false };
    }
    return { skipped: false, ok: true };
  } catch (e) {
    errors.push(`procurement_webhook_${String(e && e.message ? e.message : e)}`);
    return { skipped: false, ok: false };
  }
}

async function tryStoreOrder(order) {
  const base = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!base || !key) {
    return storeOrderInMemory(order);
  }
  const url = `${base}/rest/v1/orders?on_conflict=order_id`;
  const payload = {
    order_id: String(order.order_id || "").trim(),
    status: String(order.status || "created").trim(),
    source: String(order.source || "checkout").trim(),
    name: String(order.name || "").trim(),
    phone: String(order.phone || "").trim(),
    address: String(order.address || "").trim(),
    note: String(order.note || "").trim(),
    total: Number(order.total || 0),
    items: Array.isArray(order.items) ? order.items : [],
    updated_at: new Date().toISOString(),
  };
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(payload),
    });
    if (r.ok) {
      storeOrderInMemory(order);
      return true;
    }
    return storeOrderInMemory(order);
  } catch {
    return storeOrderInMemory(order);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
  }

  const body = req.body || {};
  const order = body.order || {};
  const name = String(order.name || "").trim();
  const phone = String(order.phone || "").trim();
  const items = Array.isArray(order.items) ? order.items : [];
  const total = Number(order.total || 0);
  if (!name || !phone || !items.length || total <= 0) {
    return sendJson(res, 400, { ok: false, error: "Invalid order payload" });
  }

  const dk = dedupeKey(order);
  if (dk && dk !== "::" && isDuplicateAndMark(dk)) {
    return sendJson(res, 200, {
      ok: true,
      deduped: true,
      sent: 0,
      procurement: { skipped: true, deduped: true },
    });
  }

  const text = buildOrderText(order, req);
  const feishu = process.env.FEISHU_ORDER_WEBHOOK_URL || "";
  const wecom = process.env.WECOM_ORDER_WEBHOOK_URL || "";
  const procureUrl = String(process.env.PROCUREMENT_WEBHOOK_URL || "").trim();

  if (!feishu && !wecom && !procureUrl) {
    return sendJson(res, 200, { ok: false, warning: "No webhook configured" });
  }

  let sent = 0;
  const stored = await tryStoreOrder(order);
  const errors = [];
  if (feishu) {
    const feishuSecret = process.env.FEISHU_ORDER_BOT_SECRET || process.env.FEISHU_BOT_SECRET || "";
    const signedPayload = withFeishuSign(buildFeishuCard(order, text), feishuSecret);
    const rr = await postJson(feishu, signedPayload, "feishu");
    if (rr.ok) sent += 1;
    else errors.push(rr.error);
  }
  if (wecom) {
    const rr = await postJson(wecom, { msgtype: "text", text: { content: text } }, "wecom");
    if (rr.ok) sent += 1;
    else errors.push(rr.error);
  }

  const procurement = await forwardProcurementWebhook(order, errors);

  return sendJson(res, 200, { ok: true, sent, stored, procurement, errors });
};
