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

OXLO API usage and models
-------------------------
This project uses OXLO as the LLM provider. Configure the client via environment settings (used in code as `settings.OXLO_BASE_URL` and `settings.OXLOAPI_KEY`). The summarization pipeline assigns models by task to balance code-awareness and narrative quality:

- `qwen-3-coder-30b` — used for code-aware tasks where precise parsing or structured output is required (risk analysis, file-level analysis, changelog generation).
- `gemma-3-27b` — used for broader intent and narrative tasks (intent extraction, final narrative summary, checklist generation).

Key integration details:
- The backend builds a set of typed prompt templates (`ChatPromptTemplate`) and invokes OXLO via `ChatOpenAI` clients configured per-task.
- Temperature is set low (0.2) to favor deterministic, review-friendly outputs; for exploratory runs this can be increased in `summarize_pr.py`.
- Several outputs are parsed as JSON using `StrOutputParser` and defensive parsing (`_parse_json_output`) to extract structured fields.
- The orchestration is implemented as a state graph (`StateGraph`) that runs nodes in sequence: diff parsing → risk analysis → intent → per-file analysis → aggregation → summary → changelog → checklist → validation. Nodes emit progress events via the `on_event` callback which the API layer forwards to frontend SSE streams.
- Inputs are truncated/chunked to avoid overly large prompts: per-file patches are sliced (e.g., 8k chars) and a raw diff excerpt (24k) is included when available.
- The pipeline includes validation and retry logic: if the narrative is too generic or content is missing, the graph will retry the summary writer up to a limit and falls back to a deterministic short summary generator when needed.

