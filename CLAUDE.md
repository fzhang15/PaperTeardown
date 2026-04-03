# PaperTeardown

A web app that deconstructs PyTorch-based AI papers into narrative, chapter-based teardowns. Each paper is manually analyzed: the repo is cloned, key code snippets are extracted, and explanations are written as a guided learning experience — like reading a textbook, not API docs.

## Current Status

- **DINOv3** (`data/papers/dinov3/`): ✅ First paper complete — 8 chapters with real code from `facebookresearch/dinov3`
- **Frontend**: ✅ Chapter-based narrative UI with syntax highlighting, deployed at `localhost:5173`
- **Tests**: ✅ 35 tests passing across 6 test files

## Architecture

```
PaperTeardown/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── PaperList.tsx       # catalog home page — grid of paper cards
│   │   │   └── PaperView.tsx       # single paper teardown — scrollable chapters
│   │   ├── components/
│   │   │   ├── ChapterNav.tsx      # left sidebar — numbered chapter list
│   │   │   ├── ChapterView.tsx     # renders one chapter: narrative + code blocks
│   │   │   ├── NarrativeCodeBlock.tsx  # syntax-highlighted code with inline annotations
│   │   │   └── PdfViewer.tsx       # collapsible PDF iframe at bottom
│   │   ├── api/
│   │   │   └── papers.ts           # fetches static JSON from /papers/
│   │   ├── types.ts                # Chapter, CodeBlock, LineAnnotation, etc.
│   │   ├── App.tsx                 # React Router: / → PaperList, /paper/:id → PaperView
│   │   └── main.tsx
│   └── vite.config.ts              # publicDir: ../data (serves data/ as static files)
├── data/
│   └── papers/
│       ├── index.json              # master list of all papers
│       └── <paper-id>/
│           ├── meta.json           # title, authors, abstract, etc.
│           ├── analysis.json       # chapters with narrative + code blocks + annotations
│           ├── paper.pdf           # original paper PDF (optional)
│           └── repo/               # cloned GitHub repo (gitignored)
├── backend/
│   ├── cloner/                     # GitHub repo cloning utility
│   ├── parser/                     # PyTorch AST parsing (for automated pre-analysis)
│   ├── ingest/                     # CLI pipeline: clone repo + download PDF
│   └── tests/
├── specs/
│   ├── papers/                     # one spec per paper (frontmatter: id, arxiv, repo)
│   └── *.md                        # feature specs
└── CLAUDE.md
```

## Workflow: Adding a New Paper

### Step 1: Create a paper spec
```bash
cp specs/papers/_template.md specs/papers/<paper-id>.md
# Edit frontmatter: id, arxiv URL, repo URL
```

### Step 2: Clone the repo
```bash
git clone --depth=1 https://github.com/<org>/<repo>.git data/papers/<paper-id>/repo
```

### Step 3: Read the code and write analysis.json
This is the manual, high-quality step. Read the paper and codebase, then write `data/papers/<paper-id>/analysis.json` following the chapter-based schema:

```json
{
  "chapters": [
    {
      "id": "unique-id",
      "title": "Chapter Title",
      "narrative": "Explanation text...\n\nMultiple paragraphs separated by \\n\\n",
      "code_blocks": [
        {
          "label": "Descriptive label for code block",
          "source": "actual source code from the repo",
          "source_start_line": 42,
          "file_path": "relative/path/in/repo.py",
          "annotations": [
            {
              "start_line": 42,
              "end_line": 45,
              "explanation": "What this code does and why",
              "concept_tag": "attention"
            }
          ]
        }
      ]
    }
  ],
  "summary": "One-paragraph TL;DR of the whole paper"
}
```

**Guidelines for writing chapters:**
- Start with "what problem does this solve?" (no code needed)
- Progress through the architecture in data-flow order
- Each chapter tells a story: narrative first, then code to back it up
- Code blocks should be focused snippets (not entire files)
- Annotations explain WHY, not just WHAT
- End with a "putting it all together" chapter

**Concept tags (fixed taxonomy):**
`attention`, `embedding`, `normalization`, `activation`, `loss`, `linear`, `dropout`, `pooling`, `residual`, `convolution`, `other:<sublabel>`

### Step 4: Create meta.json, update index.json, and place in lineage gallery

```json
// data/papers/<id>/meta.json
{
  "id": "<paper-id>",
  "title": "Full Paper Title",
  "authors": ["Author 1", "Author 2"],
  "arxiv_url": "https://arxiv.org/abs/...",
  "repo_url": "https://github.com/...",
  "abstract": "...",
  "introduction_excerpt": "...",
  "module_count": 8,
  "pytorch_file_count": 12,
  "ingested_at": "2026-03-29T20:00:00Z"
}
```

