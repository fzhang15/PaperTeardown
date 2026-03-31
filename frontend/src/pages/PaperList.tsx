import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchIndex } from '../api/papers'
import type { PaperIndexEntry } from '../types'

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------
const CARD_W   = 220
const CARD_H   = 158
const COL_GAP  = 96   // horizontal gap between tracks — cross-track wires live here
const ROW_GAP  = 56   // vertical gap between papers in same track — vertical arrows here
const HEADER_H = 40   // height of track column header
const PAD_X    = 32
const PAD_Y    = 28

/** Pixel x of a card's left edge in the given track */
function cardX(track: number) { return PAD_X + track * (CARD_W + COL_GAP) }
/** Pixel y of a card's top edge at the given row */
function cardY(row: number)   { return PAD_Y + HEADER_H + row * (CARD_H + ROW_GAP) }

// ---------------------------------------------------------------------------
// Paper positions  (track = vertical lane index, row = position within lane)
// Adding a new paper: pick the right track and the next free row.
// ---------------------------------------------------------------------------
interface TrackPos { track: number; row: number }

const PAPER_POSITIONS: Record<string, TrackPos> = {
  dinov3:             { track: 0, row: 0 },
  dit:                { track: 0, row: 1 },
  'diffusion-policy': { track: 1, row: 0 },
  rt1:                { track: 1, row: 1 },
  rt2:                { track: 1, row: 2 },
  pi0:                { track: 1, row: 3 },
  groot:              { track: 1, row: 4 },
}

// ---------------------------------------------------------------------------
// Track configuration  (one entry per vertical lane, left-to-right order)
// ---------------------------------------------------------------------------
interface TrackConfig {
  id: string
  label: string
  color: string
  borderColor: string
}

const TRACKS: TrackConfig[] = [
  { id: 'foundations',    label: 'Vision & Generative Foundations', color: '#eff6ff', borderColor: '#bfdbfe' },
  { id: 'robot-learning', label: 'Robot Foundation Models',          color: '#f0fdf4', borderColor: '#bbf7d0' },
]

// ---------------------------------------------------------------------------
// Dependency edges
// ---------------------------------------------------------------------------
interface Edge { from: string; to: string; dashed?: boolean }

const EDGES: Edge[] = [
  // Same-track lineage (solid vertical arrows)
  { from: 'diffusion-policy', to: 'rt1' },
  { from: 'rt1',              to: 'rt2' },
  { from: 'rt2',              to: 'pi0' },
  { from: 'pi0',              to: 'groot' },
  // Cross-track architectural borrowing (dashed horizontal fork)
  { from: 'dit', to: 'pi0',   dashed: true },
  { from: 'dit', to: 'groot', dashed: true },
]

// ---------------------------------------------------------------------------
// SVG canvas dimensions — auto-computed from PAPER_POSITIONS
// ---------------------------------------------------------------------------
const _nTracks = Math.max(...Object.values(PAPER_POSITIONS).map(p => p.track)) + 1
const _maxRow  = Math.max(...Object.values(PAPER_POSITIONS).map(p => p.row))
const SVG_W    = PAD_X * 2 + _nTracks * CARD_W + (_nTracks - 1) * COL_GAP
const SVG_H    = cardY(_maxRow) + CARD_H + PAD_Y

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
      <p style={{ margin: '0 0 5px', fontSize: 10, color: '#9ca3af' }}>
        {formatAuthors(paper.authors)}
      </p>
      <p style={{ margin: '0 0 8px', fontSize: 11, color: '#374151', lineHeight: 1.55, flexGrow: 1, overflow: 'hidden' }}>
        {abstract}
      </p>
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
// SVG wiring
// ---------------------------------------------------------------------------
const AH = 6  // arrowhead size in px

