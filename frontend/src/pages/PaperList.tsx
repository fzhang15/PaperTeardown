import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchIndex } from '../api/papers'
import type { PaperIndexEntry } from '../types'

// ---------------------------------------------------------------------------
// Grid layout constants
// ---------------------------------------------------------------------------
const CARD_W = 220
const CARD_H = 165
const COL_GAP = 52    // horizontal space between columns (holds horizontal arrows)
const ROW_GAP = 72    // vertical space between rows (holds cross-row wires)
const LABEL_H = 26    // height of the group-label band sitting above each row
const PAD_X = 32
const PAD_Y = 48

const COL_STRIDE = CARD_W + COL_GAP   // 272
const ROW_STRIDE = LABEL_H + CARD_H + ROW_GAP  // 263

/** Pixel x of a card's left edge given its column */
function colX(col: number) { return PAD_X + col * COL_STRIDE }
/** Pixel y of a card's top edge given its row */
function rowY(row: number) { return PAD_Y + row * ROW_STRIDE + LABEL_H }
/** Pixel y of the centre of the label band above a row */
function rowLabelCY(row: number) { return PAD_Y + row * ROW_STRIDE + LABEL_H / 2 }

const MAX_COL = 4
const MAX_ROW = 1
const SVG_W = PAD_X * 2 + (MAX_COL + 1) * CARD_W + MAX_COL * COL_GAP  // 1372
const SVG_H = PAD_Y * 2 + (MAX_ROW + 1) * (LABEL_H + CARD_H) + MAX_ROW * ROW_GAP  // 554

// ---------------------------------------------------------------------------
// Paper → grid position  (this is the single source of truth for layout)
// ---------------------------------------------------------------------------
interface GridPos { col: number; row: number }

const PAPER_POSITIONS: Record<string, GridPos> = {
  dinov3:             { col: 0, row: 0 },
  dit:                { col: 1, row: 0 },
  'diffusion-policy': { col: 0, row: 1 },
  rt1:                { col: 1, row: 1 },
  rt2:                { col: 2, row: 1 },
  pi0:                { col: 3, row: 1 },
  groot:              { col: 4, row: 1 },
}

// ---------------------------------------------------------------------------
// Row group metadata  (visual bands behind the cards)
// ---------------------------------------------------------------------------
interface RowConfig {
  id: string
  label: string
  color: string
  borderColor: string
  colRange: [number, number]   // [minCol, maxCol] occupied in this row
}

const ROWS: RowConfig[] = [
  {
    id: 'foundations',
    label: 'Vision & Generative Foundations',
    color: '#eff6ff',
    borderColor: '#bfdbfe',
    colRange: [0, 1],
  },
  {
    id: 'robot-learning',
    label: 'Robot Foundation Models',
    color: '#f0fdf4',
    borderColor: '#bbf7d0',
    colRange: [0, 4],
  },
]

// ---------------------------------------------------------------------------
// Directed edges
// ---------------------------------------------------------------------------
interface Edge { from: string; to: string; dashed?: boolean }

const EDGES: Edge[] = [
  // Robot learning lineage (solid)
  { from: 'diffusion-policy', to: 'rt1' },
  { from: 'rt1',              to: 'rt2' },
  { from: 'rt2',              to: 'pi0' },
  { from: 'pi0',              to: 'groot' },
  // Cross-group influences (dashed purple)
  { from: 'dit', to: 'pi0',   dashed: true },
  { from: 'dit', to: 'groot', dashed: true },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatAuthors(authors: string[]): string {
  if (authors.length <= 2) return authors.join(', ')
  return `${authors[0]}, ${authors[1]}, et al.`
}

// ---------------------------------------------------------------------------
// PaperCard
// ---------------------------------------------------------------------------
function PaperCard({ paper, onClick }: { paper: PaperIndexEntry; onClick: () => void }) {
  const abstract = paper.abstract.length > 155
    ? paper.abstract.slice(0, 155) + '…'
    : paper.abstract

  return (
    <div
      onClick={onClick}
      style={{
        border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px',
        cursor: 'pointer', background: '#fff',
        width: CARD_W, height: CARD_H, boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.10)')}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
    >
      {/* Title + chapter badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 600, lineHeight: 1.35, color: '#111827' }}>
          {paper.title}
        </h3>
        <span style={{
          flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 99,
          background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', alignSelf: 'flex-start',
        }}>
          {paper.chapter_count} chapter{paper.chapter_count !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Authors */}
      <p style={{ margin: '0 0 5px', fontSize: 10, color: '#9ca3af' }}>
        {formatAuthors(paper.authors)}
      </p>

      {/* Abstract excerpt */}
      <p style={{ margin: '0 0 8px', fontSize: 11, color: '#374151', lineHeight: 1.55, flexGrow: 1, overflow: 'hidden' }}>
        {abstract}
      </p>

      {/* Footer links */}
      <div style={{ display: 'flex', gap: 8 }}>
        <a href={paper.arxiv_url} target="_blank" rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ fontSize: 10, color: '#9ca3af', textDecoration: 'none' }}>arXiv ↗</a>
        <a href={paper.repo_url} target="_blank" rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ fontSize: 10, color: '#9ca3af', textDecoration: 'none' }}>GitHub ↗</a>
        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, color: '#3b82f6' }}>Read →</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SVG wiring layer
