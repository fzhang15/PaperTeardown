# /analyze-paper

Analyze a new PyTorch paper and add it to PaperTeardown.

**Usage**: `/analyze-paper <paper-id> <arxiv-url> <github-url>`

## Instructions

First, read `CLAUDE.md` to understand the full workflow, data schema, and **all 8 Known Pitfalls**.

Then execute the following phases:

### Phase 1: Setup
1. Create `specs/papers/$ARGUMENTS.split(' ')[0].md` from the template
2. `git clone --depth=1 <github-url> data/papers/<paper-id>/repo`

### Phase 2: Read and Understand
3. Explore the repo directory structure
4. Read all core Python files (models, layers, loss, training)
5. Take notes on: key classes, data flow, what's novel vs standard

### Phase 3: Write analysis.json
6. Plan chapters in data-flow order (see CLAUDE.md guidelines):
   - Chapter 0: What problem does this solve? (narrative only, no code)
   - Chapters 1-N: Architecture components
   - Final chapter: Putting it all together
7. For each code block:
   - **COPY exact source from repo files** (never fabricate)
   - Use `findstr /n` to verify `source_start_line`
   - Ensure all annotation `start_line`/`end_line` fall within `[source_start_line, source_start_line + line_count - 1]`
8. Run the validation command from CLAUDE.md to verify all annotations are in range

### Phase 4: Metadata
9. Write `data/papers/<paper-id>/meta.json`
10. Update `data/papers/index.json` (add entry, don't duplicate)
11. Place the paper in the vertical track layout — edit `frontend/src/pages/PaperList.tsx`:
    - Add `'<paper-id>': { track: N, row: R }` to `PAPER_POSITIONS`. Pick the right track and the next free row within it. SVG dimensions auto-compute — no other constants need updating.
    - Add directed edges to `EDGES`:
      - `{ from: 'predecessor', to: '<paper-id>' }` — solid grey arrow for direct lineage (same track, vertical)
      - `{ from: 'other-paper', to: '<paper-id>', dashed: true }` — dashed purple arrow for cross-track architectural borrowing. Multiple edges from the same source are automatically rendered as a forked bus.
    - If the paper belongs to a genuinely new conceptual group, add a new entry to `TRACKS` with `id`, `label`, `color`, and `borderColor`, and use the corresponding new track index.
    - Papers not added to `PAPER_POSITIONS` automatically appear in the "Other Papers" catch-all — use that as a staging area if placement is unclear.

### Phase 5: Verify and Ship
11. TypeScript check: `frontend/node_modules/.bin/tsc.cmd --noEmit --project frontend/tsconfig.json`
12. Tests: `frontend/node_modules/.bin/vitest.cmd run --root frontend`
13. `git add -A && git commit -m "Add <paper-id> paper teardown" && git push`
