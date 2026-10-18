"""เซิร์ฟเวอร์ Admin (รันในเครื่องเท่านั้น)
เปิดด้วย start-admin.bat แล้วเข้า http://localhost:8800/admin.html
บันทึกการแก้ไขลงไฟล์ content.js และอัปโหลดรูปแบนเนอร์ลงโฟลเดอร์ assets
"""
import json, os, re, sys, tempfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 8800
MAX_JSON = 5 * 1024 * 1024
MAX_IMG = 20 * 1024 * 1024
IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _ok_host(self):
        host = (self.headers.get("Host") or "").split(":")[0]
        return host in ("localhost", "127.0.0.1")

    def _json(self, code, obj):
        b = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def _body(self, limit):
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > limit:
            return None
        return self.rfile.read(n)

    def do_GET(self):
        if urlparse(self.path).path == "/api/ping":
            return self._json(200, {"ok": True})
        return super().do_GET()

    def do_POST(self):
        if not self._ok_host():
            return self._json(403, {"error": "forbidden"})
        u = urlparse(self.path)
        if u.path == "/api/save":
            raw = self._body(MAX_JSON)
            if raw is None:
                return self._json(400, {"error": "bad body"})
            try:
                data = json.loads(raw.decode("utf-8"))
                assert isinstance(data, dict)
            except Exception:
                return self._json(400, {"error": "bad json"})
            out = "window.CONTENT = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n"
            target = os.path.join(ROOT, "content.js")
            if os.path.exists(target):  # สำรองไฟล์เดิม 1 ชุด
                with open(target, "rb") as f, open(target + ".bak", "wb") as g:
                    g.write(f.read())
            fd, tmp = tempfile.mkstemp(dir=ROOT, suffix=".tmp")
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(out)
            os.replace(tmp, target)
            return self._json(200, {"ok": True})
        if u.path == "/api/upload":
            name = parse_qs(u.query).get("name", [""])[0]
            name = re.sub(r"[^A-Za-z0-9._-]", "_", os.path.basename(name))
            ext = os.path.splitext(name)[1].lower()
            if not name or ext not in IMG_EXT:
                return self._json(400, {"error": "ไฟล์ต้องเป็นรูปภาพ"})
            raw = self._body(MAX_IMG)
            if raw is None:
                return self._json(400, {"error": "ไฟล์ใหญ่เกินไป (สูงสุด 20 MB)"})
            os.makedirs(os.path.join(ROOT, "assets"), exist_ok=True)
            with open(os.path.join(ROOT, "assets", name), "wb") as f:
                f.write(raw)
            return self._json(200, {"ok": True, "path": "assets/" + name})
        return self._json(404, {"error": "not found"})

    def log_message(self, fmt, *args):
        sys.stderr.write("%s\n" % (fmt % args))


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), H)
    print(f"Admin: http://localhost:{PORT}/admin.html   (กด Ctrl+C เพื่อปิด)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
