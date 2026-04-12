(function () {
  var listEl = document.getElementById("order-summary");
  var totalEl = document.getElementById("order-total");
  var form = document.getElementById("checkout-form");

  function money(n) {
    return "¥" + (Math.round(n * 100) / 100).toFixed(0);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function run() {
    var cart = window.LTS.loadCart();
    if (!cart.items.length) {
      window.location.replace("/shop/");
      return;
    }
    if (!listEl || !totalEl) return;
    listEl.innerHTML = cart.items
      .map(function (it) {
        return (
          '<div class="order-line">' +
          "<span>" +
          escapeHtml(it.name) +
          " × " +
          it.qty +
          "</span>" +
          "<span>" +
          money(it.price * it.qty) +
          "</span>" +
          "</div>"
        );
      })
      .join("");
    totalEl.textContent = money(window.LTS.cartTotal(cart));
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var cart = window.LTS.loadCart();
      var fd = new FormData(form);
      var name = (fd.get("name") || "").toString().trim();
      var phone = (fd.get("phone") || "").toString().trim();
      if (!name || !phone) {
        alert("请填写收货人姓名与联系电话。");
        return;
      }
      var lines = cart.items.map(function (it) {
        return it.name + " ×" + it.qty + " — " + money(it.price * it.qty);
      });
      var body =
        "【订单预览】\n" +
        lines.join("\n") +
        "\n合计：" +
        money(window.LTS.cartTotal(cart)) +
        "\n\n收货人：" +
        name +
        "\n电话：" +
        phone +
        "\n地址：" +
        (fd.get("address") || "") +
        "\n备注：" +
        (fd.get("note") || "");

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(body).then(function () {
          alert(
            "订单信息已复制到剪贴板。\n\n当前站点为静态演示：正式收款与库存需接入微信支付、Stripe、Shopify 等。你可把复制内容发给客服邮箱完成人工确认。"
          );
        });
      } else {
        alert(
          "订单已生成（当前浏览器无法自动复制）。请截图购物车或联系客服。\n\n" + body.slice(0, 400)
        );
      }
    });
  }

  run();
})();
