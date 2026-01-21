# 🚀 NHÓM 12: SOCKET.IO CHATBOX & GEMINI AI INTEGRATION

Dự án là một ứng dụng **Chat trực tuyến thời gian thực** (Real-time) kết hợp với trí tuệ nhân tạo **Gemini AI**. Hệ thống sử dụng cơ sở dữ liệu **MySQL** để quản lý người dùng và được đóng gói bằng công nghệ **Docker** để triển khai nhanh chóng.

---

## 📋 MỤC LỤC
* [✨ Tính năng chính](#-tính-năng-chính)
* [💻 Công nghệ sử dụng](#-công-nghệ-sử-dụng)
* [📂 Cấu trúc thư mục](#-cấu-trúc-thư-mục)
* [🛠 Hướng dẫn cài đặt](#-hướng-dẫn-cài-đặt)
* [📖 Hướng dẫn sử dụng](#-hướng-dẫn-sử-dụng)
* [👥 Thông tin nhóm](#-thông-tin-nhóm)

---

## ✨ TÍNH NĂNG CHÍNH
* 💬 **Real-time Communication:** Gửi và nhận tin nhắn tức thì thông qua Socket.IO.
* 🏠 **Multi-Room Support:** Tham gia vào các phòng chat riêng biệt (ví dụ: `lop12`).
* 🤖 **AI Smart Assistant:** Tích hợp mô hình Gemini AI để trả lời câu hỏi tự động ngay trong giao diện chat.
* 🔐 **User Authentication:** Hệ thống Đăng ký/Đăng nhập bảo mật với dữ liệu lưu trữ tại MySQL.
* 🐳 **Containerization:** Triển khai đồng bộ toàn bộ dịch vụ chỉ với một câu lệnh Docker Compose.

---

## 💻 CÔNG NGHỆ SỬ DỤNG

| Thành phần | Công nghệ |
| :--- | :--- |
| **Frontend** | HTML5, CSS3, JavaScript (Vanilla JS) |
| **Backend** | Node.js, Express Framework |
| **Real-time** | Socket.IO |
| **Database** | MySQL 8.0 |
| **AI Engine** | Google Gemini API |
| **Infrastructure** | Docker, Docker Compose |

---

## 📂 CẤU TRÚC THƯ MỤC
```text
chatbox/
├── apps/
│   ├── socketio-chat/        # Module xử lý Socket.IO Chat chính
│   │   └── public/
│   │       ├── index.html    # Giao diện người dùng (UI)
│   │       └── main.js       # Logic xử lý socket client & AI call
│   ├── hub/
│   │   └── ai/
│   │       └── gemini.js     # Cấu hình kết nối Google Gemini API
│   └── ws-chat/              # Module xử lý WebSocket Chat bổ trợ
├── db/                       # Mã nguồn quản lý Cơ sở dữ liệu
│   └── init/
│       └── init.sql          # Kịch bản khởi tạo Schema & Table
├── docker-compose.yml        # File cấu hình triển khai Docker
├── .env                      # Cấu hình biến môi trường & API Key
└── README.md                 # Tài liệu hướng dẫn dự án
🛠 HƯỚNG DẪN CÀI ĐẶT
1. Yêu cầu hệ thống
Máy tính đã cài đặt Docker và Docker Compose.

Gemini API Key (Lấy từ Google AI Studio).

2. Các bước triển khai
Bash
# 1. Clone dự án từ GitHub
git clone [https://github.com/QuocVu00/Nhom12_chatbox.git](https://github.com/QuocVu00/Nhom12_chatbox.git)
cd Nhom12_chatbox

# 2. Cấu hình API Key
# Mở file .env hoặc gemini.js và dán mã API Key của bạn vào.

# 3. Khởi chạy toàn bộ hệ thống
docker-compose up -d
📖 HƯỚNG DẪN SỬ DỤNG
Bước 1: Xác thực người dùng
Truy cập địa chỉ: http://localhost:3000. Sử dụng nút Register để tạo tài khoản, sau đó nhấn Login để bắt đầu.

Bước 2: Tham gia phòng chat
Nhập tên phòng tại ô Room (Ví dụ: Nhom12). Nhấn nút Join để kết nối vào luồng tin nhắn của phòng đó.

Bước 3: Tương tác với AI
Chat: Nhập tin nhắn vào ô input và nhấn Send.

Hỏi AI: Nhập câu hỏi và nhấn nút Hỏi Gemini AI. Câu trả lời từ AI sẽ xuất hiện trực tiếp trong khung nhật ký (log).

👥 THÔNG TIN NHÓM (NHÓM 12)
Đề tài: Lập trình ứng dụng Chat Bot thông qua Socket.IO & MySQL.
## 👥 THÀNH VIÊN NHÓM
* **Trần Như Đạt** 
* **Nguyễn Lê Hồng Mai** 
* **Huỳnh Đào Thanh Tùng** 
* **Nguyễn Thị Thanh Vân** 
* **Nguyễn Quốc Vũ** - Nhóm trưởng 
