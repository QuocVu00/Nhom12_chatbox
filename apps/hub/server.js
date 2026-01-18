import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import https from 'https';
import path from 'path';
import fs from 'fs';
import net from 'net';
import tls from 'tls';
import dgram from 'dgram';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import mysql from 'mysql2/promise';
import nodemailer from 'nodemailer';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =========================
// ENV
// =========================
const PORT = Number(process.env.PORT || 8080);
const USE_HTTPS = String(process.env.USE_HTTPS || '') === '1';
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 8443);
const TLS_KEY_PATH = process.env.TLS_KEY_PATH || path.join(__dirname, 'cert', 'server.key');
const TLS_CERT_PATH = process.env.TLS_CERT_PATH || path.join(__dirname, 'cert', 'server.crt');

const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// DB
const DB_HOST = process.env.DB_HOST || 'mysql';
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'netprog';

// Tools targets
const TCP_HOST = process.env.TCP_HOST || 'tcp-echo';
const TCP_PORT = Number(process.env.TCP_PORT || 9001);
const UDP_HOST = process.env.UDP_HOST || 'udp-ping';
const UDP_PORT = Number(process.env.UDP_PORT || 9002);
const TLS_HOST = process.env.TLS_HOST || 'tls-echo';
const TLS_PORT = Number(process.env.TLS_PORT || 9443);
const ASYNC_HOST = process.env.ASYNC_HOST || 'async-echo';
const ASYNC_PORT = Number(process.env.ASYNC_PORT || 9005);

// Broadcast/Multicast bus
const MCAST_HOST = process.env.MCAST_HOST || 'mcast-bus';
const MCAST_HTTP_PORT = Number(process.env.MCAST_HTTP_PORT || 9011);
const MCAST_GROUP = process.env.MCAST_GROUP || '239.10.10.10';
const MCAST_PORT = Number(process.env.MCAST_PORT || 9010);
const BCAST_PORT = Number(process.env.BCAST_PORT || 9012);

// Email
const SMTP_HOST = process.env.SMTP_HOST || 'mailhog';
const SMTP_PORT = Number(process.env.SMTP_PORT || 1025);
const MAIL_FROM = process.env.MAIL_FROM || 'chatbox@local';

// gRPC
const GRPC_HOST = process.env.GRPC_HOST || 'grpc';
const GRPC_PORT = Number(process.env.GRPC_PORT || 50051);

// AI (Gemini REST)
const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || '').trim();
const GEMINI_MODEL = String(process.env.GEMINI_MODEL || 'gemini-1.5-flash').trim();
const GEMINI_SYSTEM = String(process.env.GEMINI_SYSTEM || '').trim();

// Upload
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// =========================
// Email verify helpers
// =========================
const mailer = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: false,
  tls: { rejectUnauthorized: false },
});

