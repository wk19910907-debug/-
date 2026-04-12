(function () {
  var grid = document.getElementById("product-grid");
  var filtersEl = document.getElementById("shop-filters");
  var cartBtn = document.getElementById("cart-launch");
  var cartCountEl = document.getElementById("cart-count");
  var drawer = document.getElementById("cart-drawer");
  var cartLinesEl = document.getElementById("cart-lines");
  var cartTotalEl = document.getElementById("cart-total-num");
  var checkoutLink = document.getElementById("checkout-link");
  var closeBtn = document.getElementById("cart-close");
  var backdrop = document.querySelector(".cart-drawer-backdrop");

  if (!grid) return;

  var products = [];
  var activeCat = "全部";

  function money(n) {
    return "¥" + (Math.round(n * 100) / 100).toFixed(0);
  }

  function syncCartUi() {
    var cart = window.LTS.loadCart();
    var c = window.LTS.cartCount(cart);
    if (cartCountEl) cartCountEl.textContent = String(c);
    if (checkoutLink) checkoutLink.setAttribute("aria-disabled", c === 0 ? "true" : "false");

    if (!cartLinesEl) return;
    if (!cart.items.length) {
      cartLinesEl.innerHTML = '<p class="cart-empty">购物车还是空的，去挑一件心意吧。</p>';
    } else {
      cartLinesEl.innerHTML = cart.items
        .map(function (it) {
          return (
            '<div class="cart-line" data-id="' +
            escapeHtml(it.id) +
            '">' +
            '<span class="cart-line-title">' +
            escapeHtml(it.name) +
            "</span>" +
            '<div class="cart-line-meta">' +
            "<span>" +
            money(it.price) +
            " × " +
            it.qty +
            "</span>" +
            '<span class="qty-control">' +
            '<button type="button" data-act="dec" aria-label="减少">−</button>' +
            "<span>" +
            it.qty +
            "</span>" +
            '<button type="button" data-act="inc" aria-label="增加">+</button>' +
            "</span>" +
            "</div>" +
            "</div>"
          );
        })
        .join("");
    }
    if (cartTotalEl) cartTotalEl.textContent = money(window.LTS.cartTotal(cart));
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function openDrawer() {
    if (drawer) {
      drawer.classList.add("is-open");
      drawer.setAttribute("aria-hidden", "false");
    }
  }

  function closeDrawer() {
    if (drawer) {
      drawer.classList.remove("is-open");
      drawer.setAttribute("aria-hidden", "true");
    }
  }

  function renderProducts() {
    var list =
      activeCat === "全部"
        ? products
        : products.filter(function (p) {
            return p.category === activeCat;
          });

    grid.innerHTML = list
      .map(function (p) {
        var hue = window.LTS.visualHue(p.id);
        var badge = p.badge
          ? '<span class="product-badge">' + escapeHtml(p.badge) + "</span>"
          : "";
        return (
          '<article class="product-card" data-id="' +
          escapeHtml(p.id) +
          '">' +
          '<div class="product-visual" style="background:linear-gradient(145deg,hsl(' +
          hue +
          ',35%,18%) 0%,hsl(' +
          ((hue + 40) % 360) +
          ',28%,12%) 100%)">' +
          badge +
          '<span aria-hidden="true">' +
          escapeHtml(p.name.slice(0, 1)) +
          "</span>" +
          "</div>" +
          '<div class="product-body">' +
          '<span class="product-cat">' +
          escapeHtml(p.category) +
          "</span>" +
          "<h3 class=\"product-name\">" +
          escapeHtml(p.name) +
          "</h3>" +
          '<p class="product-sub">' +
          escapeHtml(p.subtitle || "") +
          "</p>" +
          '<div class="product-row">' +
          '<span class="product-price">' +
          money(p.price) +
          "<small>起</small></span>" +
          '<button type="button" class="add-btn" data-add="' +
          escapeHtml(p.id) +
          '">加入购物车</button>' +
          "</div>" +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function buildFilters() {
    if (!filtersEl) return;
    var cats = ["全部"];
    products.forEach(function (p) {
      if (cats.indexOf(p.category) === -1) cats.push(p.category);
    });
    filtersEl.innerHTML = cats
      .map(function (c) {
        return (
          '<button type="button" class="filter-btn' +
          (c === activeCat ? " is-active" : "") +
          '" data-cat="' +
          escapeHtml(c) +
          '">' +
          escapeHtml(c) +
          "</button>"
        );
      })
      .join("");
  }

  fetch("/data/products.json")
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      products = data;
      buildFilters();
      renderProducts();
      syncCartUi();
    })
    .catch(function () {
      grid.innerHTML =
        '<p class="cart-empty">商品数据加载失败，请稍后刷新。</p>';
    });

  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t.closest && t.closest(".filter-btn")) {
      var btn = t.closest(".filter-btn");
      activeCat = btn.getAttribute("data-cat") || "全部";
      buildFilters();
      renderProducts();
      return;
    }
    if (t.getAttribute && t.getAttribute("data-add")) {
      var id = t.getAttribute("data-add");
      var p = products.find(function (x) {
        return x.id === id;
      });
      if (!p) return;
      var cart = window.LTS.loadCart();
      window.LTS.addToCart(cart, p);
      syncCartUi();
      openDrawer();
      return;
    }
    if (t.id === "cart-launch" || (t.closest && t.closest("#cart-launch"))) {
      openDrawer();
      return;
    }
    if (t.id === "cart-close" || (t.closest && t.closest(".cart-drawer-backdrop"))) {
      closeDrawer();
      return;
    }
    if (t.getAttribute && t.getAttribute("data-act") && t.closest(".cart-line")) {
      var line = t.closest(".cart-line");
      var pid = line.getAttribute("data-id");
      var cart = window.LTS.loadCart();
      var item = cart.items.find(function (x) {
        return x.id === pid;
      });
      if (!item) return;
      var act = t.getAttribute("data-act");
      if (act === "inc") window.LTS.setQty(cart, pid, item.qty + 1);
      else if (act === "dec") window.LTS.setQty(cart, pid, item.qty - 1);
      syncCartUi();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeDrawer();
  });

  if (checkoutLink) {
    checkoutLink.addEventListener("click", function (e) {
      if (checkoutLink.getAttribute("aria-disabled") === "true") e.preventDefault();
    });
  }

  if (cartBtn) cartBtn.addEventListener("click", openDrawer);
  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
})();
