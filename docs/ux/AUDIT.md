# Green Exams — audit UX/UI Impeccable

Ngày: 21/10/2026. Phạm vi: toàn bộ 12 route page (sau khi gỡ external SSO) và 13 mục điều hướng quản trị. Phương pháp: Impeccable **audit** kỹ thuật, rà luồng mã nguồn, detector và kiểm tra trình duyệt local; không phải quy trình `critique` hai đánh giá độc lập. Đợt này chỉ audit và sửa tài liệu, chưa sửa giao diện hay nghiệp vụ.

## Kết luận về tính nhất quán triển khai

**Chưa đạt để giới thiệu như một ứng dụng thi hoàn chỉnh.** Điểm yếu lớn nhất là khoảng cách giữa lời hứa sản phẩm và hành vi thực: trang chủ nói OCR, quiz/poll, PDF và thanh toán đã hoạt động, trong khi adapter hiện trả mock/null. Palette xanh lime, nền sáng và nhóm điều hướng đã tạo bản sắc; cần giữ nền tảng này và sửa độ tin cậy, accessibility và các bước hoàn thành công việc trước khi trang trí thêm.

## Cập nhật sau audit — bỏ landing bán hàng

Theo quyết định của chủ dự án, `/` hiện chuyển tới `/admin`; người chưa đăng nhập tiếp tục tới `/admin/login` bằng guard hiện có. Landing, bảng giá và các claim marketing cũ đã được gỡ khỏi route Home. Link “Về trang chủ” ở login được thay bằng hướng dẫn học sinh dùng link giáo viên chia sẻ. UX-08 về nội dung Home được xử lý bằng việc loại bỏ surface này; đây không phải sửa các mock/capability trong workspace (UX-04 vẫn mở). Điểm bên dưới giữ nguyên làm baseline audit, chưa phải điểm tái audit sau sửa.

## Điểm sức khỏe kỹ thuật

| Khía cạnh | Điểm /4 | Bằng chứng chính |
|---|---:|---|
| Accessibility | 1 | Đăng nhập không có accessible name cho input; dropdown/dialog thiếu ngữ nghĩa và Escape |
| Performance | 2 | Client tải câu hỏi tuần tự; CSS/font dư; chưa đo runtime với dữ liệu thực |
| Responsive | 2 | Có breakpoint, bảng cuộn và touch sizing; mobile nav 13 mục và kiểm chứng còn thiếu |
| Theming | 2 | Có token và component chung nhưng exam/flashcard dùng nhiều màu/font/radius riêng |
| Implementation integrity | 1 | Mock chấm điểm và tính năng stub xuất hiện như đã hoàn thiện |
| **Tổng** | **8/20 — cần cải thiện lớn** | Điểm đánh giá dựa trên phạm vi có bằng chứng, không phải chứng nhận WCAG |

**16 phát hiện:** 4 P0, 7 P1, 5 P2. Không cộng 7 tín hiệu detector thành 7 lỗi độc lập; đã xác minh và loại false positive.

## Phạm vi, bằng chứng và giới hạn