function isValidEmail(email) {
  const s = String(email || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

function genVerifyCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

async function sendVerifyEmail({ to, username, code }) {
  const subject = 'Xác thực email - Chatbox';
  const text =
`Xin chào ${username},
Mã xác thực email của bạn là: ${code}

Mở Mailhog để xem mail (local):
http://localhost:8025

Nếu bạn không đăng ký, hãy bỏ qua email này.`;

  await mailer.sendMail({ from: MAIL_FROM, to, subject, text });
}

// =========================
// DB pool
// =========================
const db = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// =========================
// Express
// =========================
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  express.static(path.join(__dirname, 'public'), {
    extensions: ['html'],
    index: false,
  })
);

// =========================
// Filename helpers (mojibake + Content-Disposition)
// =========================
function looksLikeMojibake(s) {
  const str = String(s || '');
  return /[ÃÂÄÐÞ]/.test(str) || /Ã.|Â.|Ä.|Ð.|á»|áº/.test(str);
}

function fixMojibake(s) {
  const str = String(s || '');
  if (!str) return str;
  if (!looksLikeMojibake(str)) return str;
  try {
    const buf = Buffer.from(str, 'latin1');
    const utf8 = buf.toString('utf8');
    if (!utf8 || utf8.includes('�')) return str;
    return utf8;
  } catch {
    return str;
  }
}

function sanitizeHeaderFilename(name) {
  let s = String(name || 'file');
  s = s.replace(/[\r\n]/g, ' ');
  s = s.replace(/["\\]/g, '_');
  s = s.trim();
  if (!s) s = 'file';
  return s;
}

function encodeRFC5987ValueChars(str) {
  return encodeURIComponent(str)
    .replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/\*/g, '%2A');
}

function contentDispositionAttachment(filename) {
  const clean = sanitizeHeaderFilename(filename);
  const utf8 = encodeRFC5987ValueChars(clean);
  const asciiFallback = clean.replace(/[^\x20-\x7E]+/g, '_') || 'file';
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${utf8}`;
}

// =========================
// Multer
// =========================
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = String(file.originalname || 'file').replace(/[^a-zA-Z0-9._-]+/g, '_');
    const name = `${Date.now()}_${Math.random().toString(16).slice(2)}_${safe}`;
    cb(null, name);
  },
});
const upload = multer({ storage });

// =========================
// Auth helpers
// =========================
function getTokenFromReq(req) {
  const h = String(req.headers.authorization || '');
  if (h.startsWith('Bearer ')) return h.slice('Bearer '.length).trim();

  const q = req.query?.token;
  if (typeof q === 'string' && q.trim()) return q.trim();

  return '';
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const token = getTokenFromReq(req);
  const decoded = verifyToken(token);
  if (!decoded?.username) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  req.user = { username: decoded.username };
  next();
}

// =========================
// DB init sanity
// =========================
async function initDb() {
  await db.query('SELECT 1');
}

// =========================
// Rooms helpers
// =========================
function makeDmKey(a, b) {
  const arr = [String(a), String(b)].map(x => x.trim()).filter(Boolean).sort((x, y) => x.localeCompare(y));
  return arr.join('#');
}

async function createOrGetDmRoom(me, other) {
  const dmKey = makeDmKey(me, other);
  if (!dmKey || dmKey.includes('##')) throw new Error('Invalid users');

  const [ins] = await db.query(
    `INSERT INTO rooms (type, name, created_by, dm_key)
     VALUES ('dm', ?, ?, ?)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [dmKey, me, dmKey]
  );

  const roomId = Number(ins.insertId);
  await db.query(
    'INSERT IGNORE INTO room_members (room_id, username) VALUES (?, ?), (?, ?)',
    [roomId, me, roomId, other]
  );
  return roomId;
}

async function createGroupRoom(me, name, members) {
  const groupName = String(name || '').trim();
  if (!groupName) throw new Error('Thiếu tên nhóm');

  const [ins] = await db.query(
    `INSERT INTO rooms (type, name, created_by, dm_key)
     VALUES ('group', ?, ?, NULL)`,
    [groupName, me]
  );
  const roomId = Number(ins.insertId);

  const allMembers = Array.from(new Set([me, ...(members || [])].map(x => String(x).trim()).filter(Boolean)));
  if (allMembers.length < 1) throw new Error('Thiếu thành viên');

  const values = [];
  const params = [];
  for (const u of allMembers) {
    values.push('(?, ?)');
    params.push(roomId, u);
  }
  await db.query(`INSERT IGNORE INTO room_members (room_id, username) VALUES ${values.join(',')}`, params);
  return roomId;
}

async function ensureRoomMember(roomId, username) {
  const [rows] = await db.query(
    'SELECT 1 FROM room_members WHERE room_id=? AND username=? LIMIT 1',
    [roomId, username]
  );
  return rows.length > 0;
}

async function fetchMessages(roomId, limit = 200) {
  const lim = Math.max(1, Math.min(Number(limit) || 200, 500));
  const [rows] = await db.query(
    `SELECT m.id, m.room_id, m.sender, m.content, m.attachment_id, m.created_at,
            a.original_name AS attachmentName, a.mime_type AS attachmentType
     FROM messages m
     LEFT JOIN attachments a ON a.id = m.attachment_id
     WHERE m.room_id=?
     ORDER BY m.id ASC
     LIMIT ?`,
    [roomId, lim]
  );

  for (const r of rows) {
    if (r?.attachmentName) r.attachmentName = fixMojibake(r.attachmentName);
  }
  return rows;
}

async function insertMessage({ roomId, sender, content = '', attachmentId = null }) {
  const [ins] = await db.query(
    'INSERT INTO messages (room_id, sender, content, attachment_id) VALUES (?, ?, ?, ?)',
    [roomId, sender, content || null, attachmentId]
  );
  const id = Number(ins.insertId);

  const [rows] = await db.query(
    `SELECT m.id, m.room_id, m.sender, m.content, m.attachment_id, m.created_at,
            a.original_name AS attachmentName, a.mime_type AS attachmentType
     FROM messages m
     LEFT JOIN attachments a ON a.id = m.attachment_id
     WHERE m.id=? LIMIT 1`,
    [id]
  );

  const msg = rows[0];
  if (msg?.attachmentName) msg.attachmentName = fixMojibake(msg.attachmentName);
  return msg;
}
// =========================
// Socket.io
// =========================
const httpServer = http.createServer(app);

let httpsServer = null;
if (USE_HTTPS) {
  const key = fs.readFileSync(TLS_KEY_PATH);
  const cert = fs.readFileSync(TLS_CERT_PATH);
  httpsServer = https.createServer({ key, cert }, app);
}

const io = new Server(USE_HTTPS ? httpsServer : httpServer, {
  cors: { origin: '*' },
});

// presence tracking (username -> count)
const onlineCount = new Map();

function setUserOnline(username) {
  const u = String(username || '').trim();
  if (!u) return;
  const prev = onlineCount.get(u) || 0;
  onlineCount.set(u, prev + 1);
  if (prev === 0) io.emit('presence:update', { user: u, online: true });
  io.emit('presence:full', { users: Array.from(onlineCount.keys()) });
}

function setUserOffline(username) {
  const u = String(username || '').trim();
  if (!u) return;
  const prev = onlineCount.get(u) || 0;
  const next = Math.max(0, prev - 1);
  if (next === 0) {
    onlineCount.delete(u);
    io.emit('presence:update', { user: u, online: false });
  } else {
    onlineCount.set(u, next);
  }
  io.emit('presence:full', { users: Array.from(onlineCount.keys()) });
}

io.use((socket, next) => {
  const token = String(socket.handshake.auth?.token || '').trim();
  if (!token) return next();
  const decoded = verifyToken(token);
  if (decoded?.username) socket.data.user = decoded.username;
  return next();
});

function emitPresenceList(socket) {
  socket.emit('presence:list:result', { users: Array.from(onlineCount.keys()) });
}

function emitMessageToRoom(roomId, msg) {
  io.to(`room:${roomId}`).emit('message:new', msg);
  io.to(`room:${roomId}`).emit('msg:new', msg);
}

io.on('connection', (socket) => {
  const username = String(socket.data.user || '').trim();
  if (username) setUserOnline(username);

  socket.on('presence:list', (_payload, cb) => {
    emitPresenceList(socket);
    if (typeof cb === 'function') cb({ ok: true });
  });

  socket.on('room:join', (roomId, cb) => {
    const rid = Number(roomId);
    if (!rid) {
      if (typeof cb === 'function') cb({ ok: false });
      return;
    }
    socket.join(`room:${rid}`);
    if (typeof cb === 'function') cb({ ok: true });
  });

  socket.on('msg:send', async (p, cb) => {
    try {
      const user = String(socket.data.user || '').trim();
      if (!user) return cb?.({ ok: false, error: 'Unauthorized' });

      const roomId = Number(p?.roomId);
      const content = String(p?.content || '').trim();
      if (!roomId || !content) return cb?.({ ok: false, error: 'Invalid' });

      if (!(await ensureRoomMember(roomId, user))) return cb?.({ ok: false, error: 'Not member' });

      const msg = await insertMessage({ roomId, sender: user, content });
      emitMessageToRoom(roomId, msg);
      io.emit('rooms:changed');
      cb?.({ ok: true, message: msg });
    } catch (e) {
      cb?.({ ok: false, error: e?.message || 'Send error' });
    }
  });

  socket.on('disconnect', () => {
    if (username) setUserOffline(username);
  });
});

// =========================
// REST API
// =========================
app.get('/health', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'db error' });
  }
});

