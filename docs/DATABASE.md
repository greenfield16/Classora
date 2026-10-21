# Database architecture and migration

## Authoritative path

```text
Next.js frontend ── HTTP/JWT ── NestJS API ── MongoDB (one named mgmt connection)
                                      ├── OpenAI (server-only key)
                                      ├── local skill recording files
                                      └── optional R2-compatible image storage
```

`MONGODB_URI` and `MONGODB_DB` are the only database settings. Frontend code has no database credentials and imports no Firebase SDK. User passwords are bcrypt hashes in MongoDB; JWT validation reloads the active user and derives the workspace scope from `organizationId`, or that user's `_id` when no organization is assigned. Teacher APIs reject student identities. Sharing an organization is an explicit server-side account-management decision, not a browser field.

| Domain | MongoDB collections |
|---|---|
| Identity/profile/feedback | `users`, `teacher_profiles`, `teacher_feedback` |
| Question bank/exams | `exam_subjects`, `exam_questions`, `exams`, `exam_variants` |
| Students/results | `students`, `exam_sessions`, `exam_results`, `answer_sheets`, `exam_session_logs` |
| Quiz/poll | `quiz_sets`, `quiz_sessions`, `quiz_participants`, `quiz_answers`, `poll_sets`, `poll_sessions`, `poll_participants`, `poll_responses` |
| Flashcards | `flashcard_sets`, `flashcard_progress` |
| Skill exams | `skill_exam_templates`, `skill_exam_submissions`, `skill_recordings` |

A public exam start creates a real session and returns an independent random session token. The frontend keeps that token in sessionStorage; the server stores its hash. Submission/explanation access requires the token, not an ObjectId alone. Grading happens on the backend from server-side answer keys. Skill submissions derive ownership from the published template; client-supplied owner fields cannot move data to another teacher. Public skill responses omit correct quiz options and invite lists.

## Existing Firebase projects

No live Firebase access was performed. Firestore data, Firebase Auth accounts and Storage objects remain where they were. Removing the SDK/config from this repository does not delete a cloud project, disable deployed functions or change existing rules. If a former deployment remains active, separately review its access and retirement.

A Firebase password hash is not a MongoDB bcrypt password. Existing users need a deliberate account import/reset process; the administrator seed does not silently convert Firebase identities.

For an actual migration:

1. Back up Firestore, Firebase Auth account metadata and Storage files. Keep exports outside Git.
2. Create a new staging MongoDB database and accounts. Map each Firebase owner UID to a MongoDB user and workspace; never infer ownership from a missing field.
3. Map document IDs to ObjectIds and update every relation (subjects, questions, exams, templates, results, flashcard references). The old `subjects`/`questions` collections map to `exam_subjects`/`exam_questions` in this schema.
4. Convert timestamps, enum values, published exam variants/answer keys, attempts/session records and storage URLs explicitly. Re-publish imported draft exams only after checking their question and scoring mappings. Preserve historical results rather than recomputing them blindly.
5. Import recording binaries into persistent storage and verify their metadata/playback links. Validate counts, references, ownership boundaries and representative grades against the backup.
6. Rehearse the switch in staging, arrange password resets, stop writes on the old application, take a final backup and switch the frontend API URL. Keep a rollback window and decide retention/retirement separately.

This release does not include a generic automatic Firestore importer: the source schemas and existing exported data must be inspected before a safe field/account mapping can be written.

## Existing MongoDB deployments

Unscoped legacy records are now excluded from workspace queries. They are not deleted. Assign their correct organization only after confirming ownership; do not bulk assign them to whoever logs in first.

The subject unique index is now `(organizationId, code)`; the student unique index includes `organizationId` plus name/class/year/school. On an old database, inspect indexes and duplicates first. MongoDB will not automatically remove old global unique indexes just because the schema changed. Back up and explicitly replace obsolete global indexes only after reviewing the intended tenant mapping. Fresh installations create the new indexes normally.

Legacy environment aliases (`MONGO_URI_MGMT`, `MONGODB_URI_MGMT`, `MONGODB_DB_MGMT`) are no longer read. Set the canonical settings explicitly; verify the database name before startup. The change was tested only on newly created synthetic databases, not applied to an existing installation.

## Operational boundaries

MongoDB backups do not include local recording files. Back up both consistently and test restoration. Public join/submission/media routes still need deployment-level rate/abuse controls and a student-data retention policy. `skill_recordings` playback URLs are capability links, not teacher login checks. Do not advertise this development preview as a fully audited production assessment system.
