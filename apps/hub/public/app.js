// ====== tiny helpers ======
const $ = (sel, root = document) => root.querySelector(sel);
function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// =========================
// ✅ FIX: mojibake (UTF-8 bị đọc nhầm) để tên file tiếng Việt không bị lỗi
// =========================
function fixMojibakeText(s) {
  const str = String(s ?? "");
  if (!str) return str;

  // dấu hiệu thường gặp khi UTF-8 bị hiển thị sai: Ã Â Ä Ð ...
  if (!/[ÃÂÄÐÞ]/.test(str) && !str.includes("�")) return str;

  try {
    // chuyển chuỗi kiểu latin1 -> bytes -> decode utf8
    const bytes = Uint8Array.from(str, (ch) => ch.charCodeAt(0));
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (decoded && !decoded.includes("�")) return decoded;
  } catch {}
  return str;
}

// =========================
// ✅ FIX: download link phải kèm token (vì <a> không gửi Authorization header)
// =========================
function fileDownloadUrl(id) {
  const t = getToken();
  if (!t) return `/files/${id}`;
  return `/files/${id}?token=${encodeURIComponent(t)}`;
}

// normalize message để chống lỗi font + chuẩn field
function normalizeMessage(msg) {
  if (!msg || typeof msg !== "object") return msg;
  // copy nông để tránh side effects
  const m = { ...msg };
  if (m.attachmentName) m.attachmentName = fixMojibakeText(m.attachmentName);
  if (m.sender) m.sender = fixMojibakeText(m.sender);
  return m;
}

function getTheme() { return localStorage.getItem("theme") || "light"; }
function setTheme(t) { localStorage.setItem("theme", t); document.body.dataset.theme = t; }

function rememberOn() { return localStorage.getItem("remember") === "1"; }
function setRemember(v) { localStorage.setItem("remember", v ? "1" : "0"); }

function getToken() {
  return rememberOn() ?
    (localStorage.getItem("token") || "") :
    (sessionStorage.getItem("token") || "");
}
function setToken(t) {
  if (rememberOn()) localStorage.setItem("token", t);
  else sessionStorage.setItem("token", t);
}
function clearToken() {
  localStorage.removeItem("token");
  sessionStorage.removeItem("token");
}

function getUsername() {
  return rememberOn() ?
    (localStorage.getItem("username") || "") :
    (sessionStorage.getItem("username") || "");
}
function setUsername(u) {
  if (rememberOn()) localStorage.setItem("username", u);
  else sessionStorage.setItem("username", u);
}
function clearUsername() {
  localStorage.removeItem("username");
  sessionStorage.removeItem("username");
}

async function api(path, opts = {}) {
  const token = getToken();
  const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { ...opts, headers });
  return res.json();
}

function routeTo(path) {
  location.hash = `#${path}`;
}

function currentRoute() {
  const h = location.hash || "#/login";
  return h.replace("#", "");
}

// ===== App root =====
const app = document.getElementById("app");
document.body.dataset.theme = getTheme();

// ===== Router =====
function render() {
  const r = currentRoute();
  if (r.startsWith("/register")) renderRegister();
  else if (r.startsWith("/verify")) renderVerifyEmail();
  else if (r.startsWith("/ai")) renderAI();
  else if (r.startsWith("/chat")) renderChat();
  else renderLogin();
}

window.addEventListener("hashchange", render);
render();