function Wiring() {
  const SOLID  = '#94a3b8'
  const DASHED = '#a78bfa'

  // Compute max row per track for background heights
  const trackMaxRow = new Map<number, number>()
  Object.values(PAPER_POSITIONS).forEach(({ track, row }) => {
    trackMaxRow.set(track, Math.max(trackMaxRow.get(track) ?? 0, row))
  })

  // Track background bands + column headers
  const trackBgs = TRACKS.map((trk, i) => {
    const maxR = trackMaxRow.get(i) ?? 0
    const bgX  = cardX(i) - 12
    const bgY  = PAD_Y - 8
    const bgW  = CARD_W + 24
    const bgH  = HEADER_H + (maxR + 1) * CARD_H + maxR * ROW_GAP + 16
    return (
      <g key={trk.id}>
        <rect x={bgX} y={bgY} width={bgW} height={bgH}
          rx={8} fill={trk.color} stroke={trk.borderColor} strokeWidth={1} />
        <text
          x={cardX(i) + CARD_W / 2} y={PAD_Y + HEADER_H / 2 + 4}
          textAnchor="middle" fontSize={11} fontWeight={600} fill="#374151"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {trk.label}
        </text>
      </g>
    )
  })

  // Separate same-track vs cross-track edges; group cross-track by source
  type ResolvedEdge = Edge & { fp: TrackPos; tp: TrackPos }
  const sameTrackEdges: ResolvedEdge[] = []
  const crossBySource  = new Map<string, ResolvedEdge[]>()

  EDGES.forEach((edge) => {
    const fp = PAPER_POSITIONS[edge.from]
    const tp = PAPER_POSITIONS[edge.to]
    if (!fp || !tp) return
    const re: ResolvedEdge = { ...edge, fp, tp }
    if (fp.track === tp.track) {
      sameTrackEdges.push(re)
    } else {
      if (!crossBySource.has(edge.from)) crossBySource.set(edge.from, [])
      crossBySource.get(edge.from)!.push(re)
    }
  })

  // Vertical same-track arrows (bottom-centre → top-centre)
  const vertWires = sameTrackEdges.map((e) => {
    const cx = cardX(e.fp.track) + CARD_W / 2
    const y1 = cardY(e.fp.row) + CARD_H
    const y2 = cardY(e.tp.row)
    return (
      <g key={`${e.from}→${e.to}`}>
        <line x1={cx} y1={y1} x2={cx} y2={y2 - AH} stroke={SOLID} strokeWidth={1.5} />
        <polygon
          points={`${cx - AH / 2},${y2 - AH} ${cx},${y2} ${cx + AH / 2},${y2 - AH}`}
          fill={SOLID}
        />
      </g>
    )
  })

  // Cross-track wires: bus topology — shared trunk + individual branches
  //
  //   source ───┤         (horizontal stub to trunk x)
  //             │         (vertical trunk through gap)
  //             ├──────→  target A
  //             │
  //             └──────→  target B
  //
  const crossWires: JSX.Element[] = []
  crossBySource.forEach((edges, sourceId) => {
    const fp    = edges[0].fp
    const color = edges[0].dashed ? DASHED : SOLID
    const dash  = edges[0].dashed ? '5,3' : undefined

    const x1   = cardX(fp.track) + CARD_W       // right edge of source card
    const y1   = cardY(fp.row) + CARD_H / 2      // vertical centre of source
    const xMid = x1 + COL_GAP / 2               // trunk x, centred in the gap

    const targets = [...edges].sort((a, b) => a.tp.row - b.tp.row)
    const yLast   = cardY(targets[targets.length - 1].tp.row) + CARD_H / 2

    crossWires.push(
      <g key={`fork-${sourceId}`}>
        {/* Horizontal stub: source right-edge → trunk */}
        <line x1={x1} y1={y1} x2={xMid} y2={y1}
          stroke={color} strokeWidth={1.5} strokeDasharray={dash} />
        {/* Vertical trunk: source y → last target y */}
        <line x1={xMid} y1={y1} x2={xMid} y2={yLast}
          stroke={color} strokeWidth={1.5} strokeDasharray={dash} />
        {/* Dot where stub meets trunk */}
        <circle cx={xMid} cy={y1} r={2.5} fill={color} />

        {/* Branch for each target */}
        {targets.map((e) => {
          const ty = cardY(e.tp.row) + CARD_H / 2
          const tx = cardX(e.tp.track)
          return (
            <g key={e.to}>
              {/* Horizontal branch: trunk → target left-edge */}
              <line x1={xMid} y1={ty} x2={tx - AH} y2={ty}
                stroke={color} strokeWidth={1.5} strokeDasharray={dash} />
              {/* Arrowhead */}
              <polygon
                points={`${tx - AH},${ty - AH / 2} ${tx},${ty} ${tx - AH},${ty + AH / 2}`}
                fill={color}
              />
              {/* Dot at branch point on trunk */}
              <circle cx={xMid} cy={ty} r={2.5} fill={color} />
            </g>
          )
        })}
      </g>
    )
  })

  return (
    <svg width={SVG_W} height={SVG_H}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
      {trackBgs}
      {vertWires}
      {crossWires}
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
    <div style={{ display: 'flex', gap: 20, justifyContent: 'flex-end', marginBottom: 10 }}>
      {[
        { color: SOLID,  dash: undefined, label: 'direct lineage' },
        { color: DASHED, dash: '4,3',     label: 'borrows architecture' },
      ].map(({ color, dash, label }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width={28} height={12} style={{ overflow: 'visible' }}>
            <line x1={0} y1={6} x2={20} y2={6}
              stroke={color} strokeWidth={1.5} strokeDasharray={dash} />
            <polygon points={`14,3 20,6 14,9`} fill={color} />
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

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
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

        {/* Vertical track grid */}
        {papers !== null && papers.length > 0 && (
          <>
            <section style={{ marginBottom: 48 }}>
              <Legend />
              <div style={{ overflowX: 'auto' }}>
                <div style={{ position: 'relative', width: SVG_W, height: SVG_H }}>
                  <Wiring />
                  {Object.entries(PAPER_POSITIONS).map(([id, pos]) => {
                    const paper = paperMap.get(id)
                    if (!paper) return null
                    return (
                      <div
                        key={id}
                        style={{
                          position: 'absolute',
                          left: cardX(pos.track),
                          top: cardY(pos.row),
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

            {/* Papers not yet placed in any track */}
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