// ---------- Auth ----------
app.post('/api/register', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!username || !email || !password) {
      return res.status(400).json({ ok: false, error: 'Thiếu username/email/password' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ ok: false, error: 'Email không hợp lệ' });
    }
    if (password.length < 4) {
      return res.status(400).json({ ok: false, error: 'Mật khẩu tối thiểu 4 ký tự' });
    }

    const hash = await bcrypt.hash(password, 10);
    const code = genVerifyCode();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await db.query(
      `INSERT INTO users (username, email, password_hash, email_verified, verify_code, verify_expires_at)
       VALUES (?, ?, ?, 0, ?, ?)`,
      [username, email, hash, code, expires]
    );

    try {
      await sendVerifyEmail({ to: email, username, code });
    } catch {
      return res.json({
        ok: true,
        needsVerify: true,
        warn: 'Đăng ký thành công nhưng gửi email thất bại. Kiểm tra Mailhog/docker.',
      });
    }

    return res.json({ ok: true, needsVerify: true });
  } catch (e) {
    const msg = String(e?.message || 'Register error').toLowerCase();
    if (e?.code === 'ER_DUP_ENTRY' || msg.includes('duplicate')) {
      if (msg.includes('uk_users_email') || msg.includes('email')) {
        return res.status(400).json({ ok: false, error: 'Email đã được sử dụng' });
      }
      return res.status(400).json({ ok: false, error: 'Username đã tồn tại' });
    }
    return res.status(500).json({ ok: false, error: e?.message || 'Register error' });
  }
});

