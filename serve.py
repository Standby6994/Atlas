"""Local development server for Atlas Humano.

Serves this folder without HTTP caching (edits show up on reload) and listens
on the local network so an iPad on the same Wi-Fi can open the printed address.
Offline mode needs HTTPS, so it stays off on the network address.

    python serve.py [port]
"""
import http.server
import socket
import sys
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".wasm": "application/wasm",
        ".glb": "model/gltf-binary",
        ".webmanifest": "application/manifest+json",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def lan_address():
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
        try:
            probe.connect(("10.255.255.255", 1))
            return probe.getsockname()[0]
        except OSError:
            return None


if __name__ == "__main__":
    server = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), partial(NoCacheHandler, directory=str(ROOT)))
    print(f"Neste computador: http://localhost:{PORT}", flush=True)
    if address := lan_address():
        print(f"No iPad (mesma rede Wi-Fi): http://{address}:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