- Đọc mã toàn bộ 13 `page.tsx` tại thời điểm audit (hiện còn 12 sau khi gỡ external SSO), các client tương ứng, 5 panel quản trị/shared UI, CSS, adapter Firebase, skill-exam service và callable grading liên quan.
- Desktop 1440×1000: xem trang chủ, đăng nhập, overview, ngân hàng câu hỏi, import dialog và 11 mục còn lại (đề thi, kỹ năng, kết quả, phân tích, học sinh, quiz, poll, flashcard, hướng dẫn, góp ý, hồ sơ). Dùng danh tính **tổng hợp local**; CSP chặn mọi cloud connection, không truy cập dữ liệu production.
- Mobile thực tế của IAB: 421×1763 cho trang chủ và đăng nhập. Chưa hoàn thành lượt 390×844/admin vì công cụ báo **Local browser use is disabled in Work settings**. Không tuyên bố đã kiểm tra đầy đủ mobile, tablet, touch gesture hay thiết bị thật.
- Thử Escape trên dropdown Lớp 10 và import dialog: cả hai vẫn mở. DOM dropdown không có aria-expanded/listbox; dialog có 0 phần tử role=dialog/dialog. Sau đóng dialog bằng chuột, focus không quay lại trigger.
- Input đăng nhập: 2/2 không có label liên kết, aria-label hoặc autocomplete. Panel measurement ghi nhận 38 input không có accessible label trong 44 input của 11 panel đo; số này chỉ thuộc trạng thái ban đầu/không dữ liệu, không phải toàn bộ field có điều kiện.
- Các route mã giả/public và trang in trên preview trả trang lỗi trình duyệt. Đây là **giới hạn preview**, không đủ kết luận lỗi production. Khi rà mã thấy static params chỉ có placeholder; cần kiểm thử host thực để xác minh code/ID sau rewrite. Các ảnh lỗi preview không được dùng làm bằng chứng giao diện sản phẩm.
- Không chạy axe, Lighthouse, screen reader thật, full assessment E2E, microphone/camera, backend DB hay Firebase emulator. Các nhận định về timing, submission, ownership và mocks là bằng chứng mã nguồn, chưa tái hiện với dữ liệu cloud.
- Context loader chạy một lần; PRODUCT.md chưa tồn tại, DESIGN.md có nhiều chi tiết tham chiếu Brainfish/Satoshi không khớp font đang dùng. Ghi nhận drift, chưa tự sửa design context.

## Các lỗi chặn hoàn thành công việc — P0

### UX-01 — Luồng nộp bài công khai thiếu context và xác thực phù hợp

**Vị trí:** `frontend/src/lib/firebase-api.ts:725`, `:789`; `functions/src/index.ts:185`; `frontend/src/app/e/[code]/client-page.tsx:132`.

`startSession` bỏ qua thông tin học sinh, tạo session ID trên client. `submitSession` đọc `current_exam_id`/`student_info` từ localStorage, nhưng tìm kiếm toàn frontend không thấy luồng này ghi các key đó. Callable yêu cầu `context.auth`, trong khi trang học sinh không tạo phiên Firebase. Học sinh có thể trả lời xong nhưng không nộp được; nếu storage có context cũ còn có nguy cơ gắn sai bài/thông tin.

**Khuyến nghị:** một session server có exam/student binding và token nộp bài phù hợp; truyền context tường minh, có receipt, idempotency và test anonymous flow. Không chỉ thêm key localStorage để che lỗi. **Tiêu chí đạt:** trình duyệt sạch vào mã mới, làm bài/nộp/retry đều ghi đúng một submission đúng học sinh. **Command:** `$impeccable harden`.

### UX-02 — Tự nộp khi hết giờ có thể dùng closure cũ; retry làm mất countdown

**Vị trí:** `frontend/src/app/e/[code]/client-page.tsx:156–190`.

Effect timer chỉ phụ thuộc screen, giữ `handleSubmit` từ render lúc bắt đầu thi; lúc đó session/answers có thể chưa cập nhật. Callback hết giờ có thể return vì session null hoặc dùng đáp án cũ. Nộp thủ công dừng timer trước request; nếu request lỗi, screen vẫn exam nhưng effect không khởi động lại timer. Đây là rủi ro trực tiếp với tính công bằng và hoàn tất bài thi.

**Khuyến nghị:** deadline tuyệt đối do server xác nhận, submit đọc state hiện tại bằng cơ chế rõ ràng; retry giữ deadline và snapshot đáp án. **Tiêu chí đạt:** fake-clock test nhập đáp án sau khi bắt đầu, hết giờ nộp đáp án mới nhất; request lỗi không đóng băng thời gian. **Command:** `$impeccable harden`.

