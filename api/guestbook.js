/**
 * Vercel Serverless（Node）：POST /api/guestbook
 * 环境变量：GUESTBOOK_WEBHOOK_URL（可选）、GUESTBOOK_ALLOWED_ORIGINS（可选，逗号分隔）
 */
module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const allow = process.env.GUESTBOOK_ALLOWED_ORIGINS?.trim();
  const origin = req.headers.origin || "";
  if (allow) {
    const list = allow.split(",").map((s) => s.trim()).filter(Boolean);
    if (origin && list.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }
  }
  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "Expected JSON object" });
  }

  const name = String(body.name || "")
    .trim()
    .slice(0, 80);
  const email = String(body.email || "")
    .trim()
    .slice(0, 120);
  const message = String(body.message || "")
    .trim()
    .slice(0, 2000);

  if (!name || !message) {
    return res.status(400).json({ error: "name and message required" });
  }

  const webhook = process.env.GUESTBOOK_WEBHOOK_URL?.trim();
  let delivered = false;

  if (webhook) {
    try {
      const r = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "lhasa-pet-guestbook",
          name,
          email,
          message,
          at: new Date().toISOString(),
          referer: req.headers.referer || "",
        }),
      });
      delivered = r.ok;
    } catch {
      delivered = false;
    }
  }

  return res.status(200).json({
    ok: true,
    delivered,
    hint: delivered
      ? null
      : "未配置 GUESTBOOK_WEBHOOK_URL 时留言仅返回成功，请配置 Webhook 或人工查看日志。",
  });
};