app.post('/api/verify-email', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const code = String(req.body.code || '').trim();

    if (!username || !code) return res.status(400).json({ ok: false, error: 'Thiếu username/mã' });

    const [rows] = await db.query(
      'SELECT username, email, email_verified, verify_code, verify_expires_at FROM users WHERE username=? LIMIT 1',
      [username]
    );
    const u = rows[0];
    if (!u) return res.status(404).json({ ok: false, error: 'Không tìm thấy tài khoản' });

    if (!u.email) return res.status(400).json({ ok: false, error: 'Tài khoản chưa có email' });
    if (Number(u.email_verified) === 1) return res.json({ ok: true });

    const exp = u.verify_expires_at ? new Date(u.verify_expires_at).getTime() : 0;
    if (!u.verify_code || String(u.verify_code) !== code) {
      return res.status(400).json({ ok: false, error: 'Mã xác thực không đúng' });
    }
    if (!exp || Date.now() > exp) {
      return res.status(400).json({ ok: false, error: 'Mã đã hết hạn. Hãy gửi lại mã.' });
    }

    await db.query(
      'UPDATE users SET email_verified=1, verify_code=NULL, verify_expires_at=NULL WHERE username=?',
      [username]
    );
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'Verify error' });
  }
});

app.post('/api/verify-email/resend', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    if (!username) return res.status(400).json({ ok: false, error: 'Thiếu username' });

    const [rows] = await db.query(
      'SELECT username, email, email_verified FROM users WHERE username=? LIMIT 1',
      [username]
    );
    const u = rows[0];
    if (!u) return res.status(404).json({ ok: false, error: 'Không tìm thấy tài khoản' });
    if (!u.email) return res.status(400).json({ ok: false, error: 'Tài khoản chưa có email' });
    if (Number(u.email_verified) === 1) return res.json({ ok: true });

    const code = genVerifyCode();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await db.query('UPDATE users SET verify_code=?, verify_expires_at=? WHERE username=?', [code, expires, username]);

    await sendVerifyEmail({ to: u.email, username, code });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'Resend error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    if (!username || !password) {
      return res.status(400).json({ ok: false, error: 'Thiếu username/password' });
    }

    const [rows] = await db.query(
      'SELECT username, email, email_verified, password_hash FROM users WHERE username=? LIMIT 1',
      [username]
    );
    const user = rows[0];

    if (!user) return res.status(401).json({ ok: false, error: 'Sai tài khoản hoặc mật khẩu' });

    const passOk = await bcrypt.compare(password, user.password_hash);
    if (!passOk) return res.status(401).json({ ok: false, error: 'Sai tài khoản hoặc mật khẩu' });

    if (user.email && Number(user.email_verified) === 0) {
      return res.status(403).json({
        ok: false,
        needVerify: true,
        username,
        error: 'Bạn chưa xác thực email. Mở Mailhog (http://localhost:8025) lấy mã rồi xác thực.',
      });
    }

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ ok: true, token, username });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'Login error' });
  }
});

// ---------- Users/Rooms ----------
app.get('/api/users', authMiddleware, async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT username FROM users ORDER BY username');
    res.json({ ok: true, users: rows.map(r => r.username) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'Users error' });
  }
});

