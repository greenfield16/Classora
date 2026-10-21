# Feature status

Source-reviewed 2026-10-21. “Implemented” below means code exists; it does not assert production readiness or end-to-end verification.

| Feature | Current evidence | Status / limitation |
|---|---|---|
| DOCX import | Backend ZIP/XML parser; separate browser parser; synthetic core tests | Backend basic paragraphs verified; browser parity, complex layouts and untrusted upload hardening remain |
| Subjects/question banks | Firestore adapter and teacher UI | Implemented; ownership/rules and failure-state work remain |
| Exam authoring | UI and Firebase/backend models | Implemented; full lifecycle and variant parity not verified |
| Public exam submission | UI + Firebase gradeExam callable | Blocked: missing session context persistence, anonymous/auth mismatch and timeout closure risk |
| Quiz Live | UI/backend implementation, Firebase methods returning null/empty/fixed values | Current Firebase UI path is incomplete; do not advertise as working live service |
| Poll Live | UI/backend implementation, Firebase methods returning null/empty | Current Firebase UI path is incomplete |
| Matching from quiz | Public UI uses getPublicQuizSet stub | Current adapter cannot supply a playable set |
| Flashcard/SRS | Firestore adapter + review/matching UI | Implemented; algorithm/browser/persistence E2E not verified |
| Skill exams | Template editor, public page, recording upload/submission | Implemented; timing enforcement, recovery, retention and authorization incomplete |
| Camera/OCR grading | Firebase scanAndGrade returns fixed 8.5/mock student number | Mock; never use its output as an actual assessment result |
| Question analytics | Firebase adapter returns empty analytics | Placeholder in current UI path |
| PDF result export | Backend report service, Firebase downloadPdfReport returns null | Incomplete UI integration; report generation not validated end-to-end |
| AI support | Callable functions and direct OpenAI Responses API | Requires server-side OPENAI_API_KEY; outputs require teacher review; live provider calls not yet validated |
| Entitlements | Licensing guard/service return success | Existing no-op stubs; pricing/payment activation is not established |
| Full self-hosting | Separate Firebase frontend and MongoDB/JWT backend | Architecture convergence and reproducible full deployment remain roadmap work |

See [UX/UI audit](ux/AUDIT.md), [readiness](oss/READINESS.md) and [validation](oss/VALIDATION.md) for evidence and remaining work.
