import socket
import ssl
import threading

HOST = "0.0.0.0"
PORT = 9443

CERT_FILE = "cert/server.crt"
KEY_FILE = "cert/server.key"

def handle_client(conn: ssl.SSLSocket, addr):
    print(f"✅ [TLS CONNECT] {addr}")
    try:
        conn.sendall(b"Welcome TLS Server! Type 'quit' to exit.\n")

        while True:
            data = conn.recv(4096)
            if not data:
                print(f"🔌 [DISCONNECT] {addr}")
                break

            msg = data.decode("utf-8", errors="ignore").strip()
            print(f"📩 [RECV] {addr}: {msg}")

            if msg.lower() in ("quit", "exit", "q"):
                conn.sendall(b"Bye TLS!\n")
                break

            conn.sendall(f"TLS-ECHO: {msg}\n".encode("utf-8"))
    except Exception as e:
        print(f"❌ [ERROR] {addr}: {e}")
    finally:
        try:
            conn.shutdown(socket.SHUT_RDWR)
        except:
            pass
        conn.close()

def main():
    print("🚀 Starting TLS Echo Server...")
    print(f"📡 Listening on {HOST}:{PORT}")
    print(f"🔐 Cert: {CERT_FILE}")
    print(f"🔑 Key : {KEY_FILE}")

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((HOST, PORT))
    sock.listen(50)

    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=CERT_FILE, keyfile=KEY_FILE)

    try:
        while True:
            client_sock, addr = sock.accept()
            try:
                tls_conn = context.wrap_socket(client_sock, server_side=True)
            except ssl.SSLError as e:
                print(f"❌ [TLS HANDSHAKE FAIL] {addr}: {e}")
                client_sock.close()
                continue

            threading.Thread(target=handle_client, args=(tls_conn, addr), daemon=True).start()
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by Ctrl+C")
    finally:
        sock.close()

if __name__ == "__main__":
    main()
