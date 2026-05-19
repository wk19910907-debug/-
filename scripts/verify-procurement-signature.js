#!/usr/bin/env node
/**
 * Verify X-LTS-Signature for PROCUREMENT webhook body (same as api/order-notify.js forward).
 * Usage:
 *   node scripts/verify-procurement-signature.js --secret YOUR_SECRET --body scripts/sample-order-notify.json
 *   type scripts\sample-order-notify.json | node scripts/verify-procurement-signature.js --secret SECRET
 */
const crypto = require("crypto");
const fs = require("fs");

function parseArgs() {
  const a = process.argv.slice(2);
  const out = { secret: "", body: "", header: "" };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--secret") out.secret = a[++i] || "";
    else if (a[i] === "--body") out.body = a[++i] || "";
    else if (a[i] === "--header") out.header = a[++i] || "";
  }
  return out;
}

function sign(secret, raw) {
  return crypto.createHmac("sha256", secret).update(raw, "utf8").digest("hex");
}

function main() {
  const { secret, body: bodyPath, header } = parseArgs();
  if (!secret) {
    console.error("Missing --secret");
    process.exit(1);
  }
  let raw = "";
  if (bodyPath) {
    raw = fs.readFileSync(bodyPath, "utf8");
  } else {
    raw = fs.readFileSync(0, "utf8");
  }
  const envelope = {
    event: "lhasasa.order_notify",
    version: 1,
    sent_at: new Date().toISOString(),
    order: JSON.parse(raw).order || JSON.parse(raw),
  };
  const wire = JSON.stringify(envelope);
  const hex = sign(secret, wire);
  const sigHeader = header || `sha256=${hex}`;
  console.log("wire_length:", wire.length);
  console.log("X-LTS-Signature:", sigHeader);
  if (header) {
    const want = header.startsWith("sha256=") ? header.slice(7) : header;
    const ok =
      want.length === hex.length &&
      crypto.timingSafeEqual(Buffer.from(want, "hex"), Buffer.from(hex, "hex"));
    console.log("verify:", ok ? "OK" : "FAIL");
    process.exit(ok ? 0 : 1);
  }
}

main();
