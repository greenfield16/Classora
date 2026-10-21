# Classora

[English](README.md) · [Cài đặt](docs/SELF_HOSTING.md) · [Database](docs/DATABASE.md) · [Trạng thái tính năng](docs/FEATURE_STATUS.md)

Classora là bộ công cụ giáo dục mã nguồn mở giúp giáo viên tổ chức ngân hàng câu hỏi, soạn đề, theo dõi kết quả và hỗ trợ học sinh ôn tập. Giao diện chủ yếu bằng tiếng Việt; hỗ trợ trắc nghiệm, đúng/sai và trả lời ngắn.

**Bản xem trước đang phát triển**, do **Joseph. MD** tự khởi tạo và duy trì, giấy phép **Apache-2.0**. Chưa phải hệ thống đã được kiểm định đầy đủ để vận hành với dữ liệu học sinh thật.

## Một luồng dữ liệu duy nhất

```text
Frontend Next.js → API NestJS → MongoDB
                       ├→ OpenAI tùy chọn
                       ├→ file thu âm lưu phía server
                       └→ R2 tùy chọn cho hình ảnh
```

Đăng nhập JWT, hồ sơ giáo viên, phản hồi, câu hỏi/đề thi, học sinh/kết quả, quiz/poll, flashcard và đề kỹ năng đều đi qua backend và MongoDB. Ứng dụng hiện không cần Firebase Auth, Firestore, Firebase Storage hoặc Firebase Functions. Khóa database và OpenAI không đưa xuống trình duyệt.

Ứng dụng mở thẳng vào khu vực giáo viên. Học sinh dùng các đường dẫn đề thi/ôn tập được chia sẻ. Trang giới thiệu là README này; ứng dụng không có trang bán hàng hoặc bảng giá.

## Tính năng

- Ngân hàng môn học/câu hỏi, soạn tay và import DOCX.
- Phát hành đề, trộn mã đề, tạo phiên thi thật, chấm và lưu điểm phía server.
- Danh sách học sinh/kết quả, phân tích câu hỏi và xuất báo cáo PDF.
- Quiz/poll, flashcard, ghép thẻ và ôn tập lặp lại.
- Đề kỹ năng, trả lời viết và nộp file ghi âm.
- AI tùy chọn qua OpenAI trực tiếp: sinh câu hỏi, giải thích, phân tích và đọc ảnh OMR. Chỉ cần `OPENAI_API_KEY` ở backend.

Xem [bảng trạng thái](docs/FEATURE_STATUS.md) để biết phạm vi đã kiểm tra. Chất lượng AI, chống lạm dụng, thời gian thi và vận hành production vẫn cần hoàn thiện.

## Chạy thử

Dùng Node 22 và database thử nghiệm riêng; xem [hướng dẫn đầy đủ](docs/SELF_HOSTING.md).

1. Chạy MongoDB riêng, ví dụ `docker compose -f docker-compose.local.yml up -d`.
2. Chép `backend/.env.example` thành `backend/.env`; đặt cấu hình MongoDB, JWT secret ngẫu nhiên và thông tin quản trị viên.
3. Trong `backend/`: `npm ci`, `npm run build`, `npm run seed`, `npm run start:prod`.
4. Chép `frontend/.env.example` thành `frontend/.env.local`, đặt URL backend.
5. Trong `frontend/`: `npm ci`, `npm run dev`; mở localhost:3000 rồi đăng nhập.

Có thêm Docker Compose cho môi trường phát triển. Thay đổi này **không tự chuyển hoặc xóa dữ liệu Firebase/MongoDB cũ**. Đọc [hướng dẫn database và chuyển dữ liệu](docs/DATABASE.md) trước khi đổi hệ thống đang dùng.

## Kiểm tra

- Backend: `npm test` và `npm run build`.
- Frontend: `npm run lint` và `npm run build`.
- Tích hợp MongoDB: trong `backend/`, chạy `TEST_MONGODB_URI=mongodb://127.0.0.1:27017 npm run test:integration` với MongoDB local dành riêng cho test. Test tạo database tên ngẫu nhiên, dùng dữ liệu giả rồi dọn database đó.

Kiểm thử tích hợp gọi cả adapter frontend thật qua HTTP, kiểm tra đăng nhập, phân quyền workspace, đề thi/nộp bài/chấm điểm, báo cáo PDF và bài kỹ năng/thu âm. Đây không phải kiểm thử trình duyệt hoặc micro thật; chưa gọi OpenAI bằng khóa thật.

Core parser/chấm điểm có thể dùng riêng: chạy `python3 scripts/export-core.py`, sau đó `npm ci`, `npm test`, `npm run demo` trong `artifacts/green-exams-core`. Core không cần database hoặc AI.

## Đóng góp và giấy phép

Xem [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) và [roadmap](ROADMAP.md). Không đưa khóa bí mật, dữ liệu học sinh hoặc nội dung đề không có quyền chia sẻ lên repo.

Copyright 2026 **Joseph. MD**. Mã nguồn/tài liệu gốc dùng [Apache-2.0](LICENSE); dependency giữ giấy phép riêng theo [NOTICE](NOTICE) và [third-party notices](THIRD_PARTY_NOTICES.md). Logo là chữ Classora. Public mã nguồn không đồng nghĩa cho phép công khai dữ liệu học sinh hoặc đề thi của bên khác.
