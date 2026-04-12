(function () {
  var listEl = document.getElementById("guestbook-list");
  var form = document.getElementById("guestbook-form");
  var feedback = document.getElementById("gb-feedback");
  var submitBtn = document.getElementById("gb-submit");

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function renderList(items) {
    if (!listEl) return;
    if (!items || !items.length) {
      listEl.innerHTML = '<p class="cart-empty">暂无精选留言。</p>';
      return;
    }
    listEl.innerHTML = items
      .map(function (row) {
        return (
          '<blockquote class="guestbook-item">' +
          '<p class="guestbook-msg">' +
          escapeHtml(row.message || "") +
          "</p>" +
          '<footer class="guestbook-meta">' +
          escapeHtml(row.author || "匿名") +
          " · " +
          escapeHtml(row.date || "") +
          "</footer>" +
          "</blockquote>"
        );
      })
      .join("");
  }

  fetch("/data/guestbook.json")
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      renderList(Array.isArray(data) ? data : []);
    })
    .catch(function () {
      if (listEl) {
        listEl.innerHTML = '<p class="cart-empty">留言列表加载失败。</p>';
      }
    });

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var payload = {
        name: (fd.get("name") || "").toString().trim(),
        email: (fd.get("email") || "").toString().trim(),
        message: (fd.get("message") || "").toString().trim(),
      };
      if (!payload.name || !payload.message) {
        if (feedback) {
          feedback.style.display = "block";
          feedback.textContent = "请填写称呼与留言内容。";
        }
        return;
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "提交中…";
      }
      if (feedback) {
        feedback.style.display = "none";
      }

      fetch("/api/guestbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (r) {
          return r.json().then(function (data) {
            return { ok: r.ok, data: data };
          });
        })
        .then(function (_ref) {
          var ok = _ref.ok;
          var data = _ref.data;
          if (feedback) {
            feedback.style.display = "block";
            if (ok && data.ok) {
              feedback.textContent = data.delivered
                ? "已收到您的留言，我们会尽快审核展示。感谢您的反馈！"
                : "已收到提交。当前未配置通知 Webhook，请联系站长或等待人工处理。" +
                  (data.hint ? " " + data.hint : "");
              form.reset();
            } else {
              feedback.textContent =
                (data && data.error) || "提交失败，请稍后重试。";
            }
          }
        })
        .catch(function () {
          if (feedback) {
            feedback.style.display = "block";
            feedback.textContent = "网络错误，请检查连接或稍后再试。";
          }
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "提交留言";
          }
        });
    });
  }
})();
