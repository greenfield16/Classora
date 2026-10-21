# Classora

**Không gian quản lý đề thi cho giáo viên, kết hợp làm bài và ôn tập trên trình duyệt.**

[English](README.md) · [Cài đặt](docs/SELF_HOSTING.md) · [Trạng thái tính năng](docs/FEATURE_STATUS.md) · [Audit UX/UI](docs/ux/AUDIT.md) · [Roadmap](ROADMAP.md)

Classora tập hợp ngân hàng câu hỏi, soạn đề, import DOCX, kết quả học sinh và hoạt động ôn tập trong một dự án giáo dục. Giao diện chủ yếu bằng tiếng Việt, hỗ trợ câu hỏi trắc nghiệm, đúng/sai và trả lời ngắn.

Phạm vi dự kiến công khai là **toàn bộ ứng dụng**: frontend, backend, Firebase Functions, rules, kiểm thử và tài liệu. Core đọc DOCX/chấm điểm vẫn có thể trích xuất để dùng riêng.

> **Bản xem trước dành cho phát triển.** Đây là bản source preview đang phát triển; mã gốc được cấp phép Apache-2.0, ghi tên Joseph. MD; dependency giữ license riêng. Một số tính năng hiển thị chưa hoàn thiện. Chưa xác nhận an toàn production cho dữ liệu học viên thật.

## Dự án gồm những gì?

- Workspace giáo viên: quản lý môn/câu hỏi, soạn đề, xem kết quả và hồ sơ học sinh.
- Import DOCX có cấu trúc tiếng Việt; kiểm thử tổng hợp bao phủ ba loại câu hỏi.
- Giao diện vào thi, trả lời có thời gian, nộp bài và xem kết quả.
- Giao diện flashcard/SRS, ghép đôi, quiz và bình chọn với mức tích hợp khác nhau.
- Đề kỹ năng reading, listening/TTS, writing, quiz và mã thu âm/gửi bài qua trình duyệt.
- AI tùy chọn: sinh câu hỏi, giải thích và phân tích qua OpenAI trực tiếp (chỉ cần API key phía server).

**Có giao diện không đồng nghĩa luồng đã hoàn chỉnh.** Adapter Firebase của quiz/poll đang là stub; chấm camera trả điểm giả cố định; analytics/PDF còn thiếu tích hợp. Nộp bài công khai còn vấn đề session/xác thực. Xem [bảng trạng thái](docs/FEATURE_STATUS.md) trước khi thử hoặc triển khai.

Ứng dụng mở thẳng vào workspace giáo viên tại `/`; người chưa đăng nhập được chuyển tới `/admin/login`. Học sinh dùng trực tiếp link bài thi/ôn tập được chia sẻ. Phần giới thiệu và cài đặt nằm trong README; ứng dụng không còn landing bán hàng hay bảng giá.

## Kiến trúc

| Thư mục | Vai trò |
|---|---|
| `frontend/` | Next.js 16 / React 19, static export, Firebase SDK |
| `backend/` | NestJS 12, MongoDB/Mongoose, JWT riêng, parser DOCX và dịch vụ báo cáo |
| `functions/` | Firebase callable functions, chấm điểm và AI tùy chọn |
| `core/` | Mẫu package độc lập và kiểm thử domain |
| `docs/`, `scripts/` | Hướng dẫn, audit, chuẩn bị phát hành và inventory |

Giao diện chính hiện dùng Firebase Auth/Firestore/callable functions. Backend NestJS/MongoDB có đường xác thực và dữ liệu riêng. Chỉ đổi URL API chưa đủ để chuyển toàn giao diện sang MongoDB.

## Thử ví dụ local đã kiểm tra

Dùng Node 22 (`.nvmrc`), npm và Python 3:

```sh
python3 scripts/export-core.py
cd artifacts/green-exams-core
npm ci
npm test
npm run demo
```

Ví dụ không cần Firebase, MongoDB hoặc AI. Demo trả điểm **0.25**; kiểm thử dùng câu hỏi tự tạo. Exporter không ghi đè candidate cũ; hãy chuyển bản cũ sang chỗ khác trước khi tạo lại.

## Phát triển toàn ứng dụng

Làm theo [hướng dẫn cài đặt/tự host](docs/SELF_HOSTING.md) trong bản sao mới với dịch vụ thử nghiệm riêng. Hướng dẫn phân biệt backend MongoDB với frontend Firebase, nêu biến môi trường và rewrite cho static hosting.

```sh
# Sau khi cấu hình backend/.env local riêng
cd backend
npm ci
npm test
npm run build

# Sau khi cấu hình frontend/.env.local cho Firebase thử nghiệm
cd ../frontend
npm ci
npm run lint
npm run build
npm run dev

cd ../functions
npm ci
npm run lint
npm run build
```

Chưa có quy trình production một lệnh. Cần sửa [blocker phát hành](docs/oss/READINESS.md), nhất là nộp bài công khai, phân quyền giáo viên/tenant, rules và khôi phục bài làm. AI/storage bên ngoài cần cấu hình và có thể phát sinh phí dịch vụ.

## Chất lượng và giới hạn

Lần kiểm tra local gần nhất: 9 test backend đạt, lint frontend 0 warning, build frontend/backend/Functions đạt. Chưa có kiểm chứng đầy đủ E2E MongoDB/Firebase, thiết bị thu âm thực, tuân thủ accessibility hay production.

Audit dependency backend/Functions và frontend production sạch ở lần kiểm tra gần nhất; dependency phát triển frontend còn một advisory `braces` chưa có bản vá, được tính thành 7 mục. Xem [kết quả kiểm tra](docs/oss/VALIDATION.md), [báo cáo dependency](docs/oss/WARNING-CLEANUP.md) và [audit UX/UI Impeccable](docs/ux/AUDIT.md).

## Đóng góp và phát hành

Ưu tiên: nộp bài đáng tin cậy, form/dialog truy cập được bằng bàn phím, hiển thị đúng trạng thái tính năng, lưu nháp, rules tests và hướng dẫn triển khai. Đọc [CONTRIBUTING.md](CONTRIBUTING.md), chỉ dùng dữ liệu tổng hợp và ghi rõ nguồn mã/ảnh. Đóng góp tuân theo Apache-2.0 như mô tả trong CONTRIBUTING.md.

Kênh báo lỗi bảo mật riêng tư cần chủ dự án xác nhận theo [SECURITY.md](SECURITY.md). Copyright 2026 **Joseph. MD**. Mã gốc và tài liệu theo [Apache-2.0](LICENSE); xem [NOTICE](NOTICE), [thông báo bên thứ ba](THIRD_PARTY_NOTICES.md), [license/nguồn gốc](docs/oss/LICENSE-DECISION.md) và [checklist public toàn dự án](docs/oss/FULL-PROJECT-PUBLICATION.md).

Phạm vi public là mã ứng dụng đề thi này; EDU ERP/EduEng thương mại, secret, hồ sơ/thu âm học sinh, backup và đề thi chưa có quyền phân phối nằm ngoài gói phát hành.
