import os
import socket
import sys
import time
from pathlib import Path

SERVER_HOST = "127.0.0.1"
SERVER_PORT = 9003

BUFFER_SIZE = 64 * 1024  

def recv_line(sock: socket.socket) -> str:
    data = b""
    while True:
        ch = sock.recv(1)
        if not ch:
            raise ConnectionError("Server disconnected while reading line.")
        if ch == b"\n":
            break
        data += ch
        if len(data) > 10_000:
            raise ValueError("Line too long")
    return data.decode("utf-8", errors="ignore").strip()

def main():
    print("🧑‍💻 TCP File Upload Client")

    if len(sys.argv) < 2:
        print("Usage:")
        print("  python client.py <path_to_file>")
        sys.exit(1)

    file_path = Path(sys.argv[1]).expanduser().resolve()
    if not file_path.exists() or not file_path.is_file():
        print("❌ File not found:", file_path)
        sys.exit(1)

    filename = file_path.name
    total_size = file_path.stat().st_size

    print(f"➡️ Server: {SERVER_HOST}:{SERVER_PORT}")
    print(f"📄 File: {filename}")
    print(f"📦 Size: {total_size} bytes\n")

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.connect((SERVER_HOST, SERVER_PORT))

    try:
        # handshake
        ready = recv_line(sock)
        if ready != "READY":
            print("❌ Server not ready:", ready)
            return

        sock.sendall(f"FILENAME:{filename}\n".encode("utf-8"))
        sock.sendall(f"SIZE:{total_size}\n".encode("utf-8"))

        ok = recv_line(sock)
        if ok != "OK":
            print("❌ Server refused:", ok)
            return

        sent = 0
        start = time.time()
        last_print = time.time()

        with open(file_path, "rb") as f:
            while True:
                chunk = f.read(BUFFER_SIZE)
                if not chunk:
                    break
                sock.sendall(chunk)
                sent += len(chunk)

                now = time.time()
                if now - last_print >= 0.5:
                    pct = sent * 100 / total_size if total_size else 100
                    speed = sent / max(now - start, 1e-6) / 1024  # KB/s
                    print(f"⏳ Upload: {sent}/{total_size} ({pct:.1f}%) | {speed:.1f} KB/s")
                    last_print = now

        done = recv_line(sock)
        end = time.time()

        if done == "DONE":
            avg_speed = sent / max(end - start, 1e-6) / 1024
            print(f"\n✅ Upload finished! Sent {sent} bytes")
            print(f"⏱️ Time: {(end - start):.2f}s | Avg: {avg_speed:.1f} KB/s")
        else:
            print("\n❌ Upload failed:", done)

    finally:
        sock.close()

if __name__ == "__main__":
    main()
