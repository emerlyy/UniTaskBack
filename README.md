# UniTaskBack Backend

NestJS + TypeORM backend for managing courses, tasks, student submissions, and automated evaluation built around the schema specified in the project brief.

## Prerequisites

- Node.js 18+
- PostgreSQL 13+
- npm 8+

## Environment

Create a `.env` file (or export the variables) with at least:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=unitask
JWT_SECRET=super-secret
FILES_DIR=uploads
# Optional overrides
# JWT_ACCESS_EXP=15m
# JWT_REFRESH_EXP=7d
# EVAL_MODEL_ID=Xenova/paraphrase-MiniLM-L6-v2
# EVAL_NLI_MODEL_ID=Xenova/nli-deberta-v3-small
# TRANSFORMERS_CACHE=./.cache/transformers
```

`FILES_DIR` is used for uploaded and reference files. The server exposes them under `/uploads/*`.

## Install & Build

```bash
npm install
npm run build
```

## Start the API

```bash
# development
npm run start:dev

# production build
npm run start:prod
```

The server listens on port `3000` by default (override with `PORT`). Static files are served from `/uploads`.

## Key modules & endpoints

- **Auth** (`/auth`) — register, login, refresh, logout. Passwords hashed with bcrypt; access + refresh JWTs returned. All private routes require `Authorization: Bearer <token>`.
- **Files** (`/files/upload`) — authenticated multipart upload (`files` field). Accepts PDF, DOC, DOCX, TXT, JPG, PNG and returns `{ files: [{ file_url, original_name }] }`.
- **Courses** (`/courses`) — teachers can create courses; `/courses/mine` lists courses for the current teacher.
- **Tasks** (`/tasks`) — teachers create/update tasks, set deadlines, attach a single reference file URL, and list submissions (`/tasks/:id/submissions`).
- **Submissions** (`/submissions`) — students submit file URLs for tasks and view their own submissions.
- **Evaluation** (`/evaluation/auto`, `/evaluation/manual`) — teachers trigger automatic scoring or set the final score manually.

### Evaluation pipeline

1. Extract text from reference and submission files (`pdf-parse`, `mammoth`, plain-text read, `tesseract.js` OCR for images).
2. Generate sentence embeddings via `@xenova/transformers` feature-extraction pipeline (`Xenova/paraphrase-MiniLM-L6-v2` by default).
3. Compute cosine similarity and convert to a 0–100 score.
4. Run an NLI classifier (`Xenova/nli-deberta-v3-small`) to detect contradictions; contradictory answers are penalised before persisting the score.
5. Auto scores are saved to `student_submissions.auto_score`. Final scores are set via `/evaluation/manual`.

Reference embeddings are cached in-memory to avoid recomputation. Set `TRANSFORMERS_CACHE` to reuse downloaded model weights between restarts.

## File handling

- Uploaded files are stored under `${FILES_DIR}` on disk.
- URLs returned from the upload endpoint already include the `/uploads/` prefix required for retrieval.
- Use Multer-compatible clients (`multipart/form-data`) for uploads.

## Testing utilities

- `npm run type-check` — strict TypeScript compilation.
- `npm run lint` — ESLint with auto-fix enabled.
- `npm run test` / `npm run test:e2e` — unit and e2e tests (placeholders).

## Troubleshooting

- Ensure PostgreSQL `uuid-ossp` extension is available (the migration attempts to create it).
- The evaluation module requires Node 18+ for WASM SIMD support and an internet connection the first time models are downloaded (or preload them using `TRANSFORMERS_CACHE`).
- OCR via `tesseract.js` may need additional native dependencies depending on the OS; adjust as necessary for production.

## License

UNLICENSED — internal project use only.