### UX-03 — Câu đúng/sai chưa trả lời bị biến thành đáp án Sai

**Vị trí:** `frontend/src/app/e/[code]/client-page.tsx:174–179`.

Chuyển `null` sang `false` làm mất khác biệt giữa bỏ trống và chọn Sai. Mệnh đề có key false có thể nhận điểm dù học sinh chưa trả lời; phần tiến độ cũng coi câu đúng/sai trả lời một ý là đã trả lời. Hiển thị điểm và số câu hoàn thành có thể gây hiểu nhầm.

**Khuyến nghị:** giữ trạng thái unanswered xuyên suốt schema/chấm điểm, đếm hoàn thành theo tất cả ý bắt buộc, hiển thị số ý bỏ trống khi xác nhận. **Tiêu chí đạt:** bỏ trống không nhận điểm; partial answer có thống kê và cảnh báo đúng. **Command:** `$impeccable harden`.

### UX-04 — Nút tính năng gọi stub hoặc trả điểm giả nhưng không thông báo

**Vị trí:** `frontend/src/lib/firebase-api.ts:668`, `:817–857`; các panel quiz/poll/analytics.

Camera trả cố định 8.5 và số báo danh giả; quiz/poll trả null/empty/success; PDF trả null; analytics trả tập rỗng. Người dùng có thể tin đã chấm, lưu, xóa hay khởi chạy thành công dù chưa có nghiệp vụ tương ứng. Backend có mã khác không làm đường Firebase tự hoạt động.

**Khuyến nghị:** capability matrix dùng thật ở UI, khóa thao tác chưa hỗ trợ với giải thích/hướng đi thay thế; loại mock khỏi đường đánh giá thật. **Tiêu chí đạt:** mọi thao tác có kết quả persisted kiểm chứng được hoặc thông báo “chưa hỗ trợ”; tuyệt đối không hiển thị điểm mô phỏng như kết quả học sinh. **Command:** `$impeccable harden`, `$impeccable clarify`.

## Các lỗi lớn — P1

### UX-05 — Form có chữ label nhưng thiếu accessible name

**Vị trí:** `frontend/src/app/admin/login/page.tsx:90–113`; `AdminUI.tsx:176`; `SkillsExamPanel.tsx:228–232`; public exam form `client-page.tsx:380`.

Label là sibling không có htmlFor/id; nhiều form chỉ có placeholder. Trình đọc màn hình/voice control không liên kết được tên trường. Đã đo 2/2 input login và 38/44 input ở 11 panel không có label liên kết. **WCAG:** 1.3.1, 3.3.2, 4.1.2. **Khuyến nghị:** primitive FormField dùng useId, label/error/help liên kết, required/invalid/autocomplete đúng. **Tiêu chí:** accessible name đúng, click label focus input, lỗi đọc được. **Command:** `$impeccable harden`.

### UX-06 — Dropdown không hỗ trợ kỳ vọng bàn phím/ARIA

**Vị trí:** `frontend/src/components/admin/AdminUI.tsx:146–225`.

FormSelect dùng button + danh sách button, thiếu expanded/controls/selected/listbox, không Escape/arrow/typeahead/focus-return. Đã xác nhận Escape không đóng. Tab có thể đi qua từng lựa chọn nhưng không tương đương combobox chuẩn. **WCAG:** 2.1.1, 4.1.2; đối chiếu ARIA APG. **Khuyến nghị:** native select cho lựa chọn đơn hoặc primitive đã triển khai đầy đủ keyboard semantics. **Command:** `$impeccable harden`.

### UX-07 — Modal không có focus lifecycle hoặc ngữ nghĩa dialog

**Vị trí:** import modal trong `ExamPanel.tsx:330` trở đi; bank modal trong QuizLivePanel/PollLivePanel.

