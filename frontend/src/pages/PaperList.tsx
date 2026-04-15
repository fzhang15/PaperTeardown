import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchIndex } from '../api/papers'
import type { PaperIndexEntry } from '../types'

// ---------------------------------------------------------------------------
// Display names & publication years
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
  MAE: 'MAE',
  'stable-diffusion': 'Stable Diff.',
}

const PAPER_YEAR: Record<string, number> = {
  unet: 2015,
  ViT: 2020,
  CLIP: 2021,
  MAE: 2021,
  dit: 2022,
  'stable-diffusion': 2022,
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
const SUB_GAP      = 10
const COL_GAP      = 36
const LANE_GAP     = 48
const LANE_LABEL_W = 28
const YEAR_HEADER_H = 28
const PAD_X        = 20
const PAD_Y        = 16

// ---------------------------------------------------------------------------
// Swim lanes
// ---------------------------------------------------------------------------
interface LaneConfig {
  id: string
  label: string
  color: string
  borderColor: string
}

const LANES: LaneConfig[] = [
  { id: 'vision', label: 'Vision & Generative', color: '#eff6ff', borderColor: '#bfdbfe' },
  { id: 'robot',  label: 'Robot Learning',       color: '#f0fdf4', borderColor: '#bbf7d0' },
]

// ---------------------------------------------------------------------------
// Year columns
// ---------------------------------------------------------------------------
const YEAR_COLS = [2015, 2020, 2021, 2022, 2023, 2024, 2025] as const

// ---------------------------------------------------------------------------
// Paper positions
// ---------------------------------------------------------------------------
interface CellPos { lane: number; col: number; sub: number }

const PAPER_POSITIONS: Record<string, CellPos> = {
  unet:               { lane: 0, col: 0, sub: 0 },
  ViT:                { lane: 0, col: 1, sub: 0 },
  CLIP:               { lane: 0, col: 2, sub: 0 },
  MAE:                { lane: 0, col: 2, sub: 1 },
  dit:                { lane: 0, col: 3, sub: 0 },
  'stable-diffusion': { lane: 0, col: 3, sub: 1 },
  dinov3:             { lane: 0, col: 6, sub: 0 },
  sam3:               { lane: 0, col: 6, sub: 1 },
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
// Edges
// ---------------------------------------------------------------------------
interface Edge { from: string; to: string; dashed?: boolean }

const EDGES: Edge[] = [
  // Solid — direct lineage (always visible)
  { from: 'ViT',   to: 'MAE' },
  { from: 'ViT',   to: 'dinov3' },
  { from: 'rt1',   to: 'rt2' },
  { from: 'pi0',   to: 'groot' },
  { from: 'groot',  to: 'sonic' },
  // Solid — direct lineage (always visible)
  { from: 'unet', to: 'stable-diffusion' },
  // Dashed — borrows architecture (visible on hover only)
  { from: 'CLIP', to: 'stable-diffusion', dashed: true },
  { from: 'stable-diffusion', to: 'dit',  dashed: true },
  { from: 'ViT',  to: 'CLIP',             dashed: true },
  { from: 'ViT',  to: 'sam3',             dashed: true },
  { from: 'ViT',  to: 'rt1',              dashed: true },
  { from: 'CLIP', to: 'sam3',             dashed: true },
  { from: 'CLIP', to: 'rt2',              dashed: true },
  { from: 'MAE',  to: 'dinov3',            dashed: true },
  { from: 'MAE',  to: 'dit',              dashed: true },
  { from: 'unet', to: 'dit',              dashed: true },
  { from: 'unet', to: 'sam3',             dashed: true },
  { from: 'dit',  to: 'diffusion-policy', dashed: true },
  { from: 'rt2',  to: 'pi0',              dashed: true },
  { from: 'rt2',  to: '3d-vla',           dashed: true },
  { from: 'diffusion-policy', to: 'pi0',  dashed: true },
  { from: 'act',  to: 'mobile-aloha' },
]

// Pre-compute which papers are connected by ANY edge to each paper
const HOVER_CONNECTIONS = new Map<string, Set<string>>()
EDGES.forEach(e => {
  if (!HOVER_CONNECTIONS.has(e.from)) HOVER_CONNECTIONS.set(e.from, new Set())
  if (!HOVER_CONNECTIONS.has(e.to))   HOVER_CONNECTIONS.set(e.to, new Set())
  HOVER_CONNECTIONS.get(e.from)!.add(e.to)
  HOVER_CONNECTIONS.get(e.to)!.add(e.from)
})

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------
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

function laneTopY(lane: number): number {
  let y = PAD_Y + YEAR_HEADER_H
  for (let i = 0; i < lane; i++) y += laneHeights[i] + LANE_GAP
  return y
}

function cardX(col: number): number {
  return PAD_X + LANE_LABEL_W + col * (CARD_W + COL_GAP)
}

function cardY(lane: number, sub: number): number {
  return laneTopY(lane) + sub * (CARD_H + SUB_GAP)
}

const SVG_W = PAD_X * 2 + LANE_LABEL_W + YEAR_COLS.length * CARD_W + (YEAR_COLS.length - 1) * COL_GAP
const SVG_H = laneTopY(LANES.length - 1) + laneHeights[LANES.length - 1] + PAD_Y + 8

const AH = 5

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatAuthors(authors: string[]): string {
  if (authors.length <= 2) return authors.join(', ')
  return `${authors[0]} et al.`
}

// ---------------------------------------------------------------------------
// PaperCard
// ---------------------------------------------------------------------------
function PaperCard({ paper, highlighted, dimmed, onClick, onHover, onLeave }: {
  paper: PaperIndexEntry
  highlighted: boolean
  dimmed: boolean
  onClick: () => void
  onHover: () => void
  onLeave: () => void
}) {
  const shortName = DISPLAY_NAMES[paper.id] ?? paper.id
  const year = PAPER_YEAR[paper.id]

  return (
    <div
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      title={paper.title}
      style={{
        border: highlighted ? '2px solid #a78bfa' : '1px solid #e5e7eb',
        borderRadius: 10, padding: '8px 10px',
        cursor: 'pointer', background: '#fff',
        width: CARD_W, height: CARD_H, boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        transition: 'box-shadow 0.15s, transform 0.15s, opacity 0.2s, border-color 0.2s',
        position: 'relative',
        opacity: dimmed ? 0.35 : 1,
        boxShadow: highlighted ? '0 0 12px rgba(167,139,250,0.25)' : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', letterSpacing: -0.3 }}>
          {shortName}
        </span>
        <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>{year}</span>
      </div>
      <p style={{ margin: 0, fontSize: 9, color: '#9ca3af', lineHeight: 1.3 }}>
        {formatAuthors(paper.authors)}
      </p>
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
// SVG wiring
// ---------------------------------------------------------------------------
function Wiring({ hoveredPaper }: { hoveredPaper: string | null }) {
  const SOLID_COLOR  = '#94a3b8'
  const DASHED_COLOR = '#a78bfa'

  // Lane backgrounds
  const laneBgs = LANES.map((lane, i) => {
    const x = PAD_X + LANE_LABEL_W - 10
    const y = laneTopY(i) - 8
    const w = YEAR_COLS.length * CARD_W + (YEAR_COLS.length - 1) * COL_GAP + 20
    const h = laneHeights[i] + 16
    return (
      <g key={lane.id}>
        <rect x={x} y={y} width={w} height={h}
          rx={10} fill={lane.color} stroke={lane.borderColor} strokeWidth={1} />
      </g>
    )
  })

  // Lane labels
  const laneLabels = LANES.map((lane, i) => {
    const cy = laneTopY(i) + laneHeights[i] / 2
    return (
      <text key={`label-${lane.id}`}
        x={PAD_X + 10} y={cy}
        textAnchor="middle" fontSize={10} fontWeight={600} fill="#6b7280"
        fontFamily="system-ui, -apple-system, sans-serif"
        transform={`rotate(-90, ${PAD_X + 10}, ${cy})`}
      >{lane.label}</text>
    )
  })

  // Year headers
  const yearHeaders = YEAR_COLS.map((year, i) => (
    <text key={`year-${year}`}
      x={cardX(i) + CARD_W / 2} y={PAD_Y + YEAR_HEADER_H / 2 + 4}
      textAnchor="middle" fontSize={11} fontWeight={700} fill="#374151"
      fontFamily="system-ui, -apple-system, sans-serif"
    >{year}</text>
  ))

  // Determine which edges are highlighted (connected to hovered paper)
  const highlightedEdges = new Set<Edge>()
  if (hoveredPaper) {
    EDGES.forEach(e => {
      if (e.from === hoveredPaper || e.to === hoveredPaper) {
        highlightedEdges.add(e)
      }
    })
  }

  // Pre-compute fan ports for ALL cross-col edges (they're always rendered)
  const visibleCrossCol = EDGES.filter(e => {
    const f = PAPER_POSITIONS[e.from], t = PAPER_POSITIONS[e.to]
    return f && t && f.col !== t.col
  })

  const FAN_SPREAD = 20
  const outEdges = new Map<string, Edge[]>()
  const inEdges  = new Map<string, Edge[]>()
  visibleCrossCol.forEach(e => {
    if (!outEdges.has(e.from)) outEdges.set(e.from, [])
    outEdges.get(e.from)!.push(e)
    if (!inEdges.has(e.to)) inEdges.set(e.to, [])
    inEdges.get(e.to)!.push(e)
  })
  outEdges.forEach(edges => edges.sort((a, b) => {
    const pa = PAPER_POSITIONS[a.to], pb = PAPER_POSITIONS[b.to]
    return (pa.lane * 100 + pa.sub) - (pb.lane * 100 + pb.sub)
  }))
  inEdges.forEach(edges => edges.sort((a, b) => {
    const pa = PAPER_POSITIONS[a.from], pb = PAPER_POSITIONS[b.from]
    return (pa.lane * 100 + pa.sub) - (pb.lane * 100 + pb.sub)
  }))

  function outPortY(edge: Edge): number {
    const list = outEdges.get(edge.from) ?? [edge]
    const idx = list.indexOf(edge)
    const n = list.length
    const fp = PAPER_POSITIONS[edge.from]
    const cy = cardY(fp.lane, fp.sub) + CARD_H / 2
    if (n <= 1) return cy
    const spread = Math.min(FAN_SPREAD, (CARD_H - 16) / 2)
    return cy - spread + (2 * spread * idx) / (n - 1)
  }

  function inPortY(edge: Edge): number {
    const list = inEdges.get(edge.to) ?? [edge]
    const idx = list.indexOf(edge)
    const n = list.length
    const tp = PAPER_POSITIONS[edge.to]
    const cy = cardY(tp.lane, tp.sub) + CARD_H / 2
    if (n <= 1) return cy
    const spread = Math.min(FAN_SPREAD, (CARD_H - 16) / 2)
    return cy - spread + (2 * spread * idx) / (n - 1)
  }

  // Render edges
  const edgeElements = EDGES.map((edge) => {
    const fp = PAPER_POSITIONS[edge.from]
    const tp = PAPER_POSITIONS[edge.to]
    if (!fp || !tp) return null

    // Dashed edges: subtle by default, highlighted when connected to hovered card
    const isHighlighted = highlightedEdges.has(edge)
    let color: string
    let dash: string | undefined
    let opacity: number
    let strokeW: number

    if (edge.dashed) {
      if (isHighlighted) {
        color = DASHED_COLOR; dash = '4,3'; opacity = 0.9; strokeW = 1.5
      } else {
        color = '#d4d4d8'; dash = '4,3'; opacity = 0.4; strokeW = 1
      }
    } else {
      dash = undefined
      if (isHighlighted) {
        color = '#475569'; strokeW = 2.5; opacity = 1   // dark slate, bold
      } else {
        color = SOLID_COLOR; strokeW = 1.5; opacity = 1
      }
    }

    // Same-column: vertical
    if (fp.col === tp.col) {
      const cx = cardX(fp.col) + CARD_W / 2
      const y1 = cardY(fp.lane, fp.sub) + CARD_H
      const y2 = cardY(tp.lane, tp.sub)
      return (
        <g key={`${edge.from}→${edge.to}`} style={{ opacity, transition: 'opacity 0.2s' }}>
          <line x1={cx} y1={y1} x2={cx} y2={y2 - AH}
            stroke={color} strokeWidth={strokeW} strokeDasharray={dash} />
          <polygon points={`${cx - AH / 2},${y2 - AH} ${cx},${y2} ${cx + AH / 2},${y2 - AH}`} fill={color} />
        </g>
      )
    }

    // Cross-column: horizontal with fan
    const x1 = cardX(fp.col) + CARD_W
    const y1 = outPortY(edge)
    const x2 = cardX(tp.col)
    const y2 = inPortY(edge)
    const midX = (x1 + x2) / 2

    const path = y1 === y2
      ? `M${x1},${y1} L${x2 - AH},${y2}`
      : `M${x1},${y1} L${midX},${y1} L${midX},${y2} L${x2 - AH},${y2}`

    return (
      <g key={`${edge.from}→${edge.to}`} style={{ opacity, transition: 'opacity 0.2s' }}>
        <path d={path} fill="none" stroke={color} strokeWidth={strokeW} strokeDasharray={dash} />
        <polygon points={`${x2 - AH},${y2 - AH / 2} ${x2},${y2} ${x2 - AH},${y2 + AH / 2}`} fill={color} />
      </g>
    )
  })

  return (
    <svg width={SVG_W} height={SVG_H}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
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
  return (
    <div style={{ display: 'flex', gap: 20, justifyContent: 'flex-end', marginBottom: 8, alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width={28} height={12} style={{ overflow: 'visible' }}>
          <line x1={0} y1={6} x2={20} y2={6} stroke="#94a3b8" strokeWidth={1.5} />
          <polygon points="14,3 20,6 14,9" fill="#94a3b8" />
        </svg>
        <span style={{ fontSize: 11, color: '#6b7280' }}>direct lineage</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width={28} height={12} style={{ overflow: 'visible' }}>
          <line x1={0} y1={6} x2={20} y2={6} stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="4,3" />
          <polygon points="14,3 20,6 14,9" fill="#a78bfa" />
        </svg>
        <span style={{ fontSize: 11, color: '#6b7280' }}>borrows architecture <span style={{ fontSize: 9, color: '#9ca3af' }}>(hover to reveal)</span></span>
      </div>
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
  const [papers, setPapers]           = useState<PaperIndexEntry[] | null>(null)
  const [error, setError]             = useState<string | null>(null)
  const [hoveredPaper, setHoveredPaper] = useState<string | null>(null)

  useEffect(() => {
    fetchIndex()
      .then(setPapers)
      .catch((e: Error) => setError(e.message))
  }, [])

  const handleHover  = useCallback((id: string) => setHoveredPaper(id), [])
  const handleLeave  = useCallback(() => setHoveredPaper(null), [])

  const paperMap    = new Map(papers?.map((p) => [p.id, p]) ?? [])
  const assignedIds = new Set(Object.keys(PAPER_POSITIONS))
  const ungrouped   = papers?.filter((p) => !assignedIds.has(p.id)) ?? []

  // Determine which cards are highlighted / dimmed
  const connectedSet = hoveredPaper ? (HOVER_CONNECTIONS.get(hoveredPaper) ?? new Set()) : new Set<string>()

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '16px 24px' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>PaperTeardown</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
          Deconstructed PyTorch papers — browse chapters, read code explanations
        </p>
      </header>

      <main style={{ margin: '0 auto', padding: '24px 24px' }}>
        {error && (
          <div role="alert" style={{
            background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8,
            padding: 16, color: '#b91c1c', marginBottom: 24,
          }}>
            {error}
            <button onClick={() => window.location.reload()} style={{ marginLeft: 12, cursor: 'pointer' }}>Retry</button>
          </div>
        )}

        {papers === null && !error && (
          <div style={{ display: 'flex', gap: 16 }}>
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {papers !== null && papers.length === 0 && (
          <div style={{ textAlign: 'center', padding: 64, color: '#6b7280' }}>
            <p style={{ fontSize: 16, marginBottom: 8 }}>No papers ingested yet.</p>
            <code style={{ fontSize: 13, background: '#f3f4f6', padding: '4px 8px', borderRadius: 4 }}>
              python -m backend.ingest --spec specs/papers/&lt;paper&gt;.md
            </code>
          </div>
        )}

        {papers !== null && papers.length > 0 && (
          <>
            <section style={{ marginBottom: 48 }}>
              <Legend />
              <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
                <div style={{ position: 'relative', width: SVG_W, height: SVG_H, minWidth: 'fit-content' }}>
                  <Wiring hoveredPaper={hoveredPaper} />
                  {Object.entries(PAPER_POSITIONS).map(([id, pos]) => {
                    const paper = paperMap.get(id)
                    if (!paper) return null
                    const isHovered    = hoveredPaper === id
                    const isConnected  = connectedSet.has(id)
                    const highlighted  = isHovered || (hoveredPaper !== null && isConnected)
                    const dimmed       = hoveredPaper !== null && !isHovered && !isConnected
                    return (
                      <div key={id} style={{
                        position: 'absolute',
                        left: cardX(pos.col),
                        top: cardY(pos.lane, pos.sub),
                        zIndex: highlighted ? 2 : 1,
                      }}>
                        <PaperCard
                          paper={paper}
                          highlighted={highlighted}
                          dimmed={dimmed}
                          onClick={() => navigate(`/paper/${id}`)}
                          onHover={() => handleHover(id)}
                          onLeave={handleLeave}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>

            {ungrouped.length > 0 && (
              <section>
                <h2 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700, color: '#111827' }}>
                  Other Papers
                </h2>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {ungrouped.map((p) => (
                    <PaperCard key={p.id} paper={p}
                      highlighted={false} dimmed={false}
                      onClick={() => navigate(`/paper/${p.id}`)}
                      onHover={() => {}} onLeave={() => {}} />
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