app.get('/api/rooms', authMiddleware, async (req, res) => {
  try {
    const me = req.user.username;
    const [rows] = await db.query(
      `SELECT r.id, r.type, r.name, r.created_at
       FROM rooms r
       JOIN room_members rm ON rm.room_id = r.id
       WHERE rm.username=?
       ORDER BY r.created_at DESC`,
      [me]
    );
    res.json({ ok: true, rooms: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'Rooms error' });
  }
});

app.post('/api/rooms/dm', authMiddleware, async (req, res) => {
  try {
    const me = req.user.username;
    const other = String(req.body.other || '').trim();
    if (!other) return res.status(400).json({ ok: false, error: 'Thiếu người chat' });
    const roomId = await createOrGetDmRoom(me, other);
    io.emit('rooms:changed');
    res.json({ ok: true, roomId });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'DM error' });
  }
});

app.post('/api/rooms/group', authMiddleware, async (req, res) => {
  try {
    const me = req.user.username;
    const name = req.body.name;
    const members = Array.isArray(req.body.members) ? req.body.members : [];
    const roomId = await createGroupRoom(me, name, members);
    io.emit('rooms:changed');
    res.json({ ok: true, roomId });
  } catch (e) {
    res.status(400).json({ ok: false, error: e?.message || 'Group error' });
  }
});

// ---------- Messages ----------
app.get('/api/messages', authMiddleware, async (req, res) => {
  try {
    const me = req.user.username;
    const roomId = Number(req.query.roomId);
    if (!roomId) return res.status(400).json({ ok: false, error: 'Thiếu roomId' });
    if (!(await ensureRoomMember(roomId, me))) return res.status(403).json({ ok: false, error: 'Không thuộc phòng' });
    const messages = await fetchMessages(roomId);
    res.json({ ok: true, messages });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'Messages error' });
  }
});

app.get('/api/messages/:roomId', authMiddleware, async (req, res) => {
  try {
    const me = req.user.username;
    const roomId = Number(req.params.roomId);
    if (!roomId) return res.status(400).json({ ok: false, error: 'Thiếu roomId' });
    if (!(await ensureRoomMember(roomId, me))) return res.status(403).json({ ok: false, error: 'Không thuộc phòng' });
    const messages = await fetchMessages(roomId);
    res.json({ ok: true, messages });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'Messages error' });
  }
});

app.post('/api/messages', authMiddleware, async (req, res) => {
  try {
    const me = req.user.username;
    const roomId = Number(req.body.roomId);
    const content = String(req.body.content || '').trim();
    if (!roomId || !content) return res.status(400).json({ ok: false, error: 'Thiếu roomId/content' });
    if (!(await ensureRoomMember(roomId, me))) return res.status(403).json({ ok: false, error: 'Không thuộc phòng' });

    const msg = await insertMessage({ roomId, sender: me, content });
    emitMessageToRoom(roomId, msg);
    io.emit('rooms:changed');
    res.json({ ok: true, message: msg });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'Send message error' });
  }
});

