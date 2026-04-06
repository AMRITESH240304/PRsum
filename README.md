PRSum — PR Summarizer
======================

Quick summary
-------------
PRSum is an AI-powered pull-request summarizer that accepts a pasted diff, uploaded patch, or GitHub PR URL and produces a concise review-ready summary, changelog entry, review checklist, per-file notes, and an annotated diff view. Frontend is a Vite + React + TypeScript app; backend is FastAPI with SSE streaming and Mongo persistence.

Quickstart (local dev)
----------------------
- Frontend
  - cd frontend
  - npm install
  - npm run dev

- Backend
  - cd backend
  - python -m venv .venv
  - source .venv/bin/activate
  - (install deps) use your preferred tool: `pip install -r requirements.txt` or `pip install .` (project uses pyproject.toml)
  - uvicorn backend.main:app --reload --port 8000

- Notes
  - Frontend communicates with backend via `/api/*` endpoints (summarize, streaming, history, health).
  - Google sign-in is used for session persistence (optional for local runs).

Repository layout (crisp)
-------------------------
- backend/
  - main.py                -> FastAPI app entry, middleware registration (CORS, rate limiter)
  - router/routes.py      -> API endpoints: /api/health, /api/history (POST/GET), /api/summarize, /api/summarize/stream
  - schemas.py            -> Pydantic models for persisted summary artifacts and API payloads
  - db/mongo.py           -> Mongo connection + helper functions
  - services/             -> helpers for saving summaries, fetching PR data, SSE streaming
  - rate_limiter.py       -> rate-limiter instance (slowapi) and configuration
  - pyproject.toml        -> Python dependency metadata

- frontend/
  - index.html            -> app HTML (favicon link)
  - src/main.tsx          -> React entry
  - src/pages/Summarize.tsx -> Main split-view UI (left input/actions, right output)
  - src/pages/Settings.tsx  -> Settings page (appearance, tokens, removed API key input)
  - src/components/       -> UI pieces (SummaryOutput, DiffViewer, FileSummaryCard, QuickNav, PRHealthScore, etc.)
  - src/lib/summary-utils.ts -> shared summary normalization, tone variants, markdown export
  - src/lib/api.ts        -> API client helpers (streaming entrypoints + history save)
  - public/favicon.svg    -> Custom SVG favicon used by the app

Architecture overview — how the system works
--------------------------------------------
1. Input: user pastes a diff, uploads a patch, or provides a GitHub PR URL in the frontend.
2. The frontend prepares a stream request and hits the backend stream endpoint (`/api/summarize/stream`).
3. Backend: FastAPI endpoint receives request and orchestrates an analysis pipeline:
   - Fetch PR metadata (if URL provided), normalize diffs and file lists.
   - Kick off the summarization agent (LLM-backed) which analyzes changed files, infers key points, risk, and a review checklist.
   - Stream partial results back to the frontend via SSE (EventSourceResponse) for a responsive progressive UI.
4. Persistence: summaries can be saved to Mongo (summary artifact model). The backend exposes `/api/history` for POST/GET to store and retrieve past summaries.
5. Rate limiting and safety: summarization endpoint is protected by a rate-limiter (slowapi) to avoid abuse and to throttle heavy requests.

Summarization agent (high level)
--------------------------------
- The agent is an orchestration layer (LLM planner + prompt templates) that:
  - Parses and groups file changes.
  - Produces a structured summary with tone variants (`technical`, `simple`, `detailed`).
  - Generates per-file summaries, changelog candidate, and reviewer checklist.
  - Emits streaming events (progress / file summaries / final artifact) back to the client.
- Implementation detail: the agent uses prompt-driven LLM interactions (the codebase contains utilities to normalize prompts, manage streaming responses, and synthesize final artifacts). It is designed for safe fallbacks (non-stream summarize route) and for persisting artifacts to a DB.

Operational notes
-----------------
- The app is designed to be run with the frontend on a dev server and the backend behind uvicorn. In production, run backend behind an ASGI server and serve the built frontend assets.
- For local testing of streaming, ensure the backend is reachable from the frontend (CORS, correct API_BASE_URL in frontend config).
- The Settings page now omits a direct API-key text box for security/usability reasons; tokens are stored in the app store for dev convenience but consider secure storage for production.

Where to look next
------------------
- Want a docker-compose dev setup? I can add one that runs the frontend, backend, and a Mongo container.
- Want the README extended with API examples (curl) and OpenAPI docs pointers? I can add short examples.

---
Made succinct for quick onboarding. Tell me if you want this expanded with diagrams, curl examples, or a Docker compose setup.
