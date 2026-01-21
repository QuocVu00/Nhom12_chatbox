🚀 Nhom 12: Socket.IO Chat + MySQL (Docker) & Gemini AI Integration
Dự án này là một ứng dụng Chat trực tuyến thời gian thực (Real-time) kết hợp với trí tuệ nhân tạo Gemini AI, sử dụng cơ sở dữ liệu MySQL và công nghệ Docker để triển khai.

📋 Mục lục
Tính năng chính

Công nghệ sử dụng

Cấu trúc thư mục

Hướng dẫn cài đặt

Hướng dẫn sử dụng

Thông tin nhóm

✨ Tính năng chính
Chat Real-time: Gửi và nhận tin nhắn tức thì qua Socket.IO.

Quản lý phòng (Room): Người dùng có thể tham gia vào các phòng chat riêng biệt (ví dụ: lop12).

Tích hợp Gemini AI: Hỗ trợ trả lời câu hỏi thông minh ngay trong giao diện chat thông qua mô hình Gemini.

Xác thực người dùng: Đăng ký và Đăng nhập tài khoản lưu trữ trong cơ sở dữ liệu.

Dockerized: Dễ dàng triển khai toàn bộ dịch vụ với Docker Compose.

💻 Công nghệ sử dụng
Frontend: HTML, CSS, JavaScript.

Backend: Node.js, Express.

Real-time: Socket.IO.

Database: MySQL.

AI: Google Gemini API.

DevOps: Docker, Docker Compose.

📂 Cấu trúc thư mục
Plaintext
chatbox/
├── apps/
│   ├── socketio-chat/        # Module xử lý Socket.IO Chat
│   │   └── public/
│   │       ├── index.html    # Giao diện người dùng
│   │       └── main.js       # Logic xử lý socket client
│   ├── hub/
│   │   └── ai/
│   │       └── gemini.js     # Cấu hình và gọi API Gemini AI
│   └── ws-chat/              # Module xử lý WebSocket Chat
├── db/                       # Chứa mã nguồn khởi tạo Database
│   └── init/
│       └── init.sql          # File SQL khởi tạo bảng dữ liệu
├── docker-compose.yml        # File cấu hình chạy hệ thống Docker
├── .env                      # File cấu hình môi trường và API Key
└── README.md

🛠 Hướng dẫn cài đặt
1. Yêu cầu hệ thống
Đã cài đặt Docker và Docker Compose.

API Key của Google Gemini (đặt trong file .env hoặc gemini.js).

2. Các bước cài đặt
Clone dự án:

Bash
git clone https://github.com/QuocVu00/Nhom12_chatbox.git
cd Nhom12_chatbox
Cấu hình môi trường: Kiểm tra file .env tại thư mục gốc và điền các thông tin cần thiết như API Key.

Chạy ứng dụng bằng Docker:

Bash
docker-compose up -d
📖 Hướng dẫn sử dụng
Bước 1: Đăng nhập / Đăng ký
Truy cập địa chỉ máy chủ (mặc định thường là localhost:3000).

Nhập Username và Password.

Nhấn Register để tạo mới hoặc Login để vào hệ thống.

Bước 2: Vào phòng chat
Tại ô "Room", nhập tên phòng bạn muốn tham gia (Ví dụ: lop12).

Nhấn Join để bắt đầu kết nối.

Bước 3: Chat và Hỏi AI
Chat thường: Nhập tin nhắn vào ô input và nhấn nút Send.

Hỏi Gemini AI: Nhập câu hỏi và sử dụng tính năng Hỏi Gemini AI để nhận phản hồi từ AI ngay trên màn hình log.

👥 Thông tin nhóm
Nhóm: 12

Dự án: Lập trình ứng dụng Chat Bot thông qua Socket.IO & MySQL.

Thành viên: Trần Như Đạt
            Nguyễn Lê Hồng Mai
            Huỳnh Đào Thanh Tùng
            Nguyễn Thị Thanh Vân
            Nguyễn Quốc Vũ