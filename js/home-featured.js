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

  function imageFallback(p) {
    var keyword = "pet supplies";
    var source = (p.name || "") + " " + (p.category || "");
    if (/猫砂|厕所/.test(source)) keyword = "cat litter";
    else if (/主粮|猫粮/.test(source)) keyword = "cat food";
    else if (/饮水/.test(source)) keyword = "pet fountain";
    else if (/出行|航空箱/.test(source)) keyword = "pet carrier";
    return "https://source.unsplash.com/640x480/?" + encodeURIComponent(keyword);
  }

  function cardHtml(p, compact) {
    var hu = hueFromId(p.id || "");
    var h2 = (hu + 28) % 360;
    var grad =
      "linear-gradient(155deg,hsl(" +
      hu +
      ",6%,94%) 0%,hsl(" +
      h2 +
      ",5%,88%) 100%)";
    var badge = p.badge
      ? '<span class="home-spot-badge">' + escapeHtml(p.badge) + "</span>"
      : "";
    var imgUrl = p.image_url || p.processed_image_path || imageFallback(p);
    if (String(imgUrl).indexOf("dummyimage.com") !== -1) imgUrl = imageFallback(p);
    var imgBlock =
      '<img class="home-spot-img" loading="lazy" src="' +
      escapeHtml(imgUrl) +
      '" alt="">';
    var initial =
      '<span class="home-spot-initial" aria-hidden="true">' +
      escapeHtml((p.name || "?").slice(0, 1)) +
      "</span>";
    var visual =
      '<div class="home-spot-visual" style="background:' + grad + '">' +
      badge +
      imgBlock +
      initial +
      "</div>";
    var body =
      '<div class="home-spot-body">' +
      '<span class="home-spot-cat">' +
      escapeHtml(p.category || "") +
      "</span>" +
      '<h3 class="home-spot-name">' +
      escapeHtml(p.name || "") +
      "</h3>" +
      '<p class="home-spot-price">' +
      money(Number(p.price) || 0) +
      "</p>" +
      "</div>";
    var cls = "home-spot-card";
    if (compact) cls += " home-spot-card--compact";
    else cls += " home-spot-card--lead";
    return '<a class="' + cls + '" href="/shop/">' + visual + body + "</a>";
  }

  fetch("/data/products.json")
    .then(function (r) {
      return r.json();
    })
    .then(function (products) {
      if (!Array.isArray(products) || !products.length) {
        root.innerHTML = '<p class="home-featured-fallback">精选载入中…</p>';
        return;
      }
      products = products.slice().sort(function (a, b) {
        return (Number(b.opportunity_score) || 0) - (Number(a.opportunity_score) || 0);
      });
      var withBadge = products.filter(function (p) {
        return p.badge;
      });
      var list =
        withBadge.length >= 4
          ? withBadge.slice(0, 4)
          : products.slice(0, 4);
      var lead = cardHtml(list[0], false);
      var rest = list
        .slice(1)
        .map(function (p) {
          return cardHtml(p, true);
        })
        .join("");
      root.innerHTML =
        '<div class="home-featured-magazine">' +
        '<div class="home-featured-lead">' +
        lead +
        "</div>" +
        '<div class="home-featured-stack">' +
        rest +
        "</div>" +
        "</div>";
    })
    .catch(function () {
      root.innerHTML =
        '<p class="home-featured-fallback">无法加载精选，请直接前往 <a href="/shop/">宠物馆</a>。</p>';
    });
})();
