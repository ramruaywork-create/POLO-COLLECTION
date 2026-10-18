/**
 * Admin แคตตาล็อก — Google Apps Script จัดการไฟล์ใน Google Drive + สร้างรายการสินค้าให้เว็บ
 * วางไฟล์นี้ใน Apps Script ด้วยบัญชีที่เป็นเจ้าของโฟลเดอร์ DATA
 * แล้วกด Deploy > New deployment > Web app (Execute as: Me / Who has access: Anyone)
 *
 * โครงสร้างใน Drive ที่สคริปต์เข้าใจ:  DATA / แบรนด์ / รหัสรุ่น / (รูปหลัก, Image/, สี/, *.mp4)
 * โฟลเดอร์ที่ขึ้นต้นด้วย _ และโฟลเดอร์ "น้ำถ้วม" จะไม่ถูกนำไปแสดงเป็นสินค้า
 */

// ID โฟลเดอร์หลักที่อนุญาตให้จัดการ (โฟลเดอร์ DATA)
const ROOT_ID = '1znWxZ7wp3K6zj6HNHHQzlHA-RjU2hixA';

// รหัสลับสำหรับ "แก้ไข" Drive (อัปโหลด/ลบ/เปลี่ยนชื่อ/อัปเดตรายการ)
// เพราะ Web app URL จะอยู่ในเว็บสาธารณะ จึงควรมีรหัสเสมอ — เปลี่ยนเป็นของคุณเอง
// (การ "อ่าน" รายการสินค้าไม่ต้องใช้รหัส)
const SECRET = 'rr-8f3KqW7xZ2mP9vLd4Tn6Hs1';

const CATALOG_FILE = '_catalog.json';
const SKIP_BRANDS = ['น้ำถ้วม'];

// ---------------------------------------------------------------- entry points

function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.catalog) {
      var it = DriveApp.getFolderById(ROOT_ID).getFilesByName(CATALOG_FILE);
      if (!it.hasNext()) return out({ error: 'ยังไม่มีรายการสินค้า — กด "อัปเดตรายการสินค้า" ในหน้า Admin ก่อน' });
      return ContentService.createTextOutput(it.next().getBlob().getDataAsString())
        .setMimeType(ContentService.MimeType.JSON);
    }
    return out({ ok: true, msg: 'พร้อมใช้งาน' });
  } catch (err) {
    return out({ error: String(err && err.message || err) });
  }
}

function doPost(e) {
  try {
    const r = JSON.parse(e.postData.contents);
    if (!SECRET || r.key !== SECRET) return out({ error: 'รหัสลับไม่ถูกต้อง' });

    switch (r.action) {
      case 'list':    return out(list_(r.folderId || ROOT_ID));
      case 'mkdir':   return out(mkdir_(r.parentId, r.name));
      case 'rename':  return out(rename_(r.id, r.name));
      case 'trash':   return out(trash_(r.id));
      case 'upload':  return out(upload_(r.parentId, r.name, r.mime, r.data));
      case 'rebuild': return out(rebuild_());
      default:        return out({ error: 'ไม่รู้จักคำสั่ง' });
    }
  } catch (err) {
    return out({ error: String(err && err.message || err) });
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------- file ops

// อนุญาตเฉพาะไฟล์/โฟลเดอร์ที่อยู่ใต้ ROOT_ID เท่านั้น
function inside_(id) {
  if (id === ROOT_ID) return true;
  var item;
  try { item = DriveApp.getFolderById(id); }
  catch (e) { try { item = DriveApp.getFileById(id); } catch (e2) { return false; } }
  var ps = item.getParents();
  while (ps.hasNext()) { if (inside_(ps.next().getId())) return true; }
  return false;
}
function guard_(id) { if (!inside_(id)) throw new Error('ไม่อนุญาตให้จัดการรายการนอกโฟลเดอร์ DATA'); }

function list_(folderId) {
  guard_(folderId);
  var f = DriveApp.getFolderById(folderId);
  var items = [];
  var fs = f.getFolders();
  while (fs.hasNext()) { var d = fs.next(); items.push({ id: d.getId(), name: d.getName(), folder: true, url: d.getUrl() }); }
  var fl = f.getFiles();
  while (fl.hasNext()) { var x = fl.next(); items.push({ id: x.getId(), name: x.getName(), folder: false, mime: x.getMimeType(), size: x.getSize(), url: x.getUrl() }); }
  items.sort(function (a, b) { return (b.folder - a.folder) || a.name.localeCompare(b.name, 'th'); });
  return { ok: true, folder: { id: f.getId(), name: f.getName() }, items: items };
}

function mkdir_(parentId, name) {
  guard_(parentId);
  if (!name) throw new Error('ต้องระบุชื่อ');
  var d = DriveApp.getFolderById(parentId).createFolder(name);
  return { ok: true, id: d.getId() };
}

function rename_(id, name) {
  guard_(id);
  if (id === ROOT_ID) throw new Error('ห้ามเปลี่ยนชื่อโฟลเดอร์หลัก');
  if (!name) throw new Error('ต้องระบุชื่อ');
  try { DriveApp.getFolderById(id).setName(name); }
  catch (e) { DriveApp.getFileById(id).setName(name); }
  return { ok: true };
}

// ลบ = ย้ายไปถังขยะ (กู้คืนได้จาก Google Drive)
function trash_(id) {
  guard_(id);
  if (id === ROOT_ID) throw new Error('ห้ามลบโฟลเดอร์หลัก');
  try { DriveApp.getFolderById(id).setTrashed(true); }
  catch (e) { DriveApp.getFileById(id).setTrashed(true); }
  return { ok: true };
}

function upload_(parentId, name, mime, b64) {
  guard_(parentId);
  if (!name || !b64) throw new Error('ข้อมูลไม่ครบ');
  var blob = Utilities.newBlob(Utilities.base64Decode(b64), mime || 'application/octet-stream', name);
  var f = DriveApp.getFolderById(parentId).createFile(blob);
  return { ok: true, id: f.getId() };
}

// ---------------------------------------------------------------- catalog index

function api_(path) {
  var r = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/' + path, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  if (r.getResponseCode() !== 200) throw new Error('Drive API ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 200));
  return JSON.parse(r.getContentText());
}

