import asyncio
import os
import signal

HOST = os.getenv('HOST', '0.0.0.0')
PORT = int(os.getenv('PORT', '9005'))

WELCOME = (
    "Welcome to ASYNC TCP Echo Server (asyncio)!\n"
    "- Send a line and server replies: ASYNC-ECHO: <line>\n"
    "- Type 'quit' to close.\n"
)

async def handle_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    addr = writer.get_extra_info('peername')
    print(f"✅ [CONNECT] {addr}")
    try:
        writer.write(WELCOME.encode('utf-8'))
        await writer.drain()

        while True:
            data = await reader.readline()
            if not data:
                print(f"🔌 [DISCONNECT] {addr}")
                break

            msg = data.decode('utf-8', errors='ignore').strip()
            print(f"📩 [RECV] {addr}: {msg}")

            if msg.lower() in ('quit', 'exit', 'q'):
                writer.write(b"Bye!\n")
                await writer.drain()
                break

            reply = f"ASYNC-ECHO: {msg}\n"
            writer.write(reply.encode('utf-8'))
            await writer.drain()

    except Exception as e:
        print(f"❌ [ERROR] {addr}: {e}")
    finally:
        try:
            writer.close()
            await writer.wait_closed()
        except Exception:
            pass
        print(f"✅ [CLOSE] {addr}")

async def main():
    server = await asyncio.start_server(handle_client, host=HOST, port=PORT)

    addrs = ', '.join(str(sock.getsockname()) for sock in server.sockets or [])
    print("🚀 Starting ASYNC TCP Echo Server...")
    print(f"📡 Listening on {addrs}")

    stop_event = asyncio.Event()

    def _stop(*_args):
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _stop)
        except NotImplementedError:
            pass

    async with server:
        await stop_event.wait()

    print("🛑 Server stopping...")

if __name__ == '__main__':
    asyncio.run(main())