// ===== Login =====
function renderLogin() {
  app.innerHTML = "";
  const node = el(`
    <div class="auth-wrap">
      <div class="auth card">
        <div class="auth-title">Chat Online</div>

        <div class="form-row">
          <label class="label">Tài khoản</label>
          <input class="input" id="u" placeholder="username" autocomplete="username"/>
        </div>

        <div class="form-row">
          <label class="label">Mật khẩu</label>
          <input class="input" id="p" placeholder="password" type="password" autocomplete="current-password"/>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px">
          <label style="display:flex;align-items:center;gap:8px;color:var(--text);font-weight:700">
            <input type="checkbox" id="remember"/>
            Ghi nhớ đăng nhập
          </label>
          <button class="icon-btn" id="themeBtn" title="Sáng/Tối" type="button">${getTheme() === "dark" ? "☀️" : "🌙"}</button>
        </div>

        <div style="height:12px"></div>
        <button class="btn btn-primary" id="loginBtn" type="button">Đăng nhập</button>

        <div style="height:12px"></div>
        <div class="muted">Chưa có tài khoản? <a class="link" id="goReg" href="#/register">Đăng ký</a></div>
        <div class="hint" id="err" style="min-height:18px;margin-top:8px"></div>
      </div>
    </div>
  `);

  app.appendChild(node);

  $("#remember", node).checked = rememberOn();
  $("#remember", node).onchange = (e) => setRemember(e.target.checked);

  $("#themeBtn", node).onclick = () => {
    setTheme(getTheme() === "dark" ? "light" : "dark");
    render();
  };

  $("#loginBtn", node).onclick = async () => {
    const username = $("#u", node).value.trim();
    const password = $("#p", node).value.trim();
    $("#err", node).textContent = "";

    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    if (!data.ok) {
      // ✅ backend trả needVerify nếu email chưa xác thực
      if (data.needVerify) {
        $("#err", node).textContent = data.error || "Bạn chưa xác thực email.";
        const u = (username || data.username || "").trim();
        setTimeout(() => routeTo(`/verify?u=${encodeURIComponent(u)}`), 300);
        return;
      }

      $("#err", node).textContent = data.error || "Đăng nhập thất bại";
      return;
    }

    setToken(data.token);
    setUsername(data.username);
    routeTo("/chat");
  };
}
// ===== Register =====
function renderRegister() {
  app.innerHTML = "";
  const node = el(`
    <div class="auth-wrap">
      <div class="auth card">
        <div class="auth-title">Đăng ký</div>

        <div class="form-row">
          <label class="label">Tài khoản</label>
          <input class="input" id="u" placeholder="username" autocomplete="username"/>
        </div>

        <div class="form-row">
          <label class="label">Email</label>
          <input class="input" id="email" placeholder="you@example.com" autocomplete="email"/>
        </div>

        <div class="form-row">
          <label class="label">Xác nhận Email</label>
          <input class="input" id="email2" placeholder="nhập lại email" autocomplete="email"/>
        </div>

        <div class="form-row">
          <label class="label">Mật khẩu</label>
          <input class="input" id="p" placeholder="password" type="password" autocomplete="new-password"/>
        </div>

        <div class="form-row">
          <label class="label">Xác nhận mật khẩu</label>
          <input class="input" id="p2" placeholder="confirm password" type="password" autocomplete="new-password"/>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px">
          <div class="muted">Đã có tài khoản? <a class="link" id="goLogin" href="#/login">Đăng nhập</a></div>
          <button class="icon-btn" id="themeBtn" title="Sáng/Tối" type="button">${getTheme() === "dark" ? "☀️" : "🌙"}</button>
        </div>

        <div style="height:12px"></div>
        <button class="btn btn-primary" id="regBtn" type="button">Tạo tài khoản</button>

        <div class="hint" id="err" style="min-height:18px;margin-top:8px"></div>
      </div>
    </div>
  `);

  app.appendChild(node);

  $("#themeBtn", node).onclick = () => {
    setTheme(getTheme() === "dark" ? "light" : "dark");
    render();
  };

  function validate() {
    const username = $("#u", node).value.trim();
    const e1 = $("#email", node).value.trim().toLowerCase();
    const e2 = $("#email2", node).value.trim().toLowerCase();
    const p1 = $("#p", node).value.trim();
    const p2 = $("#p2", node).value.trim();

    if (!username || !e1 || !e2 || !p1 || !p2) return "Vui lòng nhập đầy đủ thông tin.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e1)) return "Email không hợp lệ.";
    if (e1 !== e2) return "Email xác nhận không khớp.";
    if (p1.length < 4) return "Mật khẩu tối thiểu 4 ký tự.";
    if (p1 !== p2) return "Mật khẩu xác nhận không khớp.";
    return "";
  }

  ["u","email","email2","p","p2"].forEach(id=>{
    $("#"+id, node).addEventListener("input", ()=> { $("#err", node).textContent = validate(); });
  });

  $("#regBtn", node).onclick = async () => {
    const err = validate();
    $("#err", node).textContent = err;
    if (err) return;

    const username = $("#u", node).value.trim();
    const email = $("#email", node).value.trim().toLowerCase();
    const password = $("#p", node).value.trim();

    const data = await api("/api/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });

    if (!data.ok) {
      $("#err", node).textContent = data.error || "Đăng ký thất bại";
      return;
    }

    routeTo(`/verify?u=${encodeURIComponent(username)}`);
  };
}

function parseRouteQuery(route) {
  const out = {};
  const parts = route.split("?", 2);
  if (parts.length < 2) return out;
  const qs = parts[1] || "";
  qs.split("&").forEach(p => {
    const [k, v] = p.split("=", 2);
    if (!k) return;
    out[decodeURIComponent(k)] = decodeURIComponent(v || "");
  });
  return out;
}

function renderVerifyEmail() {
  app.innerHTML = "";
  const r = currentRoute();
  const q = parseRouteQuery(r);
  const username = (q.u || "").trim();

  const node = el(`
    <div class="auth-wrap">
      <div class="auth card">
        <div class="auth-title">Xác thực Email</div>

        <div class="muted" style="line-height:1.6">
          Mã đã gửi về email của bạn.<br/>
          Mở Mailhog để xem: <b>http://localhost:8025</b>
        </div>

        <div style="height:12px"></div>

        <div class="form-row">
          <label class="label">Tài khoản</label>
          <input class="input" id="u" placeholder="username" value="${escapeHtml(username)}"/>
        </div>

        <div class="form-row">
          <label class="label">Mã xác thực (6 số)</label>
          <input class="input" id="code" placeholder="VD: 123456" inputmode="numeric"/>
        </div>

        <div style="height:12px"></div>
        <button class="btn btn-primary" id="verifyBtn" type="button">Xác thực</button>

        <div style="height:10px"></div>
        <button class="btn" id="resendBtn" type="button">Gửi lại mã</button>

        <div style="height:10px"></div>
        <div class="muted">Quay lại <a class="link" href="#/login">Đăng nhập</a></div>

        <div class="hint" id="err" style="min-height:18px;margin-top:8px"></div>
      </div>
    </div>
  `);

  app.appendChild(node);

  $("#verifyBtn", node).onclick = async () => {
    const u = $("#u", node).value.trim();
    const code = $("#code", node).value.trim();
    $("#err", node).textContent = "";

    const data = await api("/api/verify-email", {
      method: "POST",
      body: JSON.stringify({ username: u, code }),
    });

    if (!data.ok) {
      $("#err", node).textContent = data.error || "Xác thực thất bại";
      return;
    }

    $("#err", node).textContent = "✅ Xác thực thành công! Bạn có thể đăng nhập.";
    setTimeout(() => routeTo("/login"), 700);
  };

  $("#resendBtn", node).onclick = async () => {
    const u = $("#u", node).value.trim();
    $("#err", node).textContent = "";

    const data = await api("/api/verify-email/resend", {
      method: "POST",
      body: JSON.stringify({ username: u }),
    });

    if (!data.ok) {
      $("#err", node).textContent = data.error || "Gửi lại mã thất bại";
      return;
    }

    $("#err", node).textContent = "✅ Đã gửi lại mã. Mở Mailhog: http://localhost:8025";
  };
}
// =========================
// ✅ AI PAGE (NEW) - Chat AI riêng
// =========================
const AI_STORE_KEY = "ai_history_v1";

function loadAiHistory() {
  try { return JSON.parse(localStorage.getItem(AI_STORE_KEY) || "[]"); }
  catch { return []; }
}
function saveAiHistory(arr) {
  localStorage.setItem(AI_STORE_KEY, JSON.stringify(arr.slice(-200)));
}
function pushAi(role, content) {
  const arr = loadAiHistory();
  arr.push({ id: Date.now() + Math.random(), role, content, t: new Date().toISOString() });
  saveAiHistory(arr);
  return arr;
}
async function callAiSolo(prompt) {
  return api("/api/ai/solo", {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });
}

function renderAI() {
  if (!getToken()) { routeTo("/login"); return; }

  app.innerHTML = "";
  const node = el(`
    <div class="chat-app">
      <aside class="left">
        <div class="left-top">
          <div class="hello" title="${escapeHtml(getUsername() || "")}">
            <div class="hello-hi">Xin chào,</div>
            <div class="hello-name">${escapeHtml(getUsername() || "bạn")}</div>
          </div>
          <div class="left-top-actions">
            <button class="icon-btn" id="themeBtn" title="Sáng/Tối" type="button">${getTheme() === "dark" ? "☀️" : "🌙"}</button>
            <button class="logout-btn" id="logout" type="button">Đăng xuất</button>
          </div>
        </div>

        <div class="list" style="padding:12px">
          <div class="card" style="padding:12px;border-radius:16px">
            <div style="font-weight:900;color:var(--text)">🤖 Trò chuyện AI</div>
            <div style="height:12px"></div>
            <button class="btn" id="backChat" type="button" style="width:100%">⬅ Quay lại Chat</button>
            <div style="height:10px"></div>
            <button class="btn" id="clearAi" type="button" style="width:100%">🧹 Xoá lịch sử AI</button>
          </div>
        </div>
      </aside>

      <section class="right">
        <div class="topbar">
          <div class="title">🤖 Trò chuyện AI</div>
          <div class="actions">
            <button class="call-btn" id="btnBack" title="Quay lại" type="button">⬅️</button>
          </div>
        </div>

        <div class="chat-area" id="chatArea"></div>

        <div class="composer" style="position:relative">
          <button class="round-btn" id="btnEmoji" title="Emoji" type="button">😄</button>
          <input class="input" id="msg" placeholder="Nhập câu hỏi cho AI..." style="border-radius:999px;height:46px" />
          <button class="btn btn-primary send" id="send" type="button">Gửi</button>
        </div>

        <div id="emojiPop" class="card" style="display:none;position:absolute;bottom:78px;right:18px;padding:10px;border-radius:18px;z-index:9999">
          <div style="display:flex;gap:8px;flex-wrap:wrap;max-width:280px">
            ${["😀","😄","😂","🥹","😍","😘","👍","🙏","🔥","🎉","💯","😎","🤝","😭","🤔","😴"].map(e=>`<button class="btn" data-emo="${e}" type="button" style="padding:8px 10px;border-radius:14px">${e}</button>`).join("")}
          </div>
        </div>
      </section>
    </div>
  `);

  app.appendChild(node);

  $("#themeBtn", node).onclick = () => { setTheme(getTheme() === "dark" ? "light" : "dark"); render(); };
  $("#logout", node).onclick = () => { clearToken(); clearUsername(); routeTo("/login"); };

  $("#backChat", node).onclick = () => routeTo("/chat");
  $("#btnBack", node).onclick = () => routeTo("/chat");
  $("#clearAi", node).onclick = () => { localStorage.removeItem(AI_STORE_KEY); renderAiMessages(); };

  const emojiPop = $("#emojiPop", node);
  const msgInput = $("#msg", node);
  function openEmoji() { emojiPop.style.display = "block"; }
  function closeEmoji() { emojiPop.style.display = "none"; }
  $("#btnEmoji", node).onclick = () => {
    if (emojiPop.style.display === "block") closeEmoji();
    else openEmoji();
  };
  emojiPop.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-emo]");
    if (!b) return;
    msgInput.value += b.dataset.emo;
    msgInput.focus();
  });

  function scrollBottom() {
    const area = $("#chatArea", node);
    area.scrollTop = area.scrollHeight;
  }

  function renderAiMessages() {
    const area = $("#chatArea", node);
    const arr = loadAiHistory();
    area.innerHTML = "";

    if (!arr.length) {
      area.innerHTML = `<div class="empty-hint">Nhập câu hỏi để bắt đầu trò chuyện với AI 🤖</div>`;
      return;
    }

    for (const m of arr) {
      const mine = m.role === "user";
      const bubble = el(`
        <div class="row ${mine ? "mine" : "theirs"}">
          <div class="bubble" style="${mine ? "" : "border:1px solid rgba(125,125,125,.25);"}">
            ${escapeHtml(m.content)}
          </div>
        </div>
      `);
      area.appendChild(bubble);
    }
  }

  async function send() {
    const prompt = msgInput.value.trim();
    if (!prompt) return;
    msgInput.value = "";

    pushAi("user", prompt);
    renderAiMessages();
    scrollBottom();

    const tmpId = "tmp-" + Date.now();
    const arr = loadAiHistory();
    arr.push({ id: tmpId, role: "ai", content: "⏳ đang suy nghĩ câu trả lời...", t: new Date().toISOString() });
    saveAiHistory(arr);
    renderAiMessages();
    scrollBottom();

    try {
      const res = await callAiSolo(prompt);
      if (!res.ok) throw new Error(res.error || "AI lỗi");

      const arr2 = loadAiHistory().filter(x => x.id !== tmpId);
      arr2.push({ id: Date.now() + Math.random(), role: "ai", content: res.answer, t: new Date().toISOString() });
      saveAiHistory(arr2);

      renderAiMessages();
      scrollBottom();
    } catch (e) {
      const arr2 = loadAiHistory().filter(x => x.id !== tmpId);
      arr2.push({ id: Date.now() + Math.random(), role: "ai", content: `❌ ${e.message || "AI lỗi"}`, t: new Date().toISOString() });
      saveAiHistory(arr2);

      renderAiMessages();
      scrollBottom();
    }
  }

  $("#send", node).onclick = send;
  msgInput.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });

  renderAiMessages();
  setTimeout(scrollBottom, 0);
}

