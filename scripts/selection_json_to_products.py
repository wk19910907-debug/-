"""Import OpenClaw/Desktop selection.json rows into data/products.json."""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def iso_utc_z() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


def build_supply(
    row: dict[str, Any],
    listing_url: str,
    platform: str,
    source_urls: list[str],
) -> dict[str, Any] | None:
    """Optional multi-platform source trace for procurement / RFQ (see README)."""
    custom = row.get("supply")
    if isinstance(custom, dict) and custom:
        out = dict(custom)
        if listing_url and not str(out.get("listing_url") or "").strip():
            out["listing_url"] = listing_url
        if platform and not str(out.get("platform") or "").strip():
            out["platform"] = platform
        if not str(out.get("mapped_at") or "").strip():
            out["mapped_at"] = iso_utc_z()
        return out
    if not listing_url and not source_urls:
        return None
    return {
        "platform": platform or "",
        "listing_url": listing_url or "",
        "source_urls": list(source_urls),
        "mapped_at": iso_utc_z(),
        "provenance": "inferred_from_selection_row",
    }


def to_slug(text: str, idx: int) -> str:
    """Stable ascii id: pet-01-xxxx (never collapse Chinese titles to pet-item)."""
    import hashlib

    raw = (text or "item").encode("utf-8")
    digest = hashlib.md5(raw).hexdigest()[:8]
    return "pet-%02d-%s" % (idx, digest)


def load_rows(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and isinstance(data.get("rows"), list):
        return data["rows"]
    raise ValueError("selection.json must be list or {rows: [...]}")


def pick_badge(score: float) -> str | None:
    if score >= 85:
        return "热销"
    if score >= 80:
        return "推荐"
    return None


def row_to_product(row: dict[str, Any], idx: int) -> dict[str, Any]:
    name = str(row.get("product_name") or f"宠物商品-{idx}").strip()
    price = float(row.get("price_cny") or row.get("price") or 0)
    category = str(row.get("category") or "宠物用品").strip()
    subtitle_parts = []
    if row.get("suggested_price_range"):
        subtitle_parts.append("建议价带: %s" % row["suggested_price_range"])
    if row.get("expected_monthly_sales"):
        subtitle_parts.append("预估月销: %s" % row["expected_monthly_sales"])
    if row.get("rank_reason"):
        subtitle_parts.append(str(row["rank_reason"]))
    score = float(row.get("opportunity_score") or 0)
    if score:
        subtitle_parts.append("机会分 %.1f" % score)
    subtitle = " · ".join(subtitle_parts) or str(row.get("note") or "")[:120]

    pid = to_slug(name, idx)

    url = str(row.get("product_url") or "").strip()
    image = str(row.get("image_url") or "").strip()
    if "dummyimage.com" in image.lower():
        image = ""
    platform = str(row.get("platform") or "").strip()

    src_list: list[str] = (
        row.get("source_urls")
        if isinstance(row.get("source_urls"), list)
        else ([url] if url else [])
    )
    src_list = [str(u).strip() for u in src_list if str(u).strip()]

    out: dict[str, Any] = {
        "id": pid,
        "name": name,
        "category": category,
        "platform": platform,
        "price": round(price, 2),
        "price_cny": round(price, 2),
        "subtitle": subtitle[:200],
        "badge": pick_badge(score),
        "product_url": url,
        "image_url": image,
        "opportunity_score": score,
        "source_urls": src_list,
    }
    supply = build_supply(row, url, platform, src_list)
    if supply:
        out["supply"] = supply
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--selection",
        default=str(Path.home() / ".openclaw/workspace/data/pet-selection/selection.json"),
    )
    parser.add_argument(
        "--products",
        default=str(Path(__file__).resolve().parent.parent / "data" / "products.json"),
    )
    parser.add_argument("--top", type=int, default=20, help="Max rows by opportunity_score")
    parser.add_argument("--merge", action="store_true", help="Merge with existing products by id")
    args = parser.parse_args()

    sel_path = Path(args.selection)
    out_path = Path(args.products)
    rows = load_rows(sel_path)
    rows.sort(key=lambda r: float(r.get("opportunity_score") or 0), reverse=True)
    if args.top > 0:
        rows = rows[: args.top]

    new_items = [row_to_product(r, i + 1) for i, r in enumerate(rows)]
    if args.merge and out_path.exists():
        try:
            existing = json.loads(out_path.read_text(encoding="utf-8"))
        except Exception:
            existing = []
        if not isinstance(existing, list):
            existing = []
        by_id = {str(p.get("id")): p for p in existing if isinstance(p, dict) and p.get("id")}
        for p in new_items:
            by_id[p["id"]] = p
        new_items = list(by_id.values())

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(new_items, ensure_ascii=False, indent=2), encoding="utf-8")
    print("[selection->products] wrote %s items -> %s" % (len(new_items), out_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
