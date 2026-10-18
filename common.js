// ใช้ร่วมกันทุกหน้า: รวมค่าที่แก้จากหน้า Admin (content.js) เข้ากับ data.js
(function () {
  var C = window.CONTENT || {};
  C.site = C.site || {}; C.brands = C.brands || {}; C.products = C.products || {};
  window.C = C;
  window.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  window.CATALOG = (window.CATALOG || [])
    .filter(function (b) { return !(C.brands[b.brand] && C.brands[b.brand].hidden); })
    .map(function (b) {
      return Object.assign({}, b, {
        items: b.items
          .filter(function (i) { var p = C.products[b.brand + "|" + i.sku]; return !(p && p.hidden); })
          .map(function (i) {
            var p = C.products[b.brand + "|" + i.sku] || {};
            return Object.assign({}, i, { title: p.title || "", desc: p.desc || "", specs: p.specs || [], featured: !!p.featured });
          })
      });
    })
    .filter(function (b) { return b.items.length; });

  window.applySite = function () {
    var s = C.site;
    document.querySelectorAll("[data-ct]").forEach(function (el) {
      var v = s[el.dataset.ct];
      if (v) el.innerHTML = window.esc(v).replace(/\n/g, "<br>");
    });
    if (s.logoA || s.logoB) {
      document.querySelectorAll(".logo").forEach(function (l) {
        l.textContent = s.logoA || "";
        var b = document.createElement("b"); b.textContent = s.logoB || ""; l.appendChild(b);
      });
    }
    if (s.title) document.title = s.title;
    if (s.banner) { var im = document.querySelector(".bn img.full"); if (im) im.src = s.banner; }
  };
})();
