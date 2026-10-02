#!/usr/bin/env python3
"""FlyBrain 本機伺服器 — 確保所有文字檔都以 UTF-8 送出，中文才不會變亂碼。"""
import http.server, socketserver, functools

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.html': 'text/html; charset=utf-8',
        '.js':   'text/javascript; charset=utf-8',
        '.css':  'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.svg':  'image/svg+xml; charset=utf-8',
    }
    def end_headers(self):
        # 關掉快取，改過的檔案才會立刻生效
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

class Server(socketserver.TCPServer):
    address_family = __import__('socket').AF_INET6
    allow_reuse_address = True

if __name__ == '__main__':
    # 綁 ::1（IPv6 loopback）：這台 Mac 的 IPv4 loopback 目前不通
    with Server(('::1', 8899), Handler) as httpd:
        print('FlyBrain 伺服器已啟動 → http://[::1]:8899/index.html')
        httpd.serve_forever()