Update `data/papers/index.json` to include the new paper entry.

**Also update the 2D lineage grid** in `frontend/src/pages/PaperList.tsx`:

The gallery uses a **horizontal timeline DAG** layout: X-axis is chronological (year columns), Y-axis is domain (swim lanes). Five static objects control the layout:

- `PAPER_POSITIONS` — maps each paper ID to `{lane, col, sub}`:
  - `lane` = swim lane index (0 = Vision & Generative, 1 = Robot Learning)
  - `col` = year column index (maps to `YEAR_COLS`: 0→2015, 1→2020, 2→2021, 3→2022, 4→2023, 5→2024, 6→2025)
  - `sub` = stack position within a cell (when multiple papers share the same lane+year)
- `YEAR_COLS` — array of years displayed as columns left-to-right
- `LANES` — one entry per horizontal swim lane with `id`, `label`, `color`, `borderColor`
- `EDGES` — directed dependency arrows. Solid for direct lineage; dashed (`{dashed: true}`) for architectural borrowing. Edges route left→right with right-angle bends.
- `DISPLAY_NAMES` / `PAPER_YEAR` — short display names and publication years per paper

For each new paper:
1. Add entries to `DISPLAY_NAMES` and `PAPER_YEAR`
2. Add `'<paper-id>': { lane: N, col: C, sub: S }` to `PAPER_POSITIONS` (pick the right lane + year column, use next `sub` if cell already has papers)
3. Add edges to `EDGES` pointing from its predecessors
4. If it belongs to a new domain, add a new entry to `LANES` and possibly new years to `YEAR_COLS`
5. Papers omitted from `PAPER_POSITIONS` automatically appear in the "Other Papers" catch-all below the timeline

### Step 5: Start frontend and verify
```bash
# From frontend/ directory:
npm run dev
# Visit http://localhost:5173 → click the paper → read through chapters
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, React Router v6, highlight.js
- **Backend** (optional): Python 3.11+, GitPython, pypdf — used only for repo cloning and PDF download
- **Storage**: Static JSON files in `data/papers/` — no database, no backend API at runtime
- **Vite**: `publicDir: ../data` serves `data/` directory as static files at root

## Key Commands

### Frontend
```bash
cd frontend
npm install
npm run dev                # dev server on :5173 (or use vite directly)
npm run typecheck          # TypeScript check
npm run test               # vitest (run from frontend/ dir)
npm run build              # production build
```

Note: If `npm run dev` fails due to workspace issues, use vite directly:
```bash
frontend/node_modules/.bin/vite.cmd --config frontend/vite.config.ts frontend
```

### Tests
```bash
# Frontend (must specify --root)
frontend/node_modules/.bin/vitest.cmd run --root frontend

