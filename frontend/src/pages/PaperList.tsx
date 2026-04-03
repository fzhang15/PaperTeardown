import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchIndex } from '../api/papers'
import type { PaperIndexEntry } from '../types'

// ---------------------------------------------------------------------------
// Display names & publication years  (extracted from arXiv IDs)
// ---------------------------------------------------------------------------
const DISPLAY_NAMES: Record<string, string> = {
  ViT: 'ViT',
  dinov3: 'DINOv3',
  unet: 'U-Net',
  dit: 'DiT',
  CLIP: 'CLIP',
  sam3: 'SAM 3',
  act: 'ACT',
  'diffusion-policy': 'Diff. Policy',
  rt1: 'RT-1',
  rt2: 'RT-2',
  pi0: 'π₀',
  groot: 'GR00T',
  'mobile-aloha': 'Mobile ALOHA',
  '3d-vla': '3D-VLA',
  sonic: 'SONIC',
}

const PAPER_YEAR: Record<string, number> = {
  unet: 2015,
  ViT: 2020,
  CLIP: 2021,
  dit: 2022,
  rt1: 2022,
  act: 2023,
  'diffusion-policy': 2023,
  rt2: 2023,
  'mobile-aloha': 2024,
  '3d-vla': 2024,
  pi0: 2024,
  dinov3: 2025,
  groot: 2025,
  sam3: 2025,
  sonic: 2025,
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------
const CARD_W       = 148
const CARD_H       = 82
const SUB_GAP      = 10    // vertical gap between stacked cards in same cell
const COL_GAP      = 36    // horizontal gap between year columns
const LANE_GAP     = 48    // vertical gap between swim lanes
const LANE_LABEL_W = 28    // left gutter for lane labels (rotated)
const YEAR_HEADER_H = 28   // top row for year labels
const PAD_X        = 20
const PAD_Y        = 16

// ---------------------------------------------------------------------------
// Swim lanes  (horizontal rows)
// ---------------------------------------------------------------------------
interface LaneConfig {
  id: string
  label: string
  color: string
  borderColor: string
}

const LANES: LaneConfig[] = [
  { id: 'vision',  label: 'Vision & Generative', color: '#eff6ff', borderColor: '#bfdbfe' },
  { id: 'robot',   label: 'Robot Learning',       color: '#f0fdf4', borderColor: '#bbf7d0' },
]

// ---------------------------------------------------------------------------
// Year columns  (left-to-right chronological)
// ---------------------------------------------------------------------------
const YEAR_COLS = [2015, 2020, 2021, 2022, 2023, 2024, 2025] as const

// ---------------------------------------------------------------------------
// Paper positions  (lane = swim lane index, col = year column index, sub = stack position within cell)
// ---------------------------------------------------------------------------
interface CellPos { lane: number; col: number; sub: number }

const PAPER_POSITIONS: Record<string, CellPos> = {
  // Lane 0 — Vision & Generative
  unet:               { lane: 0, col: 0, sub: 0 },
  ViT:                { lane: 0, col: 1, sub: 0 },
  CLIP:               { lane: 0, col: 2, sub: 0 },
  dit:                { lane: 0, col: 3, sub: 0 },
  //                    (col 4 — no vision papers in 2023)
  //                    (col 5 — no vision papers in 2024)
  dinov3:             { lane: 0, col: 6, sub: 0 },
  sam3:               { lane: 0, col: 6, sub: 1 },
  // Lane 1 — Robot Learning
  //                    (col 0-2 — no robot papers before 2022)
  rt1:                { lane: 1, col: 3, sub: 0 },
  act:                { lane: 1, col: 4, sub: 0 },
  'diffusion-policy': { lane: 1, col: 4, sub: 1 },
  rt2:                { lane: 1, col: 4, sub: 2 },
  'mobile-aloha':     { lane: 1, col: 5, sub: 0 },
  '3d-vla':           { lane: 1, col: 5, sub: 1 },
  pi0:                { lane: 1, col: 5, sub: 2 },
  groot:              { lane: 1, col: 6, sub: 0 },
  sonic:              { lane: 1, col: 6, sub: 1 },
}

// ---------------------------------------------------------------------------
// Edges  (same conventions: solid = direct lineage, dashed = borrows architecture)
// ---------------------------------------------------------------------------
interface Edge { from: string; to: string; dashed?: boolean }

const EDGES: Edge[] = [
  // Vision lineage
  { from: 'ViT',  to: 'dinov3' },                          // DINOv3 builds on ViT
  { from: 'ViT',  to: 'CLIP',             dashed: true },  // CLIP uses ViT as vision encoder
  { from: 'ViT',  to: 'sam3',             dashed: true },  // SAM 3 uses ViT backbone
  { from: 'CLIP', to: 'sam3',             dashed: true },  // SAM 3 uses CLIP-style text encoder
  { from: 'unet', to: 'dit',              dashed: true },  // DiT replaces U-Net backbone in diffusion
  { from: 'unet', to: 'sam3',             dashed: true },  // SAM 3 mask decoder inherits U-Net pattern
  // Cross-lane: vision → robot
  { from: 'ViT',  to: 'rt1',              dashed: true },  // RT-1 uses ViT-like vision backbone
  { from: 'CLIP', to: 'rt2',              dashed: true },  // RT-2 builds on CLIP-style VLM approach
  { from: 'dit',  to: 'diffusion-policy', dashed: true },  // Diffusion Policy uses diffusion architecture
  // Robot lineage
  { from: 'rt1',  to: 'rt2' },                             // RT-2 extends RT-1
  { from: 'rt2',  to: 'pi0',              dashed: true },   // π0 builds on VLA paradigm
  { from: 'rt2',  to: '3d-vla',           dashed: true },   // 3D-VLA extends VLA paradigm
  { from: 'diffusion-policy', to: 'pi0',  dashed: true },   // π0 uses diffusion action head
  { from: 'act',  to: 'mobile-aloha',     dashed: true },   // Mobile ALOHA = ACT + mobile base
  { from: 'pi0',  to: 'groot' },                            // GR00T builds on π0 paradigm
  { from: 'groot', to: 'sonic' },                           // SONIC is next-gen after GR00T
]

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------
// Compute max stacked cards per lane to determine lane heights
function laneHeight(laneIdx: number): number {
  let maxStack = 1
  for (const pos of Object.values(PAPER_POSITIONS)) {
    if (pos.lane === laneIdx) {
      const stackInCell = Object.values(PAPER_POSITIONS)
        .filter(p => p.lane === pos.lane && p.col === pos.col).length
      maxStack = Math.max(maxStack, stackInCell)
    }
  }
  return maxStack * CARD_H + (maxStack - 1) * SUB_GAP
}

const laneHeights = LANES.map((_, i) => laneHeight(i))

/** Y offset of lane top (below year headers) */
function laneTopY(lane: number): number {
  let y = PAD_Y + YEAR_HEADER_H
  for (let i = 0; i < lane; i++) {
    y += laneHeights[i] + LANE_GAP
  }
  return y
}

/** Pixel position of a card's top-left corner */
function cardX(col: number): number {
  return PAD_X + LANE_LABEL_W + col * (CARD_W + COL_GAP)
}

function cardY(lane: number, sub: number): number {
  return laneTopY(lane) + sub * (CARD_H + SUB_GAP)
}

// SVG dimensions
const SVG_W = PAD_X * 2 + LANE_LABEL_W + YEAR_COLS.length * CARD_W + (YEAR_COLS.length - 1) * COL_GAP
const SVG_H = laneTopY(LANES.length - 1) + laneHeights[LANES.length - 1] + PAD_Y + 8

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const AH = 5 // arrowhead size

function formatAuthors(authors: string[]): string {
  if (authors.length <= 2) return authors.join(', ')
  return `${authors[0]} et al.`
}

// ---------------------------------------------------------------------------
// PaperCard  (compact timeline card)
// ---------------------------------------------------------------------------
function PaperCard({ paper, onClick }: { paper: PaperIndexEntry; onClick: () => void }) {
  const shortName = DISPLAY_NAMES[paper.id] ?? paper.id
  const year = PAPER_YEAR[paper.id]

  return (
    <div
      onClick={onClick}
      title={paper.title}
      style={{
        border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 10px',
        cursor: 'pointer', background: '#fff',
        width: CARD_W, height: CARD_H, boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        transition: 'box-shadow 0.15s, transform 0.15s',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.12)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'none'
      }}
    >
      {/* Top row: short name + year */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', letterSpacing: -0.3 }}>
          {shortName}
        </span>
        <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>
          {year}
        </span>
      </div>

      {/* Authors */}
      <p style={{ margin: 0, fontSize: 9, color: '#9ca3af', lineHeight: 1.3 }}>
        {formatAuthors(paper.authors)}
      </p>

      {/* Bottom row: chapter badge + links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99,
          background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe',
        }}>
          {paper.chapter_count} ch
        </span>
        <a href={paper.arxiv_url} target="_blank" rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ fontSize: 9, color: '#9ca3af', textDecoration: 'none' }}>arXiv</a>
        <a href={paper.repo_url} target="_blank" rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ fontSize: 9, color: '#9ca3af', textDecoration: 'none' }}>GitHub</a>
        <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 600, color: '#3b82f6' }}>Read →</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SVG wiring — horizontal timeline edges
// ---------------------------------------------------------------------------
function Wiring() {
  const SOLID_COLOR  = '#94a3b8'
  const DASHED_COLOR = '#a78bfa'

  // Lane background bands
  const laneBgs = LANES.map((lane, i) => {
    const x  = PAD_X + LANE_LABEL_W - 10
    const y  = laneTopY(i) - 8
    const w  = YEAR_COLS.length * CARD_W + (YEAR_COLS.length - 1) * COL_GAP + 20
    const h  = laneHeights[i] + 16
    return (
      <g key={lane.id}>
        <rect x={x} y={y} width={w} height={h}
          rx={10} fill={lane.color} stroke={lane.borderColor} strokeWidth={1} />
      </g>
    )
  })

  // Lane labels (rotated on left)
  const laneLabels = LANES.map((lane, i) => {
    const cy = laneTopY(i) + laneHeights[i] / 2
    return (
      <text
        key={`label-${lane.id}`}
        x={PAD_X + 10} y={cy}
        textAnchor="middle" fontSize={10} fontWeight={600} fill="#6b7280"
        fontFamily="system-ui, -apple-system, sans-serif"
        transform={`rotate(-90, ${PAD_X + 10}, ${cy})`}
      >
        {lane.label}
      </text>
    )
  })

  // Year column headers
  const yearHeaders = YEAR_COLS.map((year, i) => (
    <text
      key={`year-${year}`}
      x={cardX(i) + CARD_W / 2} y={PAD_Y + YEAR_HEADER_H / 2 + 4}
      textAnchor="middle" fontSize={11} fontWeight={700} fill="#374151"
      fontFamily="system-ui, -apple-system, sans-serif"
    >
      {year}
    </text>
  ))

  // Year column gridlines (subtle vertical lines)
  const yearLines = YEAR_COLS.map((year, i) => (
    <line
      key={`grid-${year}`}
      x1={cardX(i) + CARD_W / 2} y1={PAD_Y + YEAR_HEADER_H - 2}
      x2={cardX(i) + CARD_W / 2} y2={SVG_H - PAD_Y}
      stroke="#e5e7eb" strokeWidth={1} strokeDasharray="3,4"
    />
  ))

  // Edge rendering
  const edgeElements = EDGES.map((edge) => {
    const fp = PAPER_POSITIONS[edge.from]
    const tp = PAPER_POSITIONS[edge.to]
    if (!fp || !tp) return null

    const color = edge.dashed ? DASHED_COLOR : SOLID_COLOR
    const dash  = edge.dashed ? '4,3' : undefined

    // Source: right-center of card
    const x1 = cardX(fp.col) + CARD_W
    const y1 = cardY(fp.lane, fp.sub) + CARD_H / 2

    // Target: left-center of card
    const x2 = cardX(tp.col)
    const y2 = cardY(tp.lane, tp.sub) + CARD_H / 2

    // Route: horizontal out, bend, horizontal in
    // For same-lane same-col or backwards edges, add offset
    const midX = (x1 + x2) / 2

    // Simple right-angle routing
    const path = y1 === y2
      // Straight horizontal
      ? `M${x1},${y1} L${x2 - AH},${y2}`
      // Right-angle: horizontal to midpoint, vertical, horizontal to target
      : `M${x1},${y1} L${midX},${y1} L${midX},${y2} L${x2 - AH},${y2}`

    // Arrowhead pointing right
    const arrow = `${x2 - AH},${y2 - AH / 2} ${x2},${y2} ${x2 - AH},${y2 + AH / 2}`

    return (
      <g key={`${edge.from}→${edge.to}`}>
        <path d={path} fill="none" stroke={color} strokeWidth={1.2} strokeDasharray={dash} />
        <polygon points={arrow} fill={color} />
      </g>
    )
  })

  return (
    <svg width={SVG_W} height={SVG_H}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
      {yearLines}
      {laneBgs}
      {laneLabels}
      {yearHeaders}
      {edgeElements}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------
function Legend() {
  const SOLID  = '#94a3b8'
  const DASHED = '#a78bfa'
  return (
    <div style={{ display: 'flex', gap: 20, justifyContent: 'flex-end', marginBottom: 8 }}>
      {[
        { color: SOLID,  dash: undefined, label: 'direct lineage' },
        { color: DASHED, dash: '4,3',     label: 'borrows architecture' },
      ].map(({ color, dash, label }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width={28} height={12} style={{ overflow: 'visible' }}>
            <line x1={0} y1={6} x2={20} y2={6}
              stroke={color} strokeWidth={1.5} strokeDasharray={dash} />
            <polygon points="14,3 20,6 14,9" fill={color} />
          </svg>
          <span style={{ fontSize: 11, color: '#6b7280' }}>{label}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function SkeletonCard() {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: '#fff', width: CARD_W, height: CARD_H }}>
      {[100, 60, 80].map((w, i) => (
        <div key={i} style={{ height: i === 0 ? 14 : 10, width: w, marginBottom: 8, background: '#f3f4f6', borderRadius: 4 }} />
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

  const paperMap    = new Map(papers?.map((p) => [p.id, p]) ?? [])
  const assignedIds = new Set(Object.keys(PAPER_POSITIONS))
  const ungrouped   = papers?.filter((p) => !assignedIds.has(p.id)) ?? []

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '16px 24px' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>PaperTeardown</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
          Deconstructed PyTorch papers — browse chapters, read code explanations
        </p>
      </header>

      <main style={{ margin: '0 auto', padding: '24px 24px' }}>
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
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
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

        {/* Horizontal timeline DAG */}
        {papers !== null && papers.length > 0 && (
          <>
            <section style={{ marginBottom: 48 }}>
              <Legend />
              <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
                <div style={{ position: 'relative', width: SVG_W, height: SVG_H, minWidth: 'fit-content' }}>
                  <Wiring />
                  {Object.entries(PAPER_POSITIONS).map(([id, pos]) => {
                    const paper = paperMap.get(id)
                    if (!paper) return null
                    return (
                      <div
                        key={id}
                        style={{
                          position: 'absolute',
                          left: cardX(pos.col),
                          top: cardY(pos.lane, pos.sub),
                          zIndex: 1,
                        }}
                      >
                        <PaperCard paper={paper} onClick={() => navigate(`/paper/${id}`)} />
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>

            {/* Papers not yet placed in the timeline */}
            {ungrouped.length > 0 && (
              <section>
                <h2 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700, color: '#111827' }}>
                  Other Papers
                </h2>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
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
