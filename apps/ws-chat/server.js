import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3001);

const app = express();
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => res.json({ ok: true }));

const server = http.createServer(app);

// WebSocket server share same HTTP server
const wss = new WebSocketServer({ server });

// room -> Set(ws)
const rooms = new Map();

function joinRoom(ws, room) {
  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(ws);
  ws.room = room;
}

function leaveRoom(ws) {
  const room = ws.room;
  if (!room) return;
  const set = rooms.get(room);
  if (set) {
    set.delete(ws);
    if (set.size === 0) rooms.delete(room);
  }
  ws.room = null;
}

function broadcast(room, payloadObj) {
  const set = rooms.get(room);
  if (!set) return;
  const msg = JSON.stringify(payloadObj);
  for (const client of set) {
    if (client.readyState === 1) client.send(msg);
  }
}

wss.on("connection", (ws, req) => {
  ws.id = Math.random().toString(16).slice(2);
  ws.username = "guest_" + ws.id.slice(0, 4);
  ws.room = null;

  ws.send(JSON.stringify({
    type: "system",
    message: `Connected. Your temp name: ${ws.username}. Join a room first.`
  }));

  ws.on("message", (buf) => {
    let data;
    try {
      data = JSON.parse(buf.toString());
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      return;
    }

    // Protocol:
    // {type:"set_name", username:"..."}
    // {type:"join", room:"lop12"}
    // {type:"chat", content:"hello"}
    if (data.type === "set_name") {
      const name = String(data.username || "").trim();
      if (!name) {
        ws.send(JSON.stringify({ type: "error", message: "username required" }));
        return;
      }
      const old = ws.username;
      ws.username = name.slice(0, 30);
      ws.send(JSON.stringify({ type: "system", message: `Name set: ${ws.username}` }));
      if (ws.room) broadcast(ws.room, { type: "system", message: `${old} -> ${ws.username}` });
      return;
    }

    if (data.type === "join") {
      const room = String(data.room || "").trim();
      if (!room) {
        ws.send(JSON.stringify({ type: "error", message: "room required" }));
        return;
      }

      const prev = ws.room;
      if (prev) {
        broadcast(prev, { type: "system", message: `${ws.username} left room` });
        leaveRoom(ws);
      }

      joinRoom(ws, room);
      ws.send(JSON.stringify({ type: "system", message: `Joined room: ${room}` }));
      broadcast(room, { type: "system", message: `${ws.username} joined room` });
      return;
    }

    if (data.type === "chat") {
      if (!ws.room) {
        ws.send(JSON.stringify({ type: "error", message: "Join a room first" }));
        return;
      }
      const content = String(data.content || "").trim();
      if (!content) return;

      broadcast(ws.room, {
        type: "chat",
        room: ws.room,
        sender: ws.username,
        content,
        at: new Date().toISOString()
      });
      return;
    }

    ws.send(JSON.stringify({ type: "error", message: "Unknown type" }));
  });

  ws.on("close", () => {
    if (ws.room) {
      broadcast(ws.room, { type: "system", message: `${ws.username} disconnected` });
    }
    leaveRoom(ws);
  });
});
// Khởi động server WebSocket và lắng nghe kết nối client
server.listen(PORT, () => {
  console.log(`✅ WS Chat running: http://localhost:${PORT}`);
  console.log(`🔌 WS endpoint: ws://localhost:${PORT}`);
});
