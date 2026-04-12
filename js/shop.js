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
  };
})();
