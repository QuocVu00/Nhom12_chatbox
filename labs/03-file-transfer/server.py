import os
import socket
import threading
import time
from pathlib import Path

HOST = "0.0.0.0"
PORT = 9003

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

BUFFER_SIZE = 64 * 1024  

def recv_line(conn: socket.socket) -> str:
    """Read until '\n'."""
    data = b""
    while True:
        ch = conn.recv(1)
        if not ch:
            raise ConnectionError("Client disconnected while reading line.")
        if ch == b"\n":
            break
        data += ch
        if len(data) > 10_000:
            raise ValueError("Header line too long")
    return data.decode("utf-8", errors="ignore").strip()

def safe_filename(name: str) -> str:
    name = name.replace("\\", "/").split("/")[-1]
    name = "".join(c for c in name if c.isalnum() or c in ("-", "_", ".", " "))
    return name.strip() or f"file_{int(time.time())}"

def handle_client(conn: socket.socket, addr):
    print(f"✅ [CONNECT] {addr}")
    conn.settimeout(300)

    try:
        with conn:
            conn.sendall(b"READY\n")

            # Header format:
            # FILENAME:<name>\n
            # SIZE:<bytes>\n
            filename_line = recv_line(conn)
            size_line = recv_line(conn)

            if not filename_line.startswith("FILENAME:"):
                conn.sendall(b"ERROR Invalid header (FILENAME)\n")
                return
            if not size_line.startswith("SIZE:"):
                conn.sendall(b"ERROR Invalid header (SIZE)\n")
                return

            raw_name = filename_line.split(":", 1)[1].strip()
            total_size = int(size_line.split(":", 1)[1].strip())

            filename = safe_filename(raw_name)
            save_path = UPLOAD_DIR / filename

            # Nếu trùng tên -> thêm timestamp
            if save_path.exists():
                stem = save_path.stem
                suffix = save_path.suffix
                save_path = UPLOAD_DIR / f"{stem}_{int(time.time())}{suffix}"

            conn.sendall(b"OK\n")
            print(f"📥 [UPLOAD START] {addr} -> {save_path.name} ({total_size} bytes)")

            received = 0
            with open(save_path, "wb") as f:
                last_print = time.time()
                while received < total_size:
                    chunk = conn.recv(min(BUFFER_SIZE, total_size - received))
                    if not chunk:
                        raise ConnectionError("Client disconnected during file transfer.")
                    f.write(chunk)
                    received += len(chunk)

                    # progress mỗi ~0.5s
                    now = time.time()
                    if now - last_print >= 0.5:
                        pct = received * 100 / total_size if total_size else 100
                        print(f"⏳ [PROGRESS] {save_path.name}: {received}/{total_size} ({pct:.1f}%)")
                        last_print = now

            conn.sendall(b"DONE\n")
            print(f"✅ [UPLOAD DONE] {save_path.name} saved ({received} bytes)")

    except Exception as e:
        print(f"❌ [ERROR] {addr}: {e}")
        try:
            conn.sendall(f"ERROR {e}\n".encode("utf-8", errors="ignore"))
        except:
            pass
    finally:
        try:
            conn.close()
        except:
            pass

def main():
    print("🚀 Starting TCP File Transfer Server...")
    print(f"📡 Listening on {HOST}:{PORT}")
    print(f"📁 Upload dir: {UPLOAD_DIR}")

    server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server_sock.bind((HOST, PORT))
    server_sock.listen(50)

    try:
        while True:
            conn, addr = server_sock.accept()
            t = threading.Thread(target=handle_client, args=(conn, addr), daemon=True)
            t.start()
            print(f"🧵 [THREAD] Active threads: {threading.active_count() - 1}")
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by Ctrl+C")
    finally:
        server_sock.close()

if __name__ == "__main__":
    main()
