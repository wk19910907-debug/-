import json
import urllib.request
from pathlib import Path


PRODUCTS_PATH = Path(r"C:\Users\Administrator\lhasasa-tashidelek-web\data\products.json")


def fallback_url(name: str, category: str) -> str:
    source = f"{name} {category}"
    if "猫砂" in source or "厕所" in source:
        keyword = "cat litter box"
    elif "主粮" in source or "猫粮" in source or "狗粮" in source:
        keyword = "pet food"
    elif "饮水" in source:
        keyword = "pet water fountain"
    elif "出行" in source or "航空箱" in source:
        keyword = "pet carrier"
    elif "玩具" in source or "猫抓板" in source:
        keyword = "cat toy"
    else:
        keyword = "pet product"
    return "https://source.unsplash.com/640x480/?" + keyword.replace(" ", ",")


def check_url_ok(url: str) -> bool:
    if not url:
        return False
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0"},
            method="HEAD",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return 200 <= resp.status < 400
    except Exception:
        return False


def main() -> None:
    products = json.loads(PRODUCTS_PATH.read_text(encoding="utf-8"))
    repaired = 0
    for item in products:
        url = (item.get("image_url") or "").strip()
        if check_url_ok(url):
            continue
        item["image_url"] = fallback_url(item.get("name", ""), item.get("category", ""))
        repaired += 1

    PRODUCTS_PATH.write_text(json.dumps(products, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"repaired={repaired}, total={len(products)}")


if __name__ == "__main__":
    main()
