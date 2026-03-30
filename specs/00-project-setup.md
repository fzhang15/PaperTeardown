# Spec: Project Setup

**Status**: `draft`
**ID**: 00-project-setup
**Created**: 2026-03-29
**Updated**: 2026-03-29

---

## Overview

Bootstraps the PaperTeardown monorepo with a working backend (FastAPI) and frontend (React/TypeScript/Vite) skeleton, along with dependency manifests, environment config, and tooling. No feature logic — just the scaffolding every other spec builds on.

## Goals

- Create `backend/` and `frontend/` directory structures
- Produce runnable (though empty) backend and frontend servers
- Define all Python and Node dependencies needed by specs 01–05
- Provide `.env.example` so contributors know what secrets are required
- Set up linting and formatting configs

## Non-Goals

- Implementing any feature from specs 01–05
- CI/CD pipeline (deferred)
- Docker / containerization (deferred)
- Database setup (deferred — specs use in-memory state first)

## Directory Structure

```
PaperTeardown/
├── backend/
│   ├── api/
│   │   ├── __init__.py
│   │   └── main.py          # FastAPI app entrypoint
│   ├── cloner/
│   │   └── __init__.py
│   ├── parser/
│   │   └── __init__.py
│   ├── analyzer/
│   │   └── __init__.py
│   ├── tests/
│   │   └── __init__.py
│   ├── requirements.txt
│   └── .env                 # gitignored, copied from .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── api/             # API client functions
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── .env.example
├── .gitignore
└── CLAUDE.md
```

## Backend Dependencies (`requirements.txt`)

```
fastapi>=0.111.0
uvicorn[standard]>=0.29.0
pydantic>=2.7.0
gitpython>=3.1.43
anthropic>=0.28.0
python-dotenv>=1.0.0
pytest>=8.2.0
pytest-asyncio>=0.23.0
pytest-mock>=3.14.0
httpx>=0.27.0          # for FastAPI TestClient async support
```

## Frontend Dependencies (`package.json`)

Production:
- `react` ^18.3.0
- `react-dom` ^18.3.0
- `highlight.js` ^11.9.0

Dev:
- `typescript` ^5.4.0
- `vite` ^5.2.0
- `@vitejs/plugin-react` ^4.3.0
- `@types/react` ^18.3.0
- `@types/react-dom` ^18.3.0
- `vitest` ^1.6.0
- `@testing-library/react` ^16.0.0
- `@testing-library/user-event` ^14.5.0
- `@testing-library/jest-dom` ^6.4.0

## Environment Variables (`.env.example`)

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Optional
CLONE_DIR=./tmp/clones        # where repos are cloned
CLONE_TIMEOUT_SECS=60         # git clone timeout
JOB_TTL_HOURS=1               # how long to keep completed jobs
LOG_LEVEL=INFO
```

## Backend Entrypoint (`backend/api/main.py`)

Minimal FastAPI app with:
- CORS middleware configured for `http://localhost:5173`
- `GET /api/health` returning `{"status": "ok"}`
- Standard `{ "data": ..., "error": ... }` response envelope helper
- Lifespan handler for startup/shutdown

## Frontend Entrypoint

- Vite + React + TypeScript template
- `App.tsx` with a placeholder "PaperTeardown" heading
- Proxy config in `vite.config.ts`: `/api/*` → `http://localhost:8000`

## Acceptance Criteria

- [ ] `cd backend && uvicorn api.main:app --reload` starts without errors
- [ ] `GET http://localhost:8000/api/health` returns `{"data": {"status": "ok"}, "error": null}`
- [ ] `cd frontend && npm run dev` starts without errors
- [ ] `GET http://localhost:5173` renders the React app in browser
- [ ] `cd frontend && npm run typecheck` exits 0
- [ ] `cd backend && pytest tests/` exits 0 (no tests yet, but runner works)
- [ ] `.env.example` documents all required and optional env vars
- [ ] `.gitignore` excludes `.env`, `tmp/`, `node_modules/`, `.venv/`, `__pycache__/`

## Dependencies

- No other specs required
- Requires Node.js 20+ and Python 3.11+

## Open Questions

- Should the frontend use React Router or start single-page without routing?
- Do we want ESLint + Prettier configured now or deferred?
- Should `backend/` use a `src/` layout or flat layout?