// รายการลูกของโฟลเดอร์หลายอันในครั้งเดียว (ทีละ 20 โฟลเดอร์)
function children_(ids) {
  var all = [];
  for (var i = 0; i < ids.length; i += 20) {
    var q = '(' + ids.slice(i, i + 20).map(function (id) { return "'" + id + "' in parents"; }).join(' or ') + ') and trashed=false';
    var tok = '';
    do {
      var res = api_('files?q=' + encodeURIComponent(q) + '&pageSize=1000&fields=nextPageToken,files(id,name,mimeType,parents)' +
        '&supportsAllDrives=true&includeItemsFromAllDrives=true' + (tok ? '&pageToken=' + encodeURIComponent(tok) : ''));
      all = all.concat(res.files || []);
      tok = res.nextPageToken || '';
    } while (tok);
  }
  return all;
}

function nat_(a, b) {
  var ax = a.name.toLowerCase().split(/(\d+)/), bx = b.name.toLowerCase().split(/(\d+)/);
  for (var i = 0; i < Math.min(ax.length, bx.length); i++) {
    if (ax[i] === bx[i]) continue;
    var an = /^\d+$/.test(ax[i]), bn = /^\d+$/.test(bx[i]);
    if (an && bn) return (+ax[i]) - (+bx[i]);
    return ax[i] < bx[i] ? -1 : 1;
  }
  return ax.length - bx.length;
}
function isFolder_(f) { return f.mimeType === 'application/vnd.google-apps.folder'; }
function isImg_(f) { return (f.mimeType || '').indexOf('image/') === 0; }
function isVid_(f) { return (f.mimeType || '').indexOf('video/') === 0; }
function group_(files) {
  var g = {};
  files.forEach(function (f) { (f.parents || []).forEach(function (p) { (g[p] = g[p] || []).push(f); }); });
  return g;
}

// สแกน Drive แล้วเขียนรายการสินค้าลงไฟล์ _catalog.json (เว็บอ่านไฟล์นี้)
function rebuild_() {
  var brands = children_([ROOT_ID]).filter(function (f) {
    return isFolder_(f) && f.name.charAt(0) !== '_' && SKIP_BRANDS.indexOf(f.name) < 0;
  }).sort(nat_);

  var skusByBrand = group_(children_(brands.map(function (b) { return b.id; })).filter(function (f) {
    return isFolder_(f) && f.name.charAt(0) !== '_';
  }));
  var skuIds = [];
  Object.keys(skusByBrand).forEach(function (k) { skusByBrand[k].forEach(function (s) { skuIds.push(s.id); }); });

  var kids = group_(children_(skuIds));
  var subIds = [];
  Object.keys(kids).forEach(function (k) {
    kids[k].forEach(function (f) {
      var n = f.name.toLowerCase();
      if (isFolder_(f) && (n === 'image' || n === 'สี')) subIds.push(f.id);
    });
  });
  var subKids = group_(children_(subIds));

  var data = [];
  brands.forEach(function (b) {
    var items = [];
    (skusByBrand[b.id] || []).sort(nat_).forEach(function (s) {
      var k = kids[s.id] || [];
      var rootImgs = k.filter(isImg_).sort(nat_);
      var vids = k.filter(isVid_).sort(nat_);
      var imd = k.filter(function (f) { return isFolder_(f) && f.name.toLowerCase() === 'image'; })[0];
      var cold = k.filter(function (f) { return isFolder_(f) && f.name === 'สี'; })[0];
      var alt = imd ? (subKids[imd.id] || []).filter(isImg_).sort(nat_) : [];
      var main = rootImgs.length ? rootImgs : alt;
      if (!main.length) return;
      var cols = cold ? (subKids[cold.id] || []).filter(isImg_).sort(nat_) : [];
      items.push({
        sku: s.name,
        imgs: main.map(function (f) { return f.id; }),
        vids: vids.map(function (f) { return f.id; }),
        colors: cols.map(function (f) { return { n: f.name.replace(/\.[^.]+$/, ''), id: f.id }; })
      });
    });
    if (items.length) data.push({ brand: b.name, items: items });
  });

  var json = JSON.stringify({ updated: new Date().toISOString(), brands: data });
  var root = DriveApp.getFolderById(ROOT_ID);
  var it = root.getFilesByName(CATALOG_FILE);
  if (it.hasNext()) it.next().setContent(json);
  else root.createFile(CATALOG_FILE, json, 'application/json');
  return { ok: true, brands: data.length, skus: data.reduce(function (n, b) { return n + b.items.length; }, 0) };
}
