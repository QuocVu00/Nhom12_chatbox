# 🚀 MULTI-PROTOCOL REAL-TIME CHAT & GEMINI AI INTEGRATION

**Đồ án môn học: Lập trình mạng – Nhóm 12**

---

## 📌 Giới thiệu

Dự án **Nhom12_chatbox** là một hệ thống Chat trực tuyến thời gian thực (Real-time) đa giao thức, được xây dựng theo mô hình **Client–Server kết hợp Microservices**, hỗ trợ đồng thời:

* Socket.IO (Primary Channel)
* WebSocket thuần (Experimental Channel)
* Tích hợp **Google Gemini AI** làm trợ lý thông minh trong phiên trò chuyện

Hệ thống được đóng gói hoàn toàn bằng **Docker & Docker Compose**, cho phép triển khai nhanh chỉ với một lệnh duy nhất.

---

## 📋 Mục lục

* [✨ 1. Tính năng chính](#-1-tính-năng-chính)
* [💻 2. Công nghệ sử dụng](#-2-công-nghệ-sử-dụng)
* [🏗 3. Kiến trúc hệ thống](#-3-kiến-trúc-hệ-thống)
* [📂 4. Cấu trúc thư mục](#-4-cấu-trúc-thư-mục)
* [⚙ 5. Yêu cầu hệ thống](#-5-yêu-cầu-hệ-thống)
* [🛠 6. Hướng dẫn cài đặt](#-6-hướng-dẫn-cài-đặt)
* [📖 7. Hướng dẫn sử dụng](#-7-hướng-dẫn-sử-dụng)
* [🔐 8. Bảo mật & Lưu ý triển khai](#-8-bảo-mật--lưu-ý-triển-khai)
* [👥 9. Thành viên thực hiện](#-9-thành-viên-thực-hiện)
* [📜 License](#-license)

---

## ✨ 1. Tính năng chính

### 💬 Real-time Communication

* Truyền tải tin nhắn tức thì thông qua **Socket.IO**
* Độ trễ thấp, đồng bộ theo thời gian thực

### 🏠 Multi-Room Support

* Hỗ trợ nhiều phòng chat song song
* Phân luồng dữ liệu theo từng Room độc lập

### 🤖 AI Smart Assistant

* Tích hợp **Google Gemini Pro API**
* Hỏi đáp kiến thức, xử lý ngôn ngữ tự nhiên
* Trả lời được định dạng Markdown (code block, danh sách, heading)

### 🔐 Authentication & User Management

* Đăng ký / Đăng nhập tài khoản
* Lưu trữ người dùng tập trung tại MySQL
* Kiểm soát truy cập theo phiên làm việc

### 🐳 One-Click Deployment

* Triển khai toàn bộ hệ thống chỉ với:

```bash
docker-compose up -d --build
```

---

## 💻 2. Công nghệ sử dụng

| Thành phần     | Công nghệ                      |
| -------------- | ------------------------------ |
| Frontend       | HTML5, CSS3, JavaScript (ES6+) |
| Backend        | Node.js, Express               |
| Real-time      | Socket.IO, WebSocket           |
| Database       | MySQL 8.0                      |
| AI Engine      | Google Gemini API              |
| Infrastructure | Docker, Docker Compose         |

---

## 🏗 3. Kiến trúc hệ thống

### Mô hình tổng thể

Client (Browser)
│
├── HTTP / REST → Auth Service (Express)
│
├── Socket.IO → Chat Service
│
├── WebSocket → WS Experimental Service
│
└── AI Request → AI Hub → Google Gemini API

### Đặc điểm kiến trúc

* Phân tách dịch vụ theo chức năng (Chat, AI, Database)
* Dễ mở rộng theo chiều ngang (Horizontal Scaling)
* Độc lập triển khai và bảo trì từng module

---

## 📂 4. Cấu trúc thư mục

```plaintext
Nhom12_chatbox/
├── apps/
│   ├── socketio-chat/     # Chat server chính (Socket.IO)
│   │   └── public/        # Giao diện người dùng + client logic
│   ├── hub/
│   │   └── ai/
│   │       └── gemini.js  # Xử lý kết nối Gemini API
│   └── ws-chat/           # WebSocket server (thử nghiệm)
│
├── db/
│   └── init/
│       └── init.sql       # Khởi tạo schema database
│
├── docker-compose.yml     # Orchestration các service
├── .env.example           # Mẫu biến môi trường
├── .gitignore
└── README.md
```

---

## ⚙ 5. Yêu cầu hệ thống

* Docker >= 20.x
* Docker Compose >= 2.x
* Tài khoản Google AI Studio để lấy **Gemini API Key**

---

## 🛠 6. Hướng dẫn cài đặt

### Bước 1. Clone dự án

```bash
git clone https://github.com/QuocVu00/Nhom12_chatbox.git
cd Nhom12_chatbox
```

### Bước 2. Cấu hình biến môi trường

Tạo file `.env` từ mẫu:

```bash
cp .env.example .env
```

Nội dung mẫu `.env.example`:

```env
GEMINI_API_KEY=your_api_key_here
MYSQL_USER=chat_user
MYSQL_PASSWORD=chat_password
MYSQL_DATABASE=chat_db
```

> ⚠ Không commit file `.env` chứa API Key lên GitHub.

---

### Bước 3. Khởi chạy hệ thống

```bash
docker-compose up -d --build
```

Sau khi hoàn tất:

* Web client: [http://localhost:8080](http://localhost:8080)
* Database: chạy nội bộ trong container MySQL

---

## 📖 7. Hướng dẫn sử dụng

### Bước 1. Xác thực hệ thống

* Truy cập: `http://localhost:8080`
* Đăng ký tài khoản mới (Register)
* Đăng nhập (Login)

### Bước 2. Tham gia phòng chat

* Nhập tên phòng (ví dụ: `Group12`)
* Hệ thống tự động tạo hoặc tham gia phòng
* Tin nhắn chỉ hiển thị trong phòng tương ứng

### Bước 3. Tương tác AI Gemini

* Chat thường: nhập nội dung và nhấn **Send**
* Hỏi AI: nhập câu hỏi → nhấn **Hỏi Gemini AI**
* Kết quả trả về có hỗ trợ Markdown và code block

---

## 🔐 8. Bảo mật & Lưu ý triển khai

### Bảo mật

* Mật khẩu nên được hash bằng `bcrypt`
* Không public API Key Gemini
* Giới hạn tần suất gọi AI (Rate Limiting)
* Kiểm soát CORS & input validation

### Lưu ý triển khai production

* Không expose cổng MySQL ra ngoài
* Sử dụng volume để lưu dữ liệu bền vững
* Có thể thêm:

  * Redis cho session & scaling Socket.IO
  * Nginx làm reverse proxy

---

## 👥 9. Thành viên thực hiện

**Đề tài:** Ứng dụng Chatbot giao tiếp qua Socket triển khai theo mô hình Client–Server
**Môn học:** Lập trình mạng – 2026

| Họ tên               | Vai trò                     |
| -------------------- | --------------------------- |
| Nguyễn Quốc Vũ       | Nhóm trưởng / Backend chính |
| Trần Như Đạt         | Backend / Database          |
| Nguyễn Lê Hồng Mai   | Frontend                    |
| Huỳnh Đào Thanh Tùng | Socket & Networking         |
| Nguyễn Thị Thanh Vân | Frontend / Documentation    |

---

## 📜 License

Dự án phục vụ mục đích học tập và nghiên cứu; cho phép sử dụng và chỉnh sửa cho mục đích cá nhân, không sử dụng thương mại, và khi tái sử dụng vui lòng ghi rõ nguồn cùng nhóm tác giả.