"""Local server that mirrors vercel.json: app routes (/watch/..., /map, ...) serve index.html.
Run from the project root: python scripts/dev_server.py [port]"""
import http.server, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP_ROUTES = ("/watch/", "/map", "/problems", "/history")

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path.startswith(APP_ROUTES):
            self.path = "/index.html"
        return super().do_GET()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
print(f"serving {ROOT} on http://localhost:{port}")
http.server.ThreadingHTTPServer(("", port), Handler).serve_forever()
