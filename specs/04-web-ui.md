# Spec: Web UI

**Status**: `implemented`
**ID**: 04-web-ui
**Created**: 2026-03-29
**Updated**: 2026-03-29

---

## Overview

A React/TypeScript single-page app with a side-by-side layout: the left panel shows paper/code explanations and the right panel shows the original source code. Hovering or clicking a line in either panel highlights the corresponding content in the other.

## Goals

- Input field to accept a GitHub repo URL and trigger analysis
- Side-by-side view: explanations (left) ↔ code (right)
- Synchronized scrolling and highlighting between panels
- Display module list as a navigable sidebar
- Show analysis progress while the backend processes

## Non-Goals

- User authentication or saved sessions (deferred)
- PDF paper upload/display (deferred)
- Mobile layout (deferred — desktop-first)
- Editing or annotating code in the browser

## Inputs & Outputs

**Input:**
- User-provided GitHub URL
- Analysis results from the API (`AnalysisResult` shape from spec 03)

**Output:**
- Interactive UI; no file output

## Detailed Behavior

### Landing / Input View

1. Centered input field with placeholder `https://github.com/...`
2. "Analyze" button triggers `POST /api/analyze`
3. Show inline validation for obviously invalid URLs
4. Disable button and show progress while analyzing

### Progress View

During analysis, show:
- Step indicators: Cloning → Parsing → Analyzing
- Current module being analyzed (streamed from backend)
- Cancel button

### Main Analysis View

**Layout**: Fixed header, left panel (40%), right panel (60%), scrollable independently.

**Left panel (Explanation)**:
- Module selector tabs or dropdown at the top
- For each selected module: overview paragraph, then line annotations listed sequentially
- Each annotation card is anchored to line numbers and highlights on hover

**Right panel (Code)**:
- Displays the extracted method source by default (e.g. only `forward()`)
- "Show full file" toggle button expands to the complete source file
- Line numbers always reflect original file positions (never reset to 1)
- Syntax-highlighted (use `highlight.js` or `prism`)
- Lines highlighted when corresponding annotation is hovered/selected
- Smooth scroll to line when annotation is clicked

**Synchronized behavior**:
- Hovering an annotation → highlight the corresponding line range in code panel
- Clicking a line in code → scroll to and highlight the corresponding annotation
- Both panels scroll independently but can be locked together

**Module Navigation**:
- Sidebar or tabs listing all detected `nn.Module` classes
- Training loops listed separately
- Click to jump to that module in both panels

### Error States

| Condition | Display |
|-----------|---------|
| Invalid URL | Inline error under input |
| Repo not found | Full-page error with retry button |
| No PyTorch found | Warning banner, still show file tree |
| Analysis API error | Per-module error state in explanation panel |

## Interface / API Contract

The UI consumes these API endpoints (defined in spec 05):
```
POST /api/analyze       → triggers full pipeline, returns job_id
GET  /api/status/:id    → poll or SSE stream for progress
GET  /api/result/:id    → fetch completed AnalysisResult
```

Key TypeScript types:
```typescript
interface AnalysisResult {
  modules: AnalyzedModule[]
  loops: AnalyzedLoop[]
  summary: string
}

interface LineAnnotation {
  startLine: number
  endLine: number
  explanation: string
  conceptTag?: string
}

interface AnalyzedModule {
  name: string
  filePath: string
  overview: string
  annotations: LineAnnotation[]
}
```

## Acceptance Criteria

- [x] URL input accepts a GitHub repo URL and triggers analysis
- [x] Progress steps shown during cloning/parsing/analyzing
- [x] Side-by-side layout renders with explanation left, code right
- [x] Hovering an annotation highlights corresponding lines in code panel
- [x] Clicking a highlighted line scrolls to its annotation
- [x] Module list is navigable; switching modules updates both panels
- [x] Syntax highlighting applied to code panel (highlight.js)
- [x] Responsive to window resize (panels reflow, no overflow)
- [x] Error states display correctly for all failure modes

## Dependencies

- React 18, TypeScript, Vite
- `highlight.js` or `prism` for syntax highlighting
- Spec 05 (API endpoints)
- Spec 03 (AnalysisResult shape)

## Decisions

- **Progress streaming**: SSE (one-way, simpler than WebSocket; sufficient for this use case)
- **Code panel scope**: Show extracted method by default; "Show full file" toggle available; line numbers always reflect original file positions

## Open Questions

- Do we want a dark/light mode toggle?
- Should concept tags be filterable/clickable to find all uses of e.g. "attention"?
