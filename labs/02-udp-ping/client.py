import socket
import time

SERVER_HOST = "127.0.0.1"
SERVER_PORT = 9002

PING_COUNT = 10
TIMEOUT_SEC = 1.0

def main():
    print("🧑‍💻 UDP Ping Client")
    print(f"➡️ Server: {SERVER_HOST}:{SERVER_PORT}")
    print(f"⏱️ Timeout: {TIMEOUT_SEC}s | Count: {PING_COUNT}\n")

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(TIMEOUT_SEC)

    sent = 0
    received = 0
    rtts = []

    for seq in range(1, PING_COUNT + 1):
        msg = f"PING seq={seq} time={time.time()}"
        sent += 1

        start = time.time()
        try:
            sock.sendto(msg.encode("utf-8"), (SERVER_HOST, SERVER_PORT))
            data, _ = sock.recvfrom(4096)
            end = time.time()

            rtt_ms = (end - start) * 1000.0
            rtts.append(rtt_ms)
            received += 1

            reply = data.decode("utf-8", errors="ignore").strip()
            print(f"✅ Reply seq={seq} | RTT={rtt_ms:.2f} ms | {reply}")

        except socket.timeout:
            print(f"❌ Timeout seq={seq} (no reply within {TIMEOUT_SEC}s)")

        time.sleep(0.5)

    sock.close()

    lost = sent - received
    loss_rate = (lost / sent) * 100.0

    print("\n====== UDP PING SUMMARY ======")
    print(f"Packets: sent={sent}, received={received}, lost={lost} ({loss_rate:.1f}% loss)")
    if rtts:
        print(f"RTT(ms): min={min(rtts):.2f}  avg={sum(rtts)/len(rtts):.2f}  max={max(rtts):.2f}")
    print("==============================")

if __name__ == "__main__":
    main()