Import dialog vẫn để focus ở trigger phía dưới, Escape không đóng; DOM không có dialog role. Background không inert và focus sau đóng rơi về body. Có nguy cơ dùng bàn phím thao tác form phía sau trong khi dialog hiện. **WCAG:** 2.4.3, 4.1.2; keyboard/focus cần test đầy đủ. **Khuyến nghị:** dialog primitive có title, initial focus, trap, Escape, focus restoration và dirty confirmation. **Command:** `$impeccable harden`.

### UX-08 — Trang chủ có claim chưa có bằng chứng và lời hứa thanh toán không khớp

**Vị trí:** `frontend/src/app/page.tsx:121–236`, `:488`, `:522–547`.

Các số “80%”, “5 giây”, “100%”, “hàng trăm giáo viên”, OCR/quiz/PDF “Có sẵn”, kích hoạt tự động qua QR và tax ID chưa được xác minh. “Dùng thử” chỉ chuyển tới login; không có onboarding tạo tài khoản. Với định hướng public toàn app, khách mới không phân biệt nguồn mở, host có phí và tính năng thử nghiệm.

**Khuyến nghị:** thay bằng mô tả có kiểm chứng và bảng trạng thái; nêu rõ tài khoản do ai cấp, chi phí nhà cung cấp, license; xác nhận thông tin pháp nhân/liên hệ trước khi hiển thị. Không tự đặt thông tin thay thế. **Command:** `$impeccable clarify`, `$impeccable onboard`.

### UX-09 — Bài đang làm/thu âm chỉ ở RAM, thiếu phục hồi khi reload hoặc rớt mạng

**Vị trí:** public exam state `:97–128`; public skills state `:115–118`, `:135–153`.

Exam chỉ lưu kết quả sau nộp, chưa lưu nháp. Skills giữ text/blob trong component, upload audio rồi mới submit; request lỗi có thể khiến retry upload lại và reload mất toàn bộ công sức. Cảnh báo “không reload” không thay cho khả năng phục hồi.

**Khuyến nghị:** draft gắn session, autosave có trạng thái và thời điểm, IndexedDB cho blob có chính sách xóa, resume/retry/idempotency; giải thích lưu dữ liệu nhạy cảm trên máy dùng chung. **Command:** `$impeccable harden`.

### UX-10 — Thi kỹ năng đếm về 0 nhưng không chặn/nộp theo deadline

**Vị trí:** `frontend/src/app/skills/[code]/client-page.tsx:122–153`, `:166`.

Timer chỉ clamp về 0; không có submit/enforcement khi hết giờ, không kiểm tra deadline trong hàm submit. Người dùng không biết còn được làm hay bài đã kết thúc. **Khuyến nghị:** thống nhất policy thời gian, deadline server, cảnh báo có thể đọc bằng assistive tech, xử lý bài/thu âm đang upload khi hết giờ. **Command:** `$impeccable harden`, `$impeccable clarify`.

### UX-11 — Fullscreen tự nộp bài sau lần thoát thứ hai, thiếu thông báo trước tương xứng

**Vị trí:** public exam `client-page.tsx:193–248`, phần hướng dẫn trước thi `:350`.

Mã yêu cầu fullscreen sau async delay và tự submit khi thoát hai lần. Quyền fullscreen có thể bị trình duyệt từ chối; chuyển app, accessibility, sự cố thiết bị có thể bị xem là vi phạm. Hướng dẫn trước thi không nói rõ quy tắc hai lần. **Khuyến nghị:** bỏ auto-submit chỉ từ fullscreen; nếu trường cần policy, nêu rõ trước bắt đầu, có lựa chọn hỗ trợ và xác minh sự kiện. **Command:** `$impeccable harden`, `$impeccable clarify`.

## Các vấn đề kế tiếp — P2

### UX-12 — Request lỗi hiển thị như chưa có dữ liệu

**Vị trí:** `ExamPanel.tsx:2991`, `:3737–3750`; overview screenshot.

