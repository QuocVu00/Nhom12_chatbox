import socket

SERVER_HOST = "127.0.0.1"
SERVER_PORT = 9001

def main():
    print("🧑‍💻 TCP Echo Client")
    print(f"➡️ Connecting to {SERVER_HOST}:{SERVER_PORT}")

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.connect((SERVER_HOST, SERVER_PORT))

    try:
        welcome = sock.recv(4096).decode("utf-8", errors="ignore")
        print("📨 Server:", welcome.strip())

        while True:
            msg = input("You> ").strip()
            if not msg:
                continue

            sock.sendall((msg + "\n").encode("utf-8"))

            reply = sock.recv(4096).decode("utf-8", errors="ignore")
            print("Server>", reply.strip())

            if msg.lower() in ("quit", "exit", "q"):
                break
    finally:
        sock.close()
        print("🔌 Disconnected.")


if __name__ == "__main__":
    main()
