# Green Exams Core — local review candidate

A small independent TypeScript library for Vietnamese DOCX question import and four-statement true/false grading. **Unreleased development preview. Original source is licensed under Apache-2.0, Copyright 2026 Joseph. MD.** No Firebase, database, AI account, or commercial entitlement service is needed.

Use Node 22 and npm:

```sh
npm ci
npm test
npm run demo
```

```js
const { parseDocxBuffer, scoreTrueFalse } = require('./dist');
// const questions = await parseDocxBuffer(require('node:fs').readFileSync('synthetic.docx'));
const points = scoreTrueFalse([true, true, false, false], [true, true, true, true],
  { correct1: 0.1, correct2: 0.25, correct3: 0.5, correct4: 1 });
```

The DOCX test constructs synthetic XML in memory; no school exam material is included. Expected score in the demo is 0.25. Import supports top-level paragraphs labelled PHẦN I/II/III, Câu N., A.–D., a)–d), and Đáp án:. Underlining marks correct answers/true statements.

Limits: tables, images, equations and arbitrary Word layouts are not fully supported. Missing answer keys may remain undefined; review imported questions before use. The scorer expects boolean arrays for up to four statements and trusted finite scoring weights; it is not a complete exam submission validator. ZIP decompression limits and untrusted-document hardening remain release blockers for a hosted import service. This is a library, not a complete examination application. Test fixtures are newly authored for this preparation; author-supplied provenance and third-party distinctions are recorded in the project license review.

Tiếng Việt: Core độc lập đọc câu hỏi DOCX và chấm điểm đúng/sai; chạy ba lệnh trên bằng Node 22. Chưa phát hành public; mã gốc theo Apache-2.0, Copyright 2026 Joseph. MD. Không cần Firebase/MongoDB. Dữ liệu kiểm thử tự tạo, không chứa hồ sơ học sinh. Cần rà đáp án sau import; chưa hỗ trợ đầy đủ bảng, ảnh, công thức hoặc DOCX không tin cậy.
