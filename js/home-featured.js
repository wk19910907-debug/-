(function () {
  var root = document.getElementById("home-featured");
  if (!root) return;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function money(n) {
    return "¥" + (Math.round(n * 100) / 100).toFixed(0);
  }

  function hueFromId(id) {
    var h = 0;
    for (var i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 3)) % 360;
    return h;
  }

  fetch("/data/products.json")
    .then(function (r) {
      return r.json();
    })
    .then(function (products) {
      if (!Array.isArray(products) || !products.length) {
        root.innerHTML = "<p class=\"home-featured-fallback\">精选载入中…</p>";
        return;
      }
      var withBadge = products.filter(function (p) {
        return p.badge;
      });
      var list =
        withBadge.length >= 4
          ? withBadge.slice(0, 4)
          : products.slice(0, 4);
      root.innerHTML = list
        .map(function (p) {
          var hu = hueFromId(p.id || "");
          return (
            '<a class="home-spot-card" href="/shop/">' +
            '<div class="home-spot-visual" style="background:linear-gradient(160deg,hsl(' +
            hu +
            ',22%,14%) 0%,hsl(' +
            ((hu + 35) % 360) +
            ',18%,8%) 100%)">' +
            (p.badge
              ? '<span class="home-spot-badge">' + escapeHtml(p.badge) + "</span>"
              : "") +
            '<span class="home-spot-initial" aria-hidden="true">' +
            escapeHtml((p.name || "?").slice(0, 1)) +
            "</span>" +
            "</div>" +
            '<div class="home-spot-body">' +
            '<span class="home-spot-cat">' +
            escapeHtml(p.category || "") +
            "</span>" +
            "<h3 class=\"home-spot-name\">" +
            escapeHtml(p.name || "") +
            "</h3>" +
            '<p class="home-spot-price">' +
            money(Number(p.price) || 0) +
            "</p>" +
            "</div>" +
            "</a>"
          );
        })
        .join("");
    })
    .catch(function () {
      root.innerHTML =
        '<p class="home-featured-fallback">无法加载精选，请直接前往 <a href="/shop/">宠物馆</a>。</p>';
    });
})();
