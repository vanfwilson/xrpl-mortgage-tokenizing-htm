"""Read-only static server for /work/build (wasm files, build logs). No directory writes, no uploads."""
import http.server
import os
import sys

root, port = sys.argv[1], int(sys.argv[2])
os.chdir(root)


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):  # noqa: N802
        self.send_error(405)


http.server.ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
