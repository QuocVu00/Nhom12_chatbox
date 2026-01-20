import json
import os
import socket
import struct
import threading
import time
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = os.getenv('HOST', '0.0.0.0')
HTTP_PORT = int(os.getenv('HTTP_PORT', '9011'))

# Multicast
MCAST_GROUP = os.getenv('MCAST_GROUP', '239.10.10.10')
MCAST_PORT = int(os.getenv('MCAST_PORT', '9010'))
MCAST_TTL = int(os.getenv('MCAST_TTL', '1'))

# Broadcast
BCAST_PORT = int(os.getenv('BCAST_PORT', '9012'))

MAX_FEED = int(os.getenv('MAX_FEED', '200'))

_feed = deque(maxlen=MAX_FEED)
_feed_lock = threading.Lock()


def _now_iso():
    return time.strftime('%Y-%m-%dT%H:%M:%S', time.localtime())


def add_event(kind: str, message: str, addr=None):
    item = {
        't': _now_iso(),
        'type': kind,
        'message': str(message or ''),
        'from': None,
    }
    if addr:
        try:
            item['from'] = f"{addr[0]}:{addr[1]}"
        except Exception:
            item['from'] = str(addr)

    with _feed_lock:
        _feed.append(item)


def listen_multicast():
    # Reference: join IPv4 multicast group
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

    try:
        sock.bind((HOST, MCAST_PORT))
    except OSError:
        # Some systems require bind to '' instead of 0.0.0.0
        sock.bind(('', MCAST_PORT))

    mreq = struct.pack('4s4s', socket.inet_aton(MCAST_GROUP), socket.inet_aton('0.0.0.0'))
    sock.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)

    print(f"📡 [MCAST] Listening {MCAST_GROUP}:{MCAST_PORT}")

    while True:
        data, addr = sock.recvfrom(8192)
        msg = data.decode('utf-8', errors='ignore').strip()
        print(f"📩 [MCAST RECV] {addr}: {msg}")
        add_event('multicast', msg, addr)


def listen_broadcast():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

    try:
        sock.bind((HOST, BCAST_PORT))
    except OSError:
        sock.bind(('', BCAST_PORT))

    print(f"📡 [BCAST] Listening 0.0.0.0:{BCAST_PORT}")

    while True:
        data, addr = sock.recvfrom(8192)
        msg = data.decode('utf-8', errors='ignore').strip()
        print(f"📩 [BCAST RECV] {addr}: {msg}")
        add_event('broadcast', msg, addr)


def send_multicast(message: str):
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
    sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, MCAST_TTL)
    sock.sendto(str(message).encode('utf-8'), (MCAST_GROUP, MCAST_PORT))
    sock.close()


def send_broadcast(message: str):
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    sock.sendto(str(message).encode('utf-8'), ('255.255.255.255', BCAST_PORT))
    sock.close()


class Handler(BaseHTTPRequestHandler):
    def _json(self, code: int, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('content-type', 'application/json; charset=utf-8')
        self.send_header('content-length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        n = int(self.headers.get('content-length') or 0)
        raw = self.rfile.read(n) if n > 0 else b''
        if not raw:
            return {}
        try:
            return json.loads(raw.decode('utf-8', errors='ignore'))
        except Exception:
            return {}

    def do_GET(self):
        path = self.path.split('?', 1)[0]
        if path == '/health':
            return self._json(200, {
                'ok': True,
                'http': HTTP_PORT,
                'multicast': {'group': MCAST_GROUP, 'port': MCAST_PORT},
                'broadcast': {'port': BCAST_PORT},
            })

        if path == '/feed':
            # /feed?type=multicast|broadcast|all&limit=50
            q = {}
            if '?' in self.path:
                qs = self.path.split('?', 1)[1]
                for part in qs.split('&'):
                    if '=' in part:
                        k, v = part.split('=', 1)
                        q[k] = v
            kind = (q.get('type') or 'all').lower()
            try:
                limit = int(q.get('limit') or '100')
            except Exception:
                limit = 100
            limit = max(1, min(limit, MAX_FEED))

            with _feed_lock:
                arr = list(_feed)

            if kind in ('multicast', 'broadcast'):
                arr = [x for x in arr if x.get('type') == kind]

            return self._json(200, {'ok': True, 'items': arr[-limit:]})

        return self._json(404, {'ok': False, 'error': 'Not found'})

    def do_POST(self):
        path = self.path.split('?', 1)[0]
        data = self._read_json()

        if path == '/send/multicast':
            msg = str(data.get('message') or '').strip()
            if not msg:
                return self._json(400, {'ok': False, 'error': 'Missing message'})
            send_multicast(msg)
            add_event('multicast', msg, ('self', 0))
            return self._json(200, {'ok': True})

        if path == '/send/broadcast':
            msg = str(data.get('message') or '').strip()
            if not msg:
                return self._json(400, {'ok': False, 'error': 'Missing message'})
            send_broadcast(msg)
            add_event('broadcast', msg, ('self', 0))
            return self._json(200, {'ok': True})

        return self._json(404, {'ok': False, 'error': 'Not found'})


def main():
    print('🚀 Starting Broadcast & Multicast Bus...')
    print(f"🌐 HTTP: http://{HOST}:{HTTP_PORT}")

    threading.Thread(target=listen_multicast, daemon=True).start()
    threading.Thread(target=listen_broadcast, daemon=True).start()

    httpd = ThreadingHTTPServer((HOST, HTTP_PORT), Handler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('🛑 Stopping...')


if __name__ == '__main__':
    main()
