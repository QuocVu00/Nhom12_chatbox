import dotenv from "dotenv";
dotenv.config();

import express from "express";
import jwt from "jsonwebtoken";

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 3002);
const JWT_SECRET = process.env.JWT_SECRET || "secret123";

// ====== Helpers ======
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

function auth(req, res, next) {
  const h = req.headers["authorization"] || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid/expired token" });
  }
}

// ====== Routes ======
app.get("/health", (req, res) => res.json({ ok: true }));

// login giả lập (để demo )
// POST /auth/login { "username": "tung" }
app.post("/auth/login", (req, res) => {
  const username = String(req.body?.username || "").trim();
  if (!username) return res.status(400).json({ error: "username required" });

  const token = signToken({ username, role: "student" });
  res.json({ token });
});

// protected endpoint
app.get("/me", auth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// demo CRUD memory (không DB) để bạn hiểu REST
let items = [
  { id: 1, name: "networking", note: "TCP/UDP" },
  { id: 2, name: "security", note: "TLS/SSL" }
];
let nextId = 3;

app.get("/items", (req, res) => res.json(items));

app.post("/items", auth, (req, res) => {
  const name = String(req.body?.name || "").trim();
  const note = String(req.body?.note || "").trim();
  if (!name) return res.status(400).json({ error: "name required" });

  const item = { id: nextId++, name, note };
  items.push(item);
  res.status(201).json(item);
});

app.put("/items/:id", auth, (req, res) => {
  const id = Number(req.params.id);
  const idx = items.findIndex((x) => x.id === id);
  if (idx === -1) return res.status(404).json({ error: "not found" });

  const name = String(req.body?.name || items[idx].name).trim();
  const note = String(req.body?.note || items[idx].note).trim();
  items[idx] = { ...items[idx], name, note };
  res.json(items[idx]);
});

app.delete("/items/:id", auth, (req, res) => {
  const id = Number(req.params.id);
  const idx = items.findIndex((x) => x.id === id);
  if (idx === -1) return res.status(404).json({ error: "not found" });

  const deleted = items[idx];
  items.splice(idx, 1);
  res.json({ ok: true, deleted });
});

app.listen(PORT, () => {
  console.log(`✅ HTTP API running: http://localhost:${PORT}`);
});