// ---------------------------------------------------------------------------
const AH = 6  // arrowhead size in px

function ArrowheadRight({ x, y, color }: { x: number; y: number; color: string }) {
  return <polygon points={`${x},${y - AH / 2} ${x + AH},${y} ${x},${y + AH / 2}`} fill={color} />
}
function ArrowheadDown({ x, y, color }: { x: number; y: number; color: string }) {
  return <polygon points={`${x - AH / 2},${y} ${x},${y + AH} ${x + AH / 2},${y}`} fill={color} />
}

function Wiring() {
  const SOLID_COLOR  = '#94a3b8'
  const DASHED_COLOR = '#a78bfa'

  const rowBgs = ROWS.map((row, i) => {
    const bgX = colX(row.colRange[0]) - 12
    const bgRight = colX(row.colRange[1]) + CARD_W + 12
    const bgY = PAD_Y + i * ROW_STRIDE - 8
    const bgH = LABEL_H + CARD_H + 16
    return (
      <g key={row.id}>
        <rect x={bgX} y={bgY} width={bgRight - bgX} height={bgH}
          rx={8} fill={row.color} stroke={row.borderColor} strokeWidth={1} />
        <text
          x={bgX + 10} y={rowLabelCY(i) + 4}
          fontSize={11} fontWeight={600} fill="#6b7280"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {row.label}
        </text>
      </g>
    )
  })

  const wires = EDGES.map((edge) => {
    const fp = PAPER_POSITIONS[edge.from]
    const tp = PAPER_POSITIONS[edge.to]
    if (!fp || !tp) return null

    const color = edge.dashed ? DASHED_COLOR : SOLID_COLOR
    const dash  = edge.dashed ? '5,3' : undefined

    if (fp.row === tp.row) {
      // Horizontal arrow: right-middle of source → left-middle of target
      const y  = rowY(fp.row) + CARD_H / 2
      const x1 = colX(fp.col) + CARD_W
      const x2 = colX(tp.col)
      return (
        <g key={`${edge.from}→${edge.to}`}>
          <line x1={x1} y1={y} x2={x2 - AH} y2={y}
            stroke={color} strokeWidth={1.5} strokeDasharray={dash} />
          <ArrowheadRight x={x2 - AH} y={y} color={color} />
        </g>
      )
    } else {
      // Cross-row bezier: bottom-centre of source → top-centre of target
      const x1 = colX(fp.col) + CARD_W / 2
      const y1 = rowY(fp.row) + CARD_H
      const x2 = colX(tp.col) + CARD_W / 2
      const y2 = rowY(tp.row)
      const cy = (y1 + y2) / 2
      const d  = `M${x1},${y1} C${x1},${cy} ${x2},${cy} ${x2},${y2 - AH}`
      return (
        <g key={`${edge.from}→${edge.to}`}>
          <path d={d} stroke={color} strokeWidth={1.5} fill="none" strokeDasharray={dash} />
          <ArrowheadDown x={x2} y={y2 - AH} color={color} />
        </g>
      )
    }
  })

  // Legend
  const LX = SVG_W - PAD_X - 160
  const LY = PAD_Y - 8

  return (
    <svg width={SVG_W} height={SVG_H}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>

      {/* Row backgrounds */}
      {rowBgs}

      {/* Dependency wires */}
      {wires}

      {/* Legend */}
      <g>
        <line x1={LX} y1={LY + 8} x2={LX + 24} y2={LY + 8} stroke={SOLID_COLOR} strokeWidth={1.5} />
        <polygon points={`${LX + 18},${LY + 8 - AH / 2} ${LX + 24},${LY + 8} ${LX + 18},${LY + 8 + AH / 2}`} fill={SOLID_COLOR} />
        <text x={LX + 30} y={LY + 12} fontSize={10} fill="#6b7280" fontFamily="system-ui, sans-serif">direct lineage</text>

        <line x1={LX} y1={LY + 24} x2={LX + 24} y2={LY + 24} stroke={DASHED_COLOR} strokeWidth={1.5} strokeDasharray="5,3" />
        <polygon points={`${LX + 18},${LY + 24 - AH / 2} ${LX + 24},${LY + 24} ${LX + 18},${LY + 24 + AH / 2}`} fill={DASHED_COLOR} />
        <text x={LX + 30} y={LY + 28} fontSize={10} fill="#6b7280" fontFamily="system-ui, sans-serif">borrows architecture</text>
      </g>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function SkeletonCard() {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: '#fff', width: CARD_W, height: CARD_H }}>
      {[130, 90, 170, 55].map((w, i) => (
        <div key={i} style={{ height: i === 0 ? 16 : 11, width: w, marginBottom: 10, background: '#f3f4f6', borderRadius: 4 }} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export function PaperList() {
  const navigate = useNavigate()
  const [papers, setPapers] = useState<PaperIndexEntry[] | null>(null)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    fetchIndex()
      .then(setPapers)
      .catch((e: Error) => setError(e.message))
  }, [])

  const paperMap   = new Map(papers?.map((p) => [p.id, p]) ?? [])
  const assignedIds = new Set(Object.keys(PAPER_POSITIONS))
  const ungrouped  = papers?.filter((p) => !assignedIds.has(p.id)) ?? []

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '16px 24px' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>PaperTeardown</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
          Deconstructed PyTorch papers — browse chapters, read code explanations
        </p>
      </header>

      <main style={{ maxWidth: 1450, margin: '0 auto', padding: '32px 24px' }}>
        {/* Error */}
        {error && (
          <div role="alert" style={{
            background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8,
            padding: 16, color: '#b91c1c', marginBottom: 24,
          }}>
            {error}
            <button onClick={() => window.location.reload()} style={{ marginLeft: 12, cursor: 'pointer' }}>Retry</button>
          </div>
        )}

        {/* Loading */}
        {papers === null && !error && (
          <div style={{ display: 'flex', gap: 16 }}>
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Empty */}
        {papers !== null && papers.length === 0 && (
          <div style={{ textAlign: 'center', padding: 64, color: '#6b7280' }}>
            <p style={{ fontSize: 16, marginBottom: 8 }}>No papers ingested yet.</p>
            <code style={{ fontSize: 13, background: '#f3f4f6', padding: '4px 8px', borderRadius: 4 }}>
              python -m backend.ingest --spec specs/papers/&lt;paper&gt;.md
            </code>
          </div>
        )}

        {/* 2-D lineage grid */}
        {papers !== null && papers.length > 0 && (
          <>
            <section style={{ marginBottom: 48 }}>
              {/* horizontally scrollable on narrow viewports */}
              <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
                <div style={{ position: 'relative', width: SVG_W, height: SVG_H, flexShrink: 0 }}>
                  <Wiring />
                  {Object.entries(PAPER_POSITIONS).map(([id, pos]) => {
                    const paper = paperMap.get(id)
                    if (!paper) return null
                    return (
                      <div
                        key={id}
                        style={{ position: 'absolute', left: colX(pos.col), top: rowY(pos.row), zIndex: 1 }}
                      >
                        <PaperCard paper={paper} onClick={() => navigate(`/paper/${id}`)} />
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>

            {/* Catch-all for papers not in the grid */}
            {ungrouped.length > 0 && (
              <section>
                <h2 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700, color: '#111827' }}>
                  Other Papers
                </h2>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {ungrouped.map((p) => (
                    <PaperCard key={p.id} paper={p} onClick={() => navigate(`/paper/${p.id}`)} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