Catch rỗng làm stats 0, môn trống hoặc analytics trống mà không phân biệt lỗi mạng/quyền với “chưa có”. Trong preview chặn cloud, overview vẫn trình bày số 0 và “chưa có” như dữ liệu thật. **Khuyến nghị:** loading/error/empty/success riêng, retry và giữ dữ liệu cũ với nhãn stale; không biến failure thành zero. **Command:** `$impeccable harden`.

### UX-13 — Điều hướng mobile chứa 13 tab trong dải cuộn ẩn scrollbar

**Vị trí:** `ExamPanel.tsx:280–325`; `globals.css` bf-scrollbar-none.

72px mỗi mục, 13 mục đòi cuộn ngang đáng kể; các mục hỗ trợ/hồ sơ có thể bị ẩn và lựa chọn không hiện aria-current. Desktop đã nhóm hợp lý nhưng mobile làm mất cấu trúc đó. **Bằng chứng:** mã nguồn, chưa test gesture/viewport admin. **Khuyến nghị:** 4 nhiệm vụ chính + menu “Thêm” có nhóm, giữ vị trí active, URL/deep link; test 320/390/768px và touch thật. **Command:** `$impeccable adapt`, `$impeccable shape`.

### UX-14 — Hệ token và khả năng đọc chưa đồng nhất

**Vị trí:** `globals.css:1–88`, `AdminUI.tsx:181–195`; exam/flashcard inline styles.

DESIGN.md nói Satoshi nhưng CSS dùng system font và tải Inter/Outfit ngoài dù UI không dùng làm font chính; landing/admin/exam pha ba ngôn ngữ thị giác. Placeholder #94a3b8 trên white xấp xỉ 2.56:1; không đạt 4.5:1 nếu đóng vai trò chỉ dẫn cần đọc. Focus lime trong suốt trên trắng cần đo sau blend; không kết luận toàn site đạt contrast. **WCAG:** 1.4.3 cho nội dung cần thiết; focus cần đo riêng. **Khuyến nghị:** giữ palette hiện có, chuẩn hóa semantic token/form/focus, bỏ request font không dùng, đo từng cặp thực tế. Dark mode không phải yêu cầu của brief light. **Command:** `$impeccable typeset`, `$impeccable extract`.

### UX-15 — Reduced motion dùng global kill; progress animate width

**Vị trí:** `globals.css:460` vùng prefers-reduced-motion; flashcard `client-page.tsx:545`; quiz live `:132`.

Global 0.01ms làm mất feedback loading/transitions thay vì đưa trạng thái tĩnh rõ ràng. Progress width tạo layout update nhưng chỉ cập nhật theo card, chưa có bằng chứng jank nghiêm trọng. Bounce waiting icon liên tục dễ gây phân tán. **Khuyến nghị:** reduced-motion theo component với trạng thái loading dạng text/progress tĩnh; progress transform scaleX và feedback trạng thái không phụ thuộc animation. **Command:** `$impeccable animate`, `$impeccable optimize`.

### UX-16 — In/route mã động thiếu acceptance test; tải câu hỏi tuần tự

**Vị trí:** dynamic `page.tsx` generateStaticParams placeholder, `firebase.json` rewrites; `firebase-api.ts:743–769`; `admin/exam-print/[id]/client-page.tsx:31`.

Static route giả lập và route state chưa chứng minh code thật được truyền đúng sau rewrite; flashcard đã có fallback pathname riêng, các page khác dùng useParams trực tiếp. Trang in tìm đề trong 100 đề đầu thay vì lấy theo ID. Start exam đọc mỗi question bằng await tuần tự nên latency cộng dồn và không có tiến độ/retry từng phần.

**Khuyến nghị:** smoke test deployed static host với code/ID thật và direct refresh; API getById, snapshot câu hỏi theo session hoặc bounded parallel fetch; test font/page-break A4 với nội dung dài. **Command:** `$impeccable harden`, `$impeccable optimize`.