# Backend
cd backend && python -m pytest tests/ -v
```

## Coding Conventions

- Frontend: functional components only, no `any` types, co-locate tests (`.test.tsx` next to component)
- All data flows through static JSON — no runtime API calls except fetching JSON files
- Code blocks in analysis.json must use real source code with correct line numbers from the actual repo
- Line numbers in annotations must match the `source_start_line` offset

## Architecture Decisions

- **Narrative chapters** (not module-by-module): The UI presents papers as a guided learning experience with chapters in logical order, not as a flat list of `nn.Module` classes
- **Manual analysis** (not LLM-generated): Each paper is analyzed by hand for quality. The `analysis.json` is written manually after reading the paper and code
- **Static JSON** (no database): All data lives as files under `data/papers/`. Frontend loads them directly via Vite's publicDir. Zero runtime dependencies
- **Repo cloned locally**: Each paper's GitHub repo is cloned to `data/papers/<id>/repo/` for reference during analysis. These are gitignored

## Key Decisions Log

- 2026-03-29: Product direction pivot from real-time analysis to pre-processed paper library
- 2026-03-29: Switched from module-by-module UI to chapter-based narrative UI
- 2026-03-29: Manual analysis workflow (not LLM auto-analysis) for quality
- 2026-03-29: Paper ID manually specified in spec file
- 2026-03-29: Frontend discovery via static `index.json`
- 2026-03-29: RoPE, Sinkhorn-Knopp, Gram Loss identified as real DINOv3 innovations (not "multi-scale attention")

---

## ⚠️ Known Pitfalls (MUST READ before making changes)

### Pitfall 1: Annotation line numbers MUST be within the displayed code range

The `source` field in a code block is a snippet (not the whole file). The UI displays lines starting from `source_start_line`. Annotation `start_line`/`end_line` MUST fall within:

```
[source_start_line, source_start_line + len(source.split('\n')) - 1]
```

**Bad example**: source_start_line=21, source has 35 lines (range 21-55), but annotation says start_line=61 → **highlight will be invisible because line 61 doesn't exist in the displayed code.**

**Validation command** (run after writing analysis.json):
```bash
node -e "const d=JSON.parse(require('fs').readFileSync('data/papers/<ID>/analysis.json','utf-8')); d.chapters.forEach(ch=>ch.code_blocks.forEach(cb=>{const max=cb.source_start_line+cb.source.split('\n').length-1; cb.annotations.forEach(a=>{if(a.start_line<cb.source_start_line||a.end_line>max) console.error('OUT OF RANGE:',cb.label,a.start_line,'-',a.end_line,'vs range',cb.source_start_line,'-',max)})}))"
```

### Pitfall 2: NEVER fabricate code — always copy from real repo

Do NOT write "example code" from memory. Always:
1. `git clone --depth=1` the actual repo to `data/papers/<id>/repo/`
2. Use `read_file` or `type` to read the actual Python files
3. Copy-paste exact code into `source` field
4. Use `findstr /n "key_line" <file>` to verify line numbers

### Pitfall 3: source_start_line meaning

`source_start_line` is the line number of the FIRST line of `source` in the original file. The frontend displays line numbers starting from this value. If your snippet starts at line 104 of the real file, set `source_start_line: 104`.

### Pitfall 4: Do NOT create root-level or backend/ package.json

The frontend is an independent npm package at `frontend/package.json`. Creating a `package.json` at repo root or in `backend/` breaks npm workspace resolution and causes `npm run dev` to fail with "Missing script" errors.

### Pitfall 5: Vite publicDir URL mapping

`vite.config.ts` sets `publicDir: ../data`. This means:
- File at `data/papers/index.json` → served at `/papers/index.json` (NOT `/data/papers/index.json`)
- All fetch URLs in `frontend/src/api/papers.ts` use `/papers/...` prefix

### Pitfall 6: Running commands from repo root

Because the working directory is `d:\PaperTeardown` (repo root), npm/vite commands need explicit paths:

```bash
# TypeScript check
frontend/node_modules/.bin/tsc.cmd --noEmit --project frontend/tsconfig.json

# Run tests
frontend/node_modules/.bin/vitest.cmd run --root frontend

# Start dev server
frontend/node_modules/.bin/vite.cmd --config frontend/vite.config.ts frontend
```

`cd frontend && npm run dev` may fail if there's a root `package.json` interfering.

### Pitfall 7: Annotation hover scrolling

The `NarrativeCodeBlock` component scrolls highlighted code WITHIN the code container only (`container.scrollTo()`). It must NEVER use `element.scrollIntoView()` which would scroll the entire page.

### Pitfall 8: Don't trust line numbers from `findstr /n`

`findstr /n` shows the line's position in the FULL file. But `source_start_line` + annotation lines are relative to the source snippet's position in that file. Always cross-reference:
1. Use `findstr /n` to find the real line number in the file
2. Verify the snippet's `source_start_line` matches the first line of `source`
3. Count lines within the snippet to verify annotations point to the right code

## Detailed Workflow: Analyzing a New Paper

### Phase 1: Setup
```bash
# 1. Create spec
cp specs/papers/_template.md specs/papers/<paper-id>.md
# Edit: id, arxiv, repo

# 2. Clone repo
git clone --depth=1 https://github.com/<org>/<repo>.git data/papers/<paper-id>/repo
```

### Phase 2: Read and Understand
```bash
# 3. Explore repo structure
ls data/papers/<paper-id>/repo/
ls data/papers/<paper-id>/repo/<main-package>/

# 4. Read core files (models, layers, loss, training)
# Use read_file for each key Python file
# Take notes on: what classes exist, what the data flow is, what's novel
```

### Phase 3: Write analysis.json
```
# 5. Plan chapters in data-flow order:
#    Ch 0: What problem does this solve? (no code)
#    Ch 1-N: Architecture components, one per chapter
#    Last ch: Putting it all together

# 6. For each code block:
#    - Copy EXACT source from repo file
#    - Use findstr /n to verify source_start_line
#    - Write annotations with line numbers WITHIN snippet range
#    - Run validation command (see Pitfall 1)
```

### Phase 4: Metadata
```bash
# 7. Write meta.json
# 8. Update index.json (add new entry, don't duplicate)
```

### Phase 5: Verify
```bash
# 9. TypeScript check
frontend/node_modules/.bin/tsc.cmd --noEmit --project frontend/tsconfig.json

# 10. Run tests
frontend/node_modules/.bin/vitest.cmd run --root frontend

# 11. Start dev server and check in browser
frontend/node_modules/.bin/vite.cmd --config frontend/vite.config.ts frontend
# Visit http://localhost:5173 → click paper → read all chapters
# Hover annotations → verify correct lines highlight
```
