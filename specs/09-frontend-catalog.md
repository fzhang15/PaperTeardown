# Spec: Frontend Catalog

**Status**: `draft`
**ID**: 09-frontend-catalog
**Created**: 2026-03-29
**Updated**: 2026-03-29

---

## Overview

Redesigned React frontend with two pages: a paper catalog (list of all ingested papers) and a paper teardown view (side-by-side code analysis + PDF viewer). All data loaded from static JSON files; no backend API calls except for serving static assets.

## Goals

- Browse all ingested papers on a catalog/home page
- Click a paper to open its full teardown view
- Teardown view: module navigation, explanation panel, code panel (reuse existing components)
- Embedded PDF viewer alongside the teardown
- Pure static — loads from `data/papers/` JSON files

## Non-Goals

- Search/filtering (deferred — too few papers for now)
- Dark mode (deferred)
- Mobile layout (deferred)
- User auth / favorites (deferred)

## Pages

### Page 1: PaperList (`/`)

Displays cards for all papers in `data/papers/index.json`.

Each card shows:
- Paper title (bold)
- Authors (truncated to first 2 + "et al." if more)
- Abstract (truncated to ~200 chars, expandable)
- Module count badge (e.g. "6 modules")
- Ingested date
- "View Teardown →" button

Layout: responsive grid (2 columns on wide screens, 1 on narrow).

Loading state: skeleton cards while fetching `index.json`.
Empty state: "No papers ingested yet. Run `python -m backend.ingest --spec <spec>`."

### Page 2: PaperView (`/paper/:id`)

Three-panel layout:

```
┌─────────────────────────────────────────────────────────┐
│  Header: title + back button                            │
├──────────┬───────────────────────┬──────────────────────┤
│          │                       │                      │
│  Module  │   Explanation Panel   │    Code Panel        │
│   Nav    │   (40% of right area) │   (60% of right)     │
│  (200px) │                       │                      │
│          ├───────────────────────┴──────────────────────┤
│          │         PDF Viewer (collapsible)              │
└──────────┴───────────────────────────────────────────────┘
```

**Module Nav** (left sidebar, 200px):
- Lists all `nn.Module` classes
- Lists training loops separately
- Click to switch active module in both panels

**Explanation Panel** (top-right left 40%):
- Reuse `ExplanationPanel` component
- Shows overview + line annotations with concept tags

**Code Panel** (top-right right 60%):
- Reuse `CodePanel` component
- Line numbers anchored to original file positions
- Lines highlight on annotation hover

**PDF Viewer** (bottom, collapsible):
- Default: collapsed, "Show Paper PDF ▼" button
- When expanded: `<iframe>` pointing to `/data/papers/<id>/paper.pdf`
- Height: 500px when open
- Toggle button stays visible

## Data Loading

```typescript
// On app init: load index
const index: PaperIndexEntry[] = await fetch('/data/papers/index.json').then(r => r.json())

// On paper open: load meta + analysis in parallel
const [meta, analysis] = await Promise.all([
  fetch(`/data/papers/${id}/meta.json`).then(r => r.json()),
  fetch(`/data/papers/${id}/analysis.json`).then(r => r.json()),
])
```

Vite dev server must be configured to serve `data/` as static files (add to `vite.config.ts`).

## Routing

Use React Router v6 (`react-router-dom`):
- `/` → `PaperList`
- `/paper/:id` → `PaperView`

## TypeScript Types

```typescript
interface PaperIndexEntry {
  id: string
  title: string
  authors: string[]
  arxiv_url: string
  repo_url: string
  abstract: string
  module_count: number
  ingested_at: string
}

interface PaperMeta extends PaperIndexEntry {
  introduction_excerpt: string
  pytorch_file_count: number
}
```

## Error States

| Condition | Display |
|-----------|---------|
| `index.json` fetch fails | Full-page error with retry button |
| Paper `meta.json` not found | "Paper not found" with back button |
| `analysis.json` fetch fails | Warning banner; show meta only |
| PDF iframe fails to load | "PDF unavailable" placeholder |

## Acceptance Criteria

- [ ] PaperList loads and displays all papers from `index.json`
- [ ] Each paper card shows title, authors, abstract excerpt, module count
- [ ] Clicking a card navigates to `/paper/:id`
- [ ] PaperView loads `meta.json` and `analysis.json` in parallel
- [ ] Module nav lists all modules and loops; switching updates both panels
- [ ] Explanation and code panels sync on hover/click
- [ ] PDF viewer toggles open/closed
- [ ] PDF iframe loads `paper.pdf`
- [ ] Back button returns to catalog
- [ ] Error states render for all failure modes
- [ ] TypeScript clean (`npm run typecheck` passes)

## Dependencies

- `react-router-dom` v6 — add to `package.json`
- Existing components: `ModuleNav`, `ExplanationPanel`, `CodePanel`
- Spec 08 (data schema / JSON formats)
- Vite static file serving for `data/` directory