// ---------- Upload & Download ----------
async function handleChatUpload(req, res) {
  try {
    const me = req.user.username;
    const roomId = Number(req.body.roomId);
    if (!roomId) return res.status(400).json({ ok: false, error: 'Thiếu roomId' });
    if (!req.file) return res.status(400).json({ ok: false, error: 'Thiếu file' });
    if (!(await ensureRoomMember(roomId, me))) return res.status(403).json({ ok: false, error: 'Không thuộc phòng' });

    const original = fixMojibake(String(req.file.originalname || 'file'));
    const stored = String(req.file.filename);
    const mime = String(req.file.mimetype || 'application/octet-stream');
    const size = Number(req.file.size || 0);

    const [ins] = await db.query(
      `INSERT INTO attachments (room_id, uploader, original_name, stored_name, mime_type, size_bytes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [roomId, me, original, stored, mime, size]
    );
    const attachmentId = Number(ins.insertId);

    const msg = await insertMessage({ roomId, sender: me, content: '', attachmentId });
    emitMessageToRoom(roomId, msg);
    io.emit('rooms:changed');

    res.json({ ok: true, attachmentId, messageId: msg.id });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'Upload error' });
  }
}

app.post('/api/chat/upload', authMiddleware, upload.single('file'), handleChatUpload);
app.post('/api/upload', authMiddleware, upload.single('file'), handleChatUpload);

app.get('/files/:id', authMiddleware, async (req, res) => {
  try {
    const me = req.user.username;
    const id = Number(req.params.id);
    const [rows] = await db.query('SELECT * FROM attachments WHERE id=?', [id]);
    const att = rows[0];
    if (!att) return res.status(404).send('Not found');

    // ✅ Security: only members of the room can download
    if (!(await ensureRoomMember(Number(att.room_id), me))) return res.status(403).send('Forbidden');

    const filePath = path.join(UPLOAD_DIR, att.stored_name);
    if (!fs.existsSync(filePath)) return res.status(404).send('Missing on disk');

    const filename = fixMojibake(att.original_name || `file-${id}`);
    res.setHeader('Content-Type', att.mime_type || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', contentDispositionAttachment(filename));

    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    res.status(500).send(e?.message || 'Download error');
  }
});
// ---------- AI ----------
function normalizeGeminiModel(model) {
  let m = String(model || '').trim();
  if (!m) return 'gemini-1.5-flash';
  m = m.replace(/^v1beta\/models\//i, '').replace(/^models\//i, '');
  m = m.replace(/:generateContent$/i, '').replace(/:generate_content$/i, '');
  return m;
}

function isQuotaError(status, rawText) {
  const s = String(rawText || '');
  return status === 429 || /quota exceeded|resource_exhausted|rate limit/i.test(s);
}

function aiFallbackAnswer(prompt, reason = 'quota') {
  const p = String(prompt || '').trim();
  if (!p) return 'Bạn muốn mình giúp gì?';
  if (reason === 'no_key') {
    return `⚠️ AI đang tắt vì thiếu GEMINI_API_KEY.\n\nNội dung bạn hỏi: ${p}`;
  }
  return `⚠️ Gemini đang bị giới hạn quota/rate limit nên tạm thời không gọi được.\n` +
         `Bạn vẫn chat bình thường được.\n\nNội dung bạn hỏi: ${p}`;
}

async function geminiGenerate(prompt) {
  const text = (GEMINI_SYSTEM ? `${GEMINI_SYSTEM}\n\n` : '') + String(prompt || '').trim();
  if (!text) return { ok: false, error: 'Thiếu prompt' };

  if (!GEMINI_API_KEY) {
    return { ok: true, answer: aiFallbackAnswer(prompt, 'no_key'), isFallback: true };
  }

  const model = normalizeGeminiModel(GEMINI_MODEL);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
  };

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  const raw = await r.text();

  if (!r.ok) {
    if (isQuotaError(r.status, raw)) {
      return { ok: true, answer: aiFallbackAnswer(prompt, 'quota'), isFallback: true };
    }
    let msg = raw;
    try {
      const j = JSON.parse(raw);
      msg = j?.error?.message || raw;
    } catch {}
    return { ok: false, error: msg || `Gemini HTTP ${r.status}` };
  }

  let data = {};
  try { data = JSON.parse(raw); } catch { return { ok: false, error: 'Bad JSON from Gemini' }; }

  const answer =
    data?.candidates?.[0]?.content?.parts
      ?.map(p => (typeof p?.text === 'string' ? p.text : ''))
      .join('') || '';

  return { ok: true, answer: String(answer).trim() };
}

app.post('/api/ai', authMiddleware, async (req, res) => {
  try {
    const me = req.user.username;
    const roomId = req.body.roomId ? Number(req.body.roomId) : 0;
    const prompt = req.body.prompt ?? req.body.text ?? req.body.message ?? '';

    if (roomId) {
      if (!(await ensureRoomMember(roomId, me))) return res.status(403).json({ ok: false, error: 'Không thuộc phòng' });
    }

    const out = await geminiGenerate(prompt);
    if (!out.ok) return res.status(400).json(out);

    if (roomId) {
      const msg = await insertMessage({ roomId, sender: 'Gemini', content: out.answer });
      emitMessageToRoom(roomId, msg);
      io.emit('rooms:changed');
    }

    res.json({ ok: true, answer: out.answer, isFallback: !!out.isFallback });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'AI error' });
  }
});

app.post('/api/ai/solo', authMiddleware, async (req, res) => {
  try {
    const prompt = req.body.prompt ?? req.body.text ?? '';
    const out = await geminiGenerate(prompt);
    if (!out.ok) return res.status(400).json(out);
    res.json({ ok: true, answer: out.answer, isFallback: !!out.isFallback });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'AI solo error' });
  }
});

// ---------- Tools (TCP/TLS/UDP/Async/Bcast/Mcast/Email/gRPC) ----------
function readSocketForAWhile(sock, totalMs = 1200, idleMs = 350) {
  return new Promise((resolve, reject) => {
    let buf = '';
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      try { sock.destroy(); } catch {}
      resolve(buf);
    };

    let idleTimer = null;
    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(finish, idleMs);
    };

    const totalTimer = setTimeout(finish, totalMs);

    sock.on('data', (d) => {
      buf += d.toString('utf-8');
      resetIdle();
    });
    sock.on('error', (e) => {
      if (done) return;
      done = true;
      clearTimeout(totalTimer);
      if (idleTimer) clearTimeout(idleTimer);
      reject(e);
    });
    sock.on('end', finish);

    resetIdle();
  });
}

async function tcpEcho(host, port, msg) {
  const sock = net.createConnection({ host, port });
  await new Promise((r) => sock.once('connect', r));
  sock.write(String(msg) + '\n');
  const data = await readSocketForAWhile(sock);
  const lines = data.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  return lines[lines.length - 1] || data.trim();
}

async function tlsEcho(host, port, msg) {
  const sock = tls.connect({ host, port, rejectUnauthorized: false });
  await new Promise((r) => sock.once('secureConnect', r));
  sock.write(String(msg) + '\n');
  const data = await readSocketForAWhile(sock);
  const lines = data.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  return lines[lines.length - 1] || data.trim();
}

async function udpPing(host, port, msg) {
  return new Promise((resolve, reject) => {
    const client = dgram.createSocket('udp4');
    const payload = Buffer.from(String(msg));

    const timer = setTimeout(() => {
      try { client.close(); } catch {}
      reject(new Error('UDP timeout'));
    }, 1200);

    client.on('message', (data) => {
      clearTimeout(timer);
      try { client.close(); } catch {}
      resolve(data.toString('utf-8'));
    });

    client.send(payload, port, host, (err) => {
      if (err) {
        clearTimeout(timer);
        try { client.close(); } catch {}
        reject(err);
      }
    });
  });
}

app.get('/api/tools/tcp-echo', async (req, res) => {
  try {
    const msg = String(req.query.msg || 'hello');
    const out = await tcpEcho(TCP_HOST, TCP_PORT, msg);
    res.type('text/plain').send(out);
  } catch (e) {
    res.status(500).type('text/plain').send(e?.message || 'TCP error');
  }
});

app.get('/api/tools/tls-echo', async (req, res) => {
  try {
    const msg = String(req.query.msg || 'hello');
    const out = await tlsEcho(TLS_HOST, TLS_PORT, msg);
    res.type('text/plain').send(out);
  } catch (e) {
    res.status(500).type('text/plain').send(e?.message || 'TLS error');
  }
});

app.get('/api/tools/udp-ping', async (req, res) => {
  try {
    const msg = String(req.query.msg || 'ping 1');
    const out = await udpPing(UDP_HOST, UDP_PORT, msg);
    res.json({ ok: true, reply: out });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'UDP error' });
  }
});

app.get('/api/tools/async-echo', async (req, res) => {
  try {
    const msg = String(req.query.msg || 'hello');
    const out = await tcpEcho(ASYNC_HOST, ASYNC_PORT, msg);
    res.json({ ok: true, reply: out });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'ASYNC error' });
  }
});

// Buoi 08 - use mcast-bus HTTP
app.get('/api/tools/mcast/feed', async (req, res) => {
  try {
    const type = String(req.query.type || 'all');
    const limit = String(req.query.limit || '100');
    const url = `http://${MCAST_HOST}:${MCAST_HTTP_PORT}/feed?type=${encodeURIComponent(type)}&limit=${encodeURIComponent(limit)}`;
    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'MCAST feed error' });
  }
});

