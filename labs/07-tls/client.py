import socket
import ssl

SERVER_HOST = "127.0.0.1"
SERVER_PORT = 9443

CA_CERT = "cert/server.crt"

def main():
    print("🧑‍💻 TLS Echo Client")
    print(f"➡️ Server: {SERVER_HOST}:{SERVER_PORT}")

    context = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
    context.load_verify_locations(CA_CERT)

    with socket.create_connection((SERVER_HOST, SERVER_PORT)) as sock:
        with context.wrap_socket(sock, server_hostname="localhost") as ssock:
            print("🔐 TLS established:", ssock.version())

            welcome = ssock.recv(4096).decode("utf-8", errors="ignore")
            print("📨 Server:", welcome.strip())

            while True:
                msg = input("You> ").strip()
                if not msg:
                    continue

                ssock.sendall((msg + "\n").encode("utf-8"))
                reply = ssock.recv(4096).decode("utf-8", errors="ignore")
                print("Server>", reply.strip())

                if msg.lower() in ("quit", "exit", "q"):
                    break

    print("🔌 Disconnected.")

if __name__ == "__main__":
    main()
