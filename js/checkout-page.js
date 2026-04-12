(function () {
  var listEl = document.getElementById("order-summary");
  var totalEl = document.getElementById("order-total");
  var form = document.getElementById("checkout-form");
  var submitBtn = form ? form.querySelector(".submit-order") : null;

  function money(n) {
    return "¥" + (Math.round(n * 100) / 100).toFixed(0);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function cartTotalYuan(cart) {
    return cart.items.reduce(function (sum, it) {
      return sum + (it.price || 0) * (it.qty || 0);
    }, 0);
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

  function copyOrderText(body) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(body).then(function () {
        alert(
          "订单信息已复制到剪贴板。\n\n未配置空中云汇或未跳转收银台时，可将内容发给客服人工确认。"
        );
      });
    }
    alert("订单预览：\n\n" + body.slice(0, 600));
    return Promise.resolve();
  }

  function fallbackSubmit(cart, fd, body) {
    return copyOrderText(body);
  }

  function loadAirwallexSdk() {
    if (window.__lts_awx_sdk) return Promise.resolve(window.__lts_awx_sdk);
    return import("https://esm.sh/@airwallex/components-sdk@1.28.3").then(function (mod) {
      window.__lts_awx_sdk = mod;
      return mod;
    });
  }

  function payWithAirwallex(cfg, cart, fd, totalYuan) {
    var minor = Math.max(1, Math.round(totalYuan * 100));
    var oid = "pet-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    var payload = {
      amount: minor,
      currency: (cfg.currency || "CNY").toUpperCase(),
      merchant_order_id: oid,
      customer_name: (fd.get("name") || "").toString().trim(),
      customer_phone: (fd.get("phone") || "").toString().trim(),
      shipping_country: "CN",
      shipping_province: "",
      shipping_city: "",
      shipping_address: (fd.get("address") || "").toString().trim(),
      shipping_postal_code: "",
      shipping_eta_days: (fd.get("note") || "").toString().slice(0, 80),
    };

    return fetch(cfg.intentUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { res: res, data: data };
        });
      })
      .then(function (_ref) {
        var res = _ref.res;
        var data = _ref.data;
        if (!res.ok) throw new Error(data.error || "Intent API " + res.status);
        if (!data.id || !data.client_secret || !data.currency) {
          throw new Error("收银台参数不完整，请检查 Intent API 返回。");
        }
        return loadAirwallexSdk().then(function (mod) {
          var init = mod.init;
          if (!init) throw new Error("Airwallex SDK 未加载 init");
          var env = cfg.env === "prod" ? "prod" : "demo";
          return init({
            env: env,
            clientId: cfg.clientId,
            enabledElements: ["payments"],
          }).then(function (awx) {
            var payments = awx.payments;
            if (!payments || !payments.redirectToCheckout) {
              throw new Error("Airwallex 未提供 redirectToCheckout");
            }
            var origin = window.location.origin;
            var successUrl =
              origin + "/shop/payment-success.html?status=success&order=" + encodeURIComponent(oid);
            return payments.redirectToCheckout({
              intent_id: data.id,
              client_secret: data.client_secret,
              currency: data.currency,
              country_code: cfg.countryCode || "CN",
              successUrl: successUrl,
            });
          });
        });
      });
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

      var totalYuan = cartTotalYuan(cart);
      if (totalYuan <= 0) {
        alert("订单金额无效。");
        return;
      }

      var lines = cart.items.map(function (it) {
        return it.name + " ×" + it.qty + " — " + money(it.price * it.qty);
      });
      var body =
        "【宠物馆订单】\n" +
        lines.join("\n") +
        "\n合计：" +
        money(totalYuan) +
        "\n\n收货人：" +
        name +
        "\n电话：" +
        phone +
        "\n地址：" +
        (fd.get("address") || "") +
        "\n备注：" +
        (fd.get("note") || "");

      var cfg = window.LTS_AIRWALLEX || {};
      var hasAwx =
        cfg.clientId &&
        String(cfg.clientId).trim() &&
        cfg.intentUrl &&
        String(cfg.intentUrl).trim();

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = hasAwx ? "正在连接空中云汇…" : "处理中…";
      }

      var done = function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = hasAwx ? "空中云汇安全支付" : "提交订单（演示）";
        }
      };

      if (hasAwx) {
        payWithAirwallex(cfg, cart, fd, totalYuan).catch(function (err) {
          alert(
            (err && err.message ? err.message : "支付发起失败") +
              "\n\n将改为复制订单文本，你可联系人工客服；并确认：\n1) intentUrl 为公网 HTTPS；\n2) 另一站点已配置 CORS 白名单包含本店域名；\n3) 服务端 AIRWALLEX_* 与 CNY 金额逻辑正确。"
          );
          Promise.resolve(fallbackSubmit(cart, fd, body)).finally(done);
        });
        return;
      }

      fallbackSubmit(cart, fd, body).finally(done);
    });

    var cfg2 = window.LTS_AIRWALLEX || {};
    if (
      submitBtn &&
      cfg2.clientId &&
      String(cfg2.clientId).trim() &&
      cfg2.intentUrl &&
      String(cfg2.intentUrl).trim()
    ) {
      submitBtn.textContent = "空中云汇安全支付";
    }
  }

  run();
})();
