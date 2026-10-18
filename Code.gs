/**
 * Admin แคตตาล็อก — Google Apps Script จัดการไฟล์ใน Google Drive
 * วางไฟล์นี้ใน Apps Script ด้วยบัญชีที่เป็นเจ้าของโฟลเดอร์ DATA
 * แล้วกด Deploy > New deployment > Web app (Execute as: Me / Who has access: Anyone)
 */

// 1) ID โฟลเดอร์หลักที่อนุญาตให้จัดการ (โฟลเดอร์ DATA)
const ROOT_ID = '1znWxZ7wp3K6zj6HNHHQzlHA-RjU2hixA';

// 2) รหัสลับ — เปลี่ยนเป็นของคุณเอง (ยาวๆ เดายาก) แล้วใส่รหัสเดียวกันในหน้า Admin
// ปล่อยเป็น '' = ไม่ใช้รหัสลับ (ใครมี Web app URL ก็แก้ Drive ได้)
const SECRET = '';

function doGet() {
  return out({ ok: true, msg: 'พร้อมใช้งาน' });
}

function doPost(e) {
  try {
    const r = JSON.parse(e.postData.contents);
    if (SECRET && r.key !== SECRET) return out({ error: 'รหัสลับไม่ถูกต้อง' });

    switch (r.action) {
      case 'list':   return out(list_(r.folderId || ROOT_ID));
      case 'mkdir':  return out(mkdir_(r.parentId, r.name));
      case 'rename': return out(rename_(r.id, r.name));
      case 'trash':  return out(trash_(r.id));
      case 'upload': return out(upload_(r.parentId, r.name, r.mime, r.data));
      default:       return out({ error: 'ไม่รู้จักคำสั่ง' });
    }
  } catch (err) {
    return out({ error: String(err && err.message || err) });
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

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
