# Feature status

Updated after the MongoDB consolidation, 2026-10-21. Code presence and the synthetic integration test do not certify production readiness.

| Feature | Current implementation | Validation / limits |
|---|---|---|
| Authentication | MongoDB users, bcrypt passwords, NestJS JWT; teacher-only protected routes | Login, password change, rejected anonymous/student requests tested |
| Subjects/question banks | Frontend HTTP adapter → NestJS → scoped MongoDB records | Creation, isolation and foreign subject references tested |
| DOCX import | Backend ZIP/XML parser via multipart API | Synthetic core tests; complex layouts and hostile ZIP hardening remain |
| Exam authoring/publication | MongoDB exams and generated variants | Basic publication and hidden public answer keys tested |
| Public submission | Real MongoDB session, random capability token, server grading | Frontend adapter round trip, persisted results, repeated submission and tenant isolation tested; complete timing/concurrency/recovery scenarios remain |
| Quiz/poll | Frontend now calls existing MongoDB APIs; former empty stubs removed | Synthetic creation/start/join tested; full classroom timing, load and browser behavior not established |
| Flashcards/matching | MongoDB cards, matching items and progress | Empty-set authoring, update, public data and owner isolation tested; SRS browser behavior remains |
| Skill exams | Scoped MongoDB templates/submissions; local recording files and metadata | Publish, hidden correct options, upload/playback, submission ownership and frontend adapter tested; timing/retention/real microphone testing remain |
| Camera/OCR grading | Existing NestJS OMR path now wired into frontend | Fixed-score mock removed; requires configured image storage/OpenAI; real image accuracy unverified |
| Question analytics | Existing NestJS analytics, now wired into frontend | Basic HTTP response tested; analytical correctness needs fixtures |
| PDF reports | Scoped MongoDB results, repaired bundled-font PDF generation | PDF bytes and cross-workspace rejection tested |
| AI support | NestJS → OpenAI Responses, server-only OPENAI_API_KEY | Mocked text/image/error tests; no live provider evaluation |
| Licensing | Inherited guard/service no-op stubs | No payment/entitlement enforcement claim |
| Self-hosting | One MongoDB API/auth path; no Firebase runtime dependency | Frontend/backend builds and fresh native MongoDB HTTP integration tested; Docker stack source-reviewed, not run locally |

Existing databases are untouched. See [migration](DATABASE.md), [setup](SELF_HOSTING.md), [validation](oss/VALIDATION.md) and [readiness](oss/READINESS.md). Historical Firebase-adapter findings in the UX audit no longer describe the active data path.
