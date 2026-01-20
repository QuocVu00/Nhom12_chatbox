import socket
import threading
import time

HOST = "0.0.0.0"
PORT = 9001

def handle_client(conn: socket.socket, addr):
    print(f"✅ [CONNECT] Client connected: {addr}")
    conn.settimeout(300)

    try:
        with conn:
            conn.sendall(b"Welcome to TCP Echo Server! Type 'quit' to exit.\n")
            while True:
                data = conn.recv(4096)
                if not data:
                    print(f"🔌 [DISCONNECT] {addr} closed connection.")
                    break

                msg = data.decode("utf-8", errors="ignore").strip()
                print(f"📩 [RECV] {addr}: {msg}")

                if msg.lower() in ("quit", "exit", "q"):
                    conn.sendall(b"Bye!\n")
                    print(f"👋 [QUIT] {addr} requested quit.")
                    break

                # Echo back
                reply = f"ECHO: {msg}\n"
                conn.sendall(reply.encode("utf-8"))

    except socket.timeout:
        print(f"⏳ [TIMEOUT] {addr} timeout.")
    except ConnectionResetError:
        print(f"⚠️ [RESET] {addr} connection reset.")
    except Exception as e:
        print(f"❌ [ERROR] {addr}: {e}")
    finally:
        try:
            conn.close()
        except:
            pass


def main():
    print("🚀 Starting TCP Echo Server...")
    print(f"📡 Listening on {HOST}:{PORT}")

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