app.post('/api/tools/mcast/send', authMiddleware, async (req, res) => {
  try {
    const message = String(req.body.message || '').trim();
    if (!message) return res.status(400).json({ ok: false, error: 'Thiếu message' });
    const url = `http://${MCAST_HOST}:${MCAST_HTTP_PORT}/send/multicast`;
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message }) });
    const data = await r.json();
    res.json({ ...data, group: MCAST_GROUP, port: MCAST_PORT });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'MCAST send error' });
  }
});

app.post('/api/tools/bcast/send', authMiddleware, async (req, res) => {
  try {
    const message = String(req.body.message || '').trim();
    if (!message) return res.status(400).json({ ok: false, error: 'Thiếu message' });
    const url = `http://${MCAST_HOST}:${MCAST_HTTP_PORT}/send/broadcast`;
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message }) });
    const data = await r.json();
    res.json({ ...data, port: BCAST_PORT });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'BCAST send error' });
  }
});

// Buoi 09 - Email
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: false,
});

app.post('/api/tools/email/send', authMiddleware, async (req, res) => {
  try {
    const to = String(req.body.to || '').trim();
    const subject = String(req.body.subject || '').trim();
    const text = String(req.body.text || '').trim();
    if (!to || !subject || !text) return res.status(400).json({ ok: false, error: 'Thiếu to/subject/text' });

    const info = await transporter.sendMail({ from: MAIL_FROM, to, subject, text });
    res.json({ ok: true, messageId: info.messageId });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'Send mail error' });
  }
});

