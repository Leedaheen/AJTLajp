"""개발용 HTTP 서버 — Cache-Control: no-cache 헤더 강제 설정"""
import http.server
import socketserver
import os

PORT = 5500

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        # JS/CSS 파일만 로그 출력
        if any(self.path.endswith(ext) for ext in ('.html', '.js', '.css')):
            super().log_message(format, *args)

os.chdir(os.path.dirname(os.path.abspath(__file__)))
with socketserver.TCPServer(('', PORT), NoCacheHandler) as httpd:
    print(f'Dev server: http://localhost:{PORT}')
    httpd.serve_forever()
