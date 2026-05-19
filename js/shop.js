(function () {
  var STORAGE_KEY = "lts_cart_v1";

  function loadCart() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { items: [] };
      var data = JSON.parse(raw);
      return data && Array.isArray(data.items) ? data : { items: [] };
    } catch (e) {
      return { items: [] };
    }
  }

  function saveCart(cart) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }

  function cartCount(cart) {
    return cart.items.reduce(function (n, it) {
      return n + (it.qty || 0);
    }, 0);
  }

  function cartTotal(cart) {
    return cart.items.reduce(function (sum, it) {
      return sum + (it.price || 0) * (it.qty || 0);
    }, 0);
  }

  /** Default source trace when selection row had no explicit `supply` (see data/products.json). */
  function defaultSupplyFromProduct(p) {
    var urls = [];
    var pu = String((p && p.product_url) || "").trim();
    if (pu) urls.push(pu);
    if (p && Array.isArray(p.source_urls)) {
      p.source_urls.forEach(function (u) {
        u = String(u || "").trim();
        if (u && urls.indexOf(u) === -1) urls.push(u);
      });
    }
    return {
      platform: String((p && p.platform) || "").trim(),
      listing_url: pu,
      source_urls: urls,
      mapped_at: new Date().toISOString(),
      provenance: "inferred_from_catalog",
    };
  }

  function supplyForLine(product) {
    if (product && product.supply && typeof product.supply === "object") {
      var s = {};
      for (var k in product.supply) {
        if (Object.prototype.hasOwnProperty.call(product.supply, k)) s[k] = product.supply[k];
      }
      s.cart_mapped_at = new Date().toISOString();
      return s;
    }
    return defaultSupplyFromProduct(product);
  }

  function addToCart(cart, product) {
    var found = cart.items.find(function (it) {
      return it.id === product.id;
    });
    if (found) found.qty += 1;
    else
      cart.items.push({
        id: product.id,
        name: product.name,
        price: product.price,
        qty: 1,
        supply: supplyForLine(product),
      });
    saveCart(cart);
  }

  function setQty(cart, id, qty) {
    var it = cart.items.find(function (x) {
      return x.id === id;
    });
    if (!it) return;
    it.qty = Math.max(0, qty | 0);
    cart.items = cart.items.filter(function (x) {
      return x.qty > 0;
    });
    saveCart(cart);
  }

  function visualHue(id) {
    var h = 0;
    for (var i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 3)) % 360;
    return h;
  }

  window.LTS = {
    loadCart: loadCart,
    saveCart: saveCart,
    cartCount: cartCount,
    cartTotal: cartTotal,
    addToCart: addToCart,
    setQty: setQty,
    visualHue: visualHue,
    supplyForLine: supplyForLine,
    defaultSupplyFromProduct: defaultSupplyFromProduct,
  };
})();
