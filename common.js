// ใช้ร่วมกันทุกหน้า: รวมค่าที่แก้จากหน้า Admin (content.js) เข้ากับรายการสินค้า
// รายการสินค้ามาจาก Google Drive (ถ้าตั้ง site.driveApi ไว้) หรือไฟล์ data.js ในเครื่อง
(function () {
  var C = window.CONTENT || {};
  C.site = C.site || {}; C.brands = C.brands || {}; C.products = C.products || {};
  window.C = C;
  window.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  window.fromDrive = function (j) { return fromDriveImpl(j); };
  var money = function (v) { v = String(v == null ? "" : v).trim(); if (!v) return ""; if (/^[\d,.]+$/.test(v)) { var n = Number(v.replace(/,/g, "")); return "฿" + (isNaN(n) ? v : n.toLocaleString("th-TH")); } return v; };
  window.priceHtml = function (i) { return i.price ? "<b>" + window.esc(money(i.price)) + "</b>" + (i.oldPrice ? " <s>" + window.esc(money(i.oldPrice)) + "</s>" : "") : ""; };
  window.isVid = function (m) { return /\.mp4$|\/preview$/.test(m); };

  var lh = function (id, w) { return "https://lh3.googleusercontent.com/d/" + id + "=w" + w; };

  function fromDriveImpl(j) {
    return (j.brands || []).map(function (b) {
      return {
        brand: b.brand,
        items: b.items.map(function (i) {
          return {
            sku: i.sku,
            cover: lh(i.imgs[0], 520),
            imgs: i.imgs.map(function (id) { return lh(id, 1100); }),
            vids: (i.vids || []).map(function (id) { return "https://drive.google.com/file/d/" + id + "/preview"; }),
            colors: (i.colors || []).map(function (c) { return { n: c.n, t: lh(c.id, 160), f: lh(c.id, 1100) }; })
          };
        })
      };
    });
  }

  function finish(cat) {
    window.CATALOG = (cat || [])
      .filter(function (b) { return !(C.brands[b.brand] && C.brands[b.brand].hidden); })
      .map(function (b) {
        return Object.assign({}, b, {
          items: b.items
            .filter(function (i) {
              if (String(i.sku).charAt(0) === "_") return false; // โฟลเดอร์ข้อมูล ไม่ใช่สินค้า
              var p = C.products[b.brand + "|" + i.sku];
              return !(p && p.hidden);
            })
            .map(function (i) {
              var p = C.products[b.brand + "|" + i.sku] || {};
              return Object.assign({}, i, { title: p.title || "", desc: p.desc || "", specs: p.specs || [], featured: !!p.featured, price: p.price || "", oldPrice: p.oldPrice || "" });
            })
        });
      })
      .filter(function (b) { return b.items.length; });
  }

  var api = window.API_URL || C.site.driveApi || "";
  if (api) {
    var base = api + (api.indexOf("?") < 0 ? "?" : "&");
    var getJson = function (u) { return fetch(u).then(function (r) { return r.json(); }); };
    window.catalogReady = Promise.all([getJson(base + "content=1").catch(function () { return null; }), getJson(base + "catalog=1")])
      .then(function (res) {
        var c = res[0], j = res[1];
        if (c && !c.error && (c.site || c.brands || c.products)) {
          C.site = Object.assign({}, C.site, c.site || {}); C.brands = c.brands || {}; C.products = c.products || {};
        }
        if (j.error) throw new Error(j.error);
        finish(fromDriveImpl(j));
      })
      .catch(function (e) {
        console.warn("โหลดรายการจาก Drive ไม่ได้ ใช้ข้อมูลในเครื่องแทน:", e);
        finish(window.CATALOG);
      });
  } else {
    finish(window.CATALOG);
    window.catalogReady = Promise.resolve();
  }

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