// ===== Chat =====
let selectedRoom = null;
let rooms = [];
let users = [];
let messages = [];
let pendingFile = null;

// ✅ Presence set (online/offline)
let onlineSet = new Set();

// ✅ FIX: dedupe message để chống double khi vừa POST vừa socket emit
function addMessageOnce(msg) {
  const m = normalizeMessage(msg);
  const id = Number(m?.id);
  if (id && messages.some(x => Number(x?.id) === id)) return false;
  messages.push(m);
  return true;
}

// =========================
// ✅ AI helpers - gõ /ai <câu hỏi> trong ô chat
// =========================
function isAiCommand(text) {
  return /^\/ai\b/i.test(String(text || "").trim());
}
function extractAiPrompt(text) {
  return String(text || "").trim().replace(/^\/ai\b[:\s]*/i, "").trim();
}
async function callAi(roomId, prompt) {
  return api("/api/ai", {
    method: "POST",
    body: JSON.stringify({ roomId, prompt }),
  });
}

function renderChat() {
  if (!getToken()) { routeTo("/login"); return; }

  app.innerHTML = "";
  const node = el(`
    <div class="chat-app">
      <aside class="left">
        <div class="left-top">
          <div class="hello" title="${escapeHtml(getUsername() || "")}">
            <div class="hello-hi">Xin chào,</div>
            <div class="hello-name">${escapeHtml(getUsername() || "bạn")}</div>
          </div>
          <div class="left-top-actions">
            <button class="icon-btn" id="themeBtn" title="Sáng/Tối" type="button">${getTheme() === "dark" ? "☀️" : "🌙"}</button>
            <button class="logout-btn" id="logout" type="button">Đăng xuất</button>
          </div>
        </div>

        <div class="search">
          <div class="search-wrap">
            <div class="search-ico">🔍</div>
            <input class="input" id="search" placeholder="Tìm kiếm..." />
          </div>
        </div>

        <div class="tabs">
          <div class="tab active" id="tabUsers">Người dùng</div>
          <div class="tab" id="tabGroups">Nhóm</div>
        </div>

        <div class="list" id="list"></div>

        <div class="left-bottom">
          <button class="btn btn-primary" id="createGroup" style="width:100%" type="button">+ Tạo nhóm mới</button>
        </div>
      </aside>

      <section class="right">
        <div class="topbar">
          <div class="title" id="chatTitle">Chưa chọn cuộc trò chuyện</div>
          <div class="actions">
            <button class="call-btn" id="btnAI" title="AI" type="button">🤖</button>
            <button class="call-btn" id="btnCall" title="Gọi" type="button">📞</button>
            <button class="call-btn" id="btnVideo" title="Video" type="button">🎥</button>
          </div>
        </div>

        <div class="chat-area" id="chatArea">
          <div class="empty-hint">Chọn một người hoặc nhóm để bắt đầu</div>
        </div>

        <div class="composer" style="position:relative">
          <button class="round-btn" id="btnEmoji" title="Emoji" type="button">😄</button>
          <button class="round-btn" id="btnAttach" title="Gửi file" type="button">📎</button>
          <input class="input" id="msg" placeholder="Chọn một người để nhắn tin..." style="border-radius:999px;height:46px" />
          <button class="btn btn-primary send" id="send" type="button">Gửi</button>
          <input type="file" id="fileInput" style="display:none" />
        </div>
      </section>

      <div class="modal-backdrop" id="callModal">
        <div class="modal card" style="width:900px;max-width:95vw">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div class="modal-title" style="margin:0;color:var(--text)">Gọi demo</div>
            <button class="btn" id="callClose" type="button">Đóng</button>
          </div>

          <div style="height:14px"></div>

          <div class="grid-2">
            <div>
              <div class="label">TCP Echo</div>
              <div class="hint">Port: 9001</div>
              <button class="btn btn-primary" id="testTcp" style="margin-top:10px" type="button">Test</button>
              <pre id="tcpOut" class="card" style="padding:12px;white-space:pre-wrap;margin-top:10px"></pre>
            </div>
            <div>
              <div class="label">TLS Echo</div>
              <div class="hint">Port: 9443</div>
              <button class="btn btn-primary" id="testTls" style="margin-top:10px" type="button">Test</button>
              <pre id="tlsOut" class="card" style="padding:12px;white-space:pre-wrap;margin-top:10px"></pre>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-backdrop" id="groupModal">
        <div class="modal card" style="width:980px;max-width:95vw">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div class="modal-title" style="margin:0;color:var(--text)">Tạo nhóm</div>
            <button class="btn" id="groupClose" type="button">Đóng</button>
          </div>

          <div style="height:14px"></div>

          <div class="form-row">
            <div class="label">Tên nhóm</div>
            <input class="input" id="groupName" placeholder="Ví dụ: Nhóm CNPM" />
          </div>

          <div class="pick-wrap">
            <div class="pick-left">
              <div class="pick-title">Chọn thành viên</div>
              <div class="pick-list" id="pickList"></div>
            </div>
            <div class="pick-right">
              <div class="pick-title">Đã chọn</div>
              <div class="picked" id="picked"></div>
              <div style="height:12px"></div>
              <button class="btn btn-primary" id="groupCreate" style="width:100%" type="button">Tạo nhóm</button>
            </div>
          </div>
          <div class="hint" id="groupErr" style="min-height:18px;margin-top:8px"></div>
        </div>
      </div>

      <div class="modal-backdrop" id="fileModal">
        <div class="modal card" style="width:720px;max-width:95vw">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div class="modal-title" style="margin:0;color:var(--text)">Gửi file</div>
            <button class="btn" id="fileClose" type="button">Đóng</button>
          </div>

          <div style="height:14px"></div>

          <div id="filePreview"></div>

          <div style="height:12px"></div>
          <button class="btn btn-primary" id="fileSend" style="width:100%" type="button">Gửi</button>
          <div class="hint" id="fileErr" style="min-height:18px;margin-top:8px"></div>
        </div>
      </div>

      <div id="emojiPop" class="card" style="display:none;position:absolute;bottom:78px;right:18px;padding:10px;border-radius:18px;z-index:9999">
        <div style="display:flex;gap:8px;flex-wrap:wrap;max-width:280px">
          ${["😀","😄","😂","🥹","😍","😘","👍","🙏","🔥","🎉","💯","😎","🤝","😭","🤔","😴"].map(e=>`<button class="btn" data-emo="${e}" type="button" style="padding:8px 10px;border-radius:14px">${e}</button>`).join("")}
        </div>
      </div>
    </div>
  `);

  app.appendChild(node);

  $("#btnAI", node).onclick = () => routeTo("/ai");
  $("#themeBtn", node).onclick = () => { setTheme(getTheme() === "dark" ? "light" : "dark"); render(); };
  $("#logout", node).onclick = () => { clearToken(); clearUsername(); routeTo("/login"); };

  $("#tabUsers", node).onclick = () => setTab("users");
  $("#tabGroups", node).onclick = () => setTab("groups");

  $("#createGroup", node).onclick = () => openGroupModal();
  $("#groupClose", node).onclick = () => closeGroupModal();
  $("#btnCall", node).onclick = () => openCallModal();
  $("#btnVideo", node).onclick = () => openCallModal();
  $("#callClose", node).onclick = () => closeCallModal();

  $("#fileClose", node).onclick = () => closeFileModal();

  const emojiPop = $("#emojiPop", node);
  const msgInput = $("#msg", node);
  function openEmoji() { emojiPop.style.display = "block"; }
  function closeEmoji() { emojiPop.style.display = "none"; }
  $("#btnEmoji", node).onclick = () => {
    if (emojiPop.style.display === "block") closeEmoji();
    else openEmoji();
  };
  emojiPop.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-emo]");
    if (!b) return;
    msgInput.value += b.dataset.emo;
    msgInput.focus();
  });

  const fileInput = $("#fileInput", node);
  $("#btnAttach", node).onclick = () => {
    if (!selectedRoom) return alert("Bạn phải chọn người dùng/nhóm trước.");
    fileInput.click();
  };

  fileInput.addEventListener("change", () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    pendingFile = f;
    openFileModal(f);
  });

  $("#fileSend", node).onclick = async () => {
    if (!pendingFile || !selectedRoom) return;
    $("#fileErr", node).textContent = "";
    try {
      const form = new FormData();
      form.append("roomId", String(selectedRoom.id));
      form.append("file", pendingFile);

      const token = getToken();
      const res = await fetch("/api/chat/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Upload lỗi");
      closeFileModal();
      pendingFile = null;
      fileInput.value = "";
      scrollBottom();
    } catch (e) {
      $("#fileErr", node).textContent = e.message || "Upload lỗi";
    }
  };

  async function sendMessage() {
    if (!selectedRoom) return;
    const content = msgInput.value.trim();
    if (!content) return;

    const aiMode = isAiCommand(content);
    const aiPrompt = aiMode ? extractAiPrompt(content) : "";

    msgInput.value = "";

    const data = await api("/api/messages", {
      method: "POST",
      body: JSON.stringify({ roomId: selectedRoom.id, content }),
    });

    if (!data.ok) {
      alert(data.error || "Gửi lỗi");
      return;
    } else {
      scrollBottom();
    }

    if (aiMode) {
      if (!aiPrompt) {
        alert("Bạn hãy nhập câu hỏi sau /ai");
        return;
      }

      const tempId = `tmp-ai-${Date.now()}`;
      const tempMsg = {
        id: tempId,
        room_id: selectedRoom.id,
        sender: "Gemini",
        content: "⏳ đang suy nghĩ câu trả lời...",
        attachment_id: null,
        attachmentName: null,
        attachmentType: null,
        created_at: new Date().toISOString(),
      };
      messages.push(normalizeMessage(tempMsg));
      renderMessages();
      scrollBottom();

      try {
        const aiRes = await callAi(selectedRoom.id, aiPrompt);
        if (!aiRes.ok) throw new Error(aiRes.error || "AI lỗi");

        messages = messages.filter(m => String(m.id) !== String(tempId));
        renderMessages();
        scrollBottom();
      } catch (e) {
        messages = messages.filter(m => String(m.id) !== String(tempId));
        renderMessages();
        scrollBottom();
        alert(e.message || "AI lỗi");
      }
    }
  }

  $("#send", node).onclick = sendMessage;
  msgInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  $("#search", node).addEventListener("input", () => renderList());

  const socket = io({
    auth: { token: getToken() },
  });

  function setOnlineUsers(arr) {
    onlineSet = new Set((arr || []).map(String));
  }

  socket.emit("presence:list", null, () => {});

  socket.on("presence:list:result", (p) => {
    setOnlineUsers(p?.users || []);
    renderList();
  });

  socket.on("presence:full", (p) => {
    setOnlineUsers(p?.users || []);
    renderList();
  });

  socket.on("presence:update", (p) => {
    const u = String(p?.user || "");
    if (u) {
      if (p?.online) onlineSet.add(u);
      else onlineSet.delete(u);
    }
    renderList();
  });

  socket.on("message:new", (msg) => {
    if (!selectedRoom) return;
    const m = normalizeMessage(msg);
    const rid = m.room_id || m.roomId;
    if (Number(rid) !== Number(selectedRoom.id)) return;

    if (addMessageOnce(m)) {
      renderMessages();
      scrollBottom();
    }
  });

  let tab = "users";

  function setTab(t) {
    tab = t;
    $("#tabUsers", node).classList.toggle("active", tab === "users");
    $("#tabGroups", node).classList.toggle("active", tab === "groups");
    renderList();
  }

  function scrollBottom() {
    const area = $("#chatArea", node);
    area.scrollTop = area.scrollHeight;
  }

  async function loadUsers() {
    const data = await api("/api/users");
    users = data.ok ? data.users : [];
  }

  async function loadRooms() {
    const data = await api("/api/rooms");
    rooms = data.ok ? data.rooms : [];
  }

  async function loadMessages(roomId) {
    const data = await api(`/api/messages?roomId=${encodeURIComponent(roomId)}`);
    const arr = data.ok ? (data.messages || []) : [];
    messages = arr.map(normalizeMessage);
  }

  function renderList() {
    const list = $("#list", node);
    const q = ($("#search", node).value || "").trim().toLowerCase();
    list.innerHTML = "";

    if (tab === "users") {
      const me = (getUsername() || "").trim();
      const arr = users.filter(u => u !== me && u.toLowerCase().includes(q));
      for (const u of arr) {
        const isOnline = onlineSet.has(String(u));
        const item = el(`
          <div class="item">
            <div class="avatar">${escapeHtml(u[0] || "?").toUpperCase()}</div>
            <div class="meta">
              <div class="name">${escapeHtml(u)}</div>
              <div class="sub presence ${isOnline ? "online" : "offline"}">
                <span class="dot"></span>
                <span>${isOnline ? "Online" : "Offline"}</span>
              </div>
            </div>
          </div>
        `);
        item.onclick = async () => {
          const data = await api("/api/rooms/dm", {
            method: "POST",
            body: JSON.stringify({ other: u }),
          });
          if (!data.ok) return alert(data.error || "Lỗi tạo phòng");
          await loadRooms();
          const r = rooms.find(x => Number(x.id) === Number(data.roomId)) || { id: data.roomId, type: "dm", name: u };
          selectRoom(r, `Chat với ${u}`);
        };
        list.appendChild(item);
      }
    } else {
      const arr = rooms.filter(r => r.type === "group" && String(r.name || "").toLowerCase().includes(q));
      for (const r of arr) {
        const item = el(`
          <div class="item ${selectedRoom && Number(selectedRoom.id) === Number(r.id) ? "active" : ""}">
            <div class="avatar">👥</div>
            <div class="meta">
              <div class="name">${escapeHtml(r.name || "Nhóm")}</div>
              <div class="sub">Group</div>
            </div>
          </div>
        `);
        item.onclick = () => selectRoom(r, r.name || "Nhóm");
        list.appendChild(item);
      }
    }
  }

  async function selectRoom(room, title) {
    selectedRoom = room;
    $("#chatTitle", node).textContent = title || "Chat";
    $("#msg", node).placeholder = "Nhập tin nhắn... (gõ /ai để hỏi AI)";
    messages = [];
    socket.emit("room:join", selectedRoom.id);
    await loadMessages(selectedRoom.id);
    renderMessages();
    scrollBottom();
  }

  function renderMessages() {
    const area = $("#chatArea", node);

    if (!selectedRoom) {
      area.innerHTML = `<div class="empty-hint">Chưa chọn cuộc trò chuyện</div>`;
      return;
    }

    area.innerHTML = "";
    const me = (getUsername() || "").trim();

    for (const raw of messages) {
      const msg = normalizeMessage(raw);
      const mine = msg.sender === me;
      const isAI = String(msg.sender || "").toLowerCase() === "gemini";
      let body = "";

      if (msg.attachment_id || msg.attachmentId) {
        const id = msg.attachment_id || msg.attachmentId;

        // ✅ FIX: tên file tiếng Việt + download url kèm token
        const name = fixMojibakeText(msg.attachmentName || `file-${id}`);
        const url = fileDownloadUrl(id);

        body += `
          <div class="file-card">
            <div class="file-head">
              <div class="file-ico">📎</div>
              <div class="file-meta">
                <div class="file-name">${escapeHtml(name)}</div>
                <div class="file-sub">Tệp đính kèm</div>
              </div>
              <a class="file-dl" href="${url}" download>Tải</a>
            </div>
          </div>
        `;
      }

      if (msg.content) body += `<div>${escapeHtml(msg.content)}</div>`;

      const bubble = el(`
        <div class="row ${mine ? "mine" : "theirs"}">
          <div class="bubble" ${isAI ? `style="border:1px solid rgba(125,125,125,.25); box-shadow:0 0 0 1px rgba(125,125,125,.05) inset;"` : ""}>${body}</div>
        </div>
      `);

      area.appendChild(bubble);
    }
  }

  function openCallModal() { $("#callModal", node).classList.add("show"); }
  function closeCallModal() { $("#callModal", node).classList.remove("show"); }

  function openGroupModal() { /* phần còn lại giữ nguyên như file của bạn */ }
  function closeGroupModal() { $("#groupModal", node).classList.remove("show"); }

  function openFileModal(file) {
    $("#fileModal", node).classList.add("show");
    $("#fileErr", node).textContent = "";

    const wrap = $("#filePreview", node);
    const name = escapeHtml(fixMojibakeText(file.name || "file"));
    wrap.innerHTML = `
      <div class="file-card">
        <div class="file-head">
          <div class="file-ico">📎</div>
          <div class="file-meta">
            <div class="file-name">${name}</div>
            <div class="file-sub">Sẵn sàng gửi</div>
          </div>
        </div>
      </div>
    `;
  }
  function closeFileModal() { $("#fileModal", node).classList.remove("show"); }

  $("#testTcp", node).onclick = async () => {
    $("#tcpOut", node).textContent = "Đang test...";
    try {
      const res = await fetch("/api/tools/tcp-echo?msg=hello");
      const text = await res.text();
      $("#tcpOut", node).textContent = text;
    } catch {
      $("#tcpOut", node).textContent = "Lỗi";
    }
  };

  $("#testTls", node).onclick = async () => {
    $("#tlsOut", node).textContent = "Đang test...";
    try {
      const res = await fetch("/api/tools/tls-echo?msg=hello");
      const text = await res.text();
      $("#tlsOut", node).textContent = text;
    } catch {
      $("#tlsOut", node).textContent = "Lỗi";
    }
  };

  (async () => {
    await loadUsers();
    await loadRooms();
    renderList();
  })();
}
