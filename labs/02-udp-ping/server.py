import socket
import time

HOST = "0.0.0.0"
PORT = 9002

def main():
    print("🚀 Starting UDP Ping Server...")
    print(f"📡 Listening on {HOST}:{PORT}")

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind((HOST, PORT))

    try:
        while True:
            data, addr = sock.recvfrom(4096)
            recv_time = time.time()

            msg = data.decode("utf-8", errors="ignore").strip()
            print(f"📩 [RECV] {addr}: {msg}")

            # client có thể gửi "quit" nhưng UDP server vẫn chạy (stateless)
            if msg.lower().startswith("ping"):
                # phản hồi kèm timestamp để client tính RTT
                reply = f"PONG {msg} server_time={recv_time}"
            else:
                reply = f"UNKNOWN '{msg}' server_time={recv_time}"

            sock.sendto(reply.encode("utf-8"), addr)
            print(f"📤 [SEND] {addr}: {reply}")

    except KeyboardInterrupt:
        print("\n🛑 Server stopped by Ctrl+C")
    finally:
        sock.close()

if __name__ == "__main__":
    main()
