# PaperTeardown

A web app that deconstructs PyTorch-based AI/Robotics papers. Each paper is pre-processed offline (PDF downloaded, repo cloned, code analyzed) and stored as static JSON. The frontend is a catalog of teardowns — click a paper, browse its modules, read code explanations alongside the original PDF.

## Architecture

```
PaperTeardown/
├── backend/
│   ├── cloner/       # GitHub repo cloning (spec 01)
│   ├── parser/       # PyTorch AST parsing (spec 02)
│   ├── analyzer/     # LLM code explanation (spec 03)
│   ├── ingest/       # CLI pipeline: PDF + repo → JSON (spec 06-08)
│   └── api/          # Minimal FastAPI — serves static data/ files
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── PaperList.tsx   # catalog home page
│   │   │   └── PaperView.tsx   # single paper teardown
│   │   └── components/
│   │       ├── ModuleNav.tsx
│   │       ├── CodePanel.tsx
│   │       ├── ExplanationPanel.tsx
│   │       └── PdfViewer.tsx
│   └── ...
├── data/
│   └── papers/
│       ├── index.json          # master list of all papers
│       └── <paper-id>/
│           ├── meta.json
│           ├── analysis.json
│           └── paper.pdf
├── specs/
│   ├── papers/                 # one spec per paper
│   └── *.md                    # feature specs
└── CLAUDE.md
```

## Workflow: Adding a Paper

```bash
# 1. Create a paper spec
cp specs/papers/_template.md specs/papers/dinov2.md
# edit frontmatter: id, arxiv, repo, detail_level

# 2. Run ingest
cd backend
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
python -m ingest --spec ../specs/papers/dinov2.md

# 3. Start frontend
cd frontend && npm run dev
# visit http://localhost:5173
```

## Architecture Decisions

**Pre-processed paper library** (not real-time analysis)

- Papers are processed offline via the `ingest` CLI — PDF downloaded, GitHub repo cloned, PyTorch modules analyzed by LLM — results written to static JSON files in `data/papers/`.
- The frontend loads purely statically: it fetches `index.json` + per-paper JSON files directly via Vite's `publicDir`. No backend API is needed at runtime.
- The FastAPI server (`api/`) is optional — only needed if you want to serve `data/` in production without a static file host (e.g. Nginx). In development, Vite serves everything.
- There is intentionally no real-time analysis endpoint. Adding a paper means running `python -m ingest` locally, then committing the generated JSON files.

## Tech Stack

- **Backend**: Python 3.11+, FastAPI, GitPython, AST (stdlib), pypdf, httpx
- **Frontend**: React 18, TypeScript, Vite, React Router v6
- **LLM**: Anthropic Claude API (claude-sonnet-4-6) — used only during ingest, not at runtime
- **Storage**: Static JSON files in `data/papers/` — no database

## Key Commands

### Backend ingest
```bash
cd backend
source .venv/bin/activate
python -m ingest --spec ../specs/papers/<paper>.md
python -m ingest --id <id> --arxiv <url> --repo <url>  # inline args
```

### Backend API (optional, for serving data/ in production)
```bash
cd backend
uvicorn api.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev        # dev server on :5173
npm run build
npm run typecheck
```

### Tests
```bash
# Backend
cd backend && .venv/Scripts/pytest tests/ -v

# Frontend
cd frontend && npm run test
```

## Spec-Driven Workflow

Every feature needs a spec before implementation.

1. Write spec in `specs/` using `specs/_template.md`
2. Review with `spec-reviewer` agent
3. Implement against the spec
4. Mark spec `status: implemented`

For papers: write spec in `specs/papers/` using `specs/papers/_template.md`.

## Coding Conventions

- Backend: PEP 8, type hints everywhere, async/await for I/O
- Frontend: functional components only, no `any` types, co-locate tests
- All API responses use `{ data, error }` envelope (only relevant if FastAPI server is used)
- Code blocks preserve original line numbers for UI highlighting

## Environment Variables

```bash
ANTHROPIC_API_KEY=sk-ant-...   # required for ingest
CLONE_DIR=./tmp/clones          # optional
CLONE_TIMEOUT_SECS=60           # optional
```