app.post('/api/tools/email/send-room', authMiddleware, async (req, res) => {
  try {
    const me = req.user.username;
    const to = String(req.body.to || '').trim();
    const roomId = Number(req.body.roomId);
    if (!to || !roomId) return res.status(400).json({ ok: false, error: 'Thiếu to/roomId' });
    if (!(await ensureRoomMember(roomId, me))) return res.status(403).json({ ok: false, error: 'Không thuộc phòng' });

    const msgs = await fetchMessages(roomId, 200);
    const text = msgs
      .map(m => `[${m.created_at}] ${m.sender}: ${m.content || (m.attachment_id ? `(file: ${m.attachmentName})` : '')}`)
      .join('\n');

    const info = await transporter.sendMail({
      from: MAIL_FROM,
      to,
      subject: `Chat transcript - room ${roomId}`,
      text,
    });

    res.json({ ok: true, messageId: info.messageId });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'Send room mail error' });
  }
});
// Buoi 10 - gRPC client
const hubProtoPath = path.join(__dirname, 'proto', 'netprog.proto');
const grpcPackageDef = protoLoader.loadSync(hubProtoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const grpcProto = grpc.loadPackageDefinition(grpcPackageDef);
const NetProgService = grpcProto.netprog?.NetProgService;

function grpcClient() {
  return new NetProgService(`${GRPC_HOST}:${GRPC_PORT}`, grpc.credentials.createInsecure());
}

app.get('/api/tools/grpc/ping', async (req, res) => {
  try {
    const msg = String(req.query.msg || 'hello');
    const client = grpcClient();
    client.Ping({ message: msg }, (err, reply) => {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      res.json({ ok: true, reply });
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'gRPC ping error' });
  }
});

app.get('/api/tools/grpc/room-stats', authMiddleware, async (req, res) => {
  try {
    const me = req.user.username;
    const roomId = Number(req.query.roomId);
    if (!roomId) return res.status(400).json({ ok: false, error: 'Thiếu roomId' });
    if (!(await ensureRoomMember(roomId, me))) return res.status(403).json({ ok: false, error: 'Không thuộc phòng' });

    const client = grpcClient();
    client.RoomStats({ room_id: String(roomId) }, (err, reply) => {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      res.json({ ok: true, reply });
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'gRPC room-stats error' });
  }
});

// =========================
// SPA routes
// =========================
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// =========================
// Start servers
// =========================
async function start() {
  await initDb();

  if (USE_HTTPS && httpsServer) {
    httpsServer.listen(HTTPS_PORT, () => {
      console.log(`✅ HTTPS Hub running: https://localhost:${HTTPS_PORT}`);
    });

    http.createServer((req, res) => {
      const host = (req.headers.host || '').split(':')[0] || 'localhost';
      const location = `https://${host}:${HTTPS_PORT}${req.url || '/'}`;
      res.writeHead(301, { Location: location });
      res.end();
    }).listen(PORT, () => {
      console.log(`✅ HTTP redirect running: http://localhost:${PORT} -> https://localhost:${HTTPS_PORT}`);
    });
  } else {
    httpServer.listen(PORT, () => {
      console.log(`✅ HTTP Hub running: http://localhost:${PORT}`);
    });
  }
}

start().catch((e) => {
  console.error('❌ Start error:', e);
  process.exit(1);
});

1 2 ba con cá chà bá lửa