## Detector: 7 tín hiệu, 6 loại, 4 file

Kết quả thô nằm ở `impeccable-detector.json`. Exit 2 nghĩa có findings, không phải tool crash.

| Tín hiệu | Số | Xác minh |
|---|---:|---|
| side-tab | 3 | Hai ở AdminUI là CSS tam giác mũi tên dropdown: false positive. Một là blockquote trong rich editor, có vai trò nội dung hợp lệ; không xem là card anti-pattern |
| overused-font | 1 | Import Google Inter có thật nhưng font UI đang system; vấn đề đáng xử lý là request dư và drift, không phải font phổ biến tự nó sai |
| codex-grid-background | 1 | Detector gắn CSS quanh dot-bg; dot background trang login là trang trí. Không thấy measurement grid; mức ưu tiên thấp, không blocker |
| layout-transition | 1 | Width transition progress flashcard có thật; P2, chưa chứng minh rớt frame |
| bounce-easing | 1 | Waiting icon quiz animate-bounce có thật; P2 motion, chưa xác minh runtime live vì adapter stub |

## Điểm tốt cần giữ

- Sidebar desktop chia nhóm theo công việc; primary action lime/black nhất quán ở component chung.
- Import có file mẫu DOCX tự tạo, hướng dẫn đáp án và preview trước commit; JSON nâng cao nằm trong disclosure thay vì chiếm màn hình chính.
- Có loading, disable khi saving và xác nhận trước nộp/xóa ở nhiều luồng; cần chuẩn hóa và thêm live announcement.
- Có breakpoint, mobile font input admin 16px, table overflow container và safe-area bottom; nền tảng responsive đã có.
- Skills ghi rõ TTS, hỗ trợ playback/recording và thông báo lỗi quyền microphone; cần thêm draft/retention chứ không thay toàn bộ flow.

## Thứ tự sửa đề xuất

1. **P0 — `$impeccable harden`:** session/submission, timeout, unanswered grading; test browser sạch và mạng lỗi.
2. **P0/P1 — `$impeccable clarify`:** đánh dấu capability/stub; sửa claim trang chủ theo evidence và ý định public toàn app.
3. **P1 — `$impeccable harden`:** FormField, select/dialog native hoặc chuẩn ARIA; focus/keyboard/error summary.
4. **P1 — `$impeccable harden`:** autosave/resume, audio retry và deadline skills; xem lại fullscreen policy.
5. **P2 — `$impeccable adapt`:** mobile navigation, form 320–768px, zoom 200%, touch gesture và safe-area.
6. **P2 — `$impeccable optimize` / `$impeccable typeset`:** fetch câu hỏi, code splitting theo panel, font/token/contrast và reduced motion.
7. **Cuối — `$impeccable polish`:** một lượt desktop/mobile hoàn chỉnh sau khi nghiệp vụ và accessibility đã đạt.

Có thể thực hiện các nhóm trên từng bước hoặc trong một đợt; chạy lại `$impeccable audit` sau sửa để so sánh bằng cùng phạm vi. Đợt này không mở rộng thành redesign hay tự chọn license.

## Run notes

Context loader và CLI detector chạy thành công. Browser desktop/mobile công khai dùng IAB, không inject detector overlay vì evaluate chỉ read-only và CSP chặn cloud. Evidence screenshot/snapshot đo từ build static có sẵn, không phải data fixtures goldens. Ảnh được lưu trong evidence/; public-route-measurements.json ghi lỗi preview và chỉ dùng để thể hiện giới hạn, không để chấm sản phẩm. Khi quyền browser bị tắt, không tiếp tục browser automation bằng công cụ khác. Preview server local được dừng khi hoàn tất; temporary server code không đưa vào source phát hành. Không thay UI source, không seed, không submit, không ghi cloud, không dùng tài khoản thật.
