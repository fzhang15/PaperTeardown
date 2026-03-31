import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchIndex } from '../api/papers'
import type { PaperIndexEntry } from '../types'

// --- Lineage configuration (curated reading order) ---

const LINEAGE_GROUPS = [
  {
    id: 'foundations',
    name: 'Vision & Generative Foundations',
    description:
      'Core architectures for visual representation learning and diffusion-based generation. These are the building blocks that robot learning models draw from.',
    paperIds: ['dinov3', 'dit'],
    showArrows: false,
  },
  {
    id: 'robot-learning',
    name: 'Robot Foundation Models',
    description:
      'A direct conceptual lineage: Diffusion Policy frames action generation as DDPM denoising → RT-1 tokenises robot actions as discrete tokens → RT-2 grounds them in a VLM backbone → pi0 replaces token prediction with continuous flow matching → GR00T scales to multi-embodiment generalist control.',
    paperIds: ['diffusion-policy', 'rt1', 'rt2', 'pi0', 'groot'],
    showArrows: true,
  },
]

// Cross-group dependencies shown as a badge on individual cards
const BUILDS_ON: Record<string, string> = {
  'diffusion-policy': 'DDPM (DiT)',
  pi0: 'DiT action head',
  groot: 'DiT action head',
}

// --- Helpers ---

function formatAuthors(authors: string[]): string {
  if (authors.length <= 2) return authors.join(', ')
  return `${authors[0]}, ${authors[1]}, et al.`
}

// --- Components ---

function PaperCard({
  paper,
  onClick,
  buildsOn,
}: {
  paper: PaperIndexEntry
  onClick: () => void
  buildsOn?: string
}) {
  const abstract =
    paper.abstract.length > 180 ? paper.abstract.slice(0, 180) + '…' : paper.abstract

  return (
    <div
      onClick={onClick}
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 16,
        cursor: 'pointer',
        background: '#fff',
        transition: 'box-shadow 0.15s',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxSizing: 'border-box',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
    >
      {/* Title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: '#111827' }}>
          {paper.title}
        </h3>
        <span style={{
          flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
          background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe',
        }}>
          {paper.chapter_count} chapter{paper.chapter_count !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Cross-reference badge */}
      {buildsOn && (
        <div style={{ marginBottom: 6 }}>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99,
            background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe',
          }}>
            ↳ {buildsOn}
          </span>
        </div>
      )}

      {/* Authors */}
      <p style={{ margin: '0 0 8px', fontSize: 11, color: '#9ca3af' }}>
        {formatAuthors(paper.authors)}
      </p>

      {/* Abstract */}
      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#374151', lineHeight: 1.6, flexGrow: 1 }}>
        {abstract}
      </p>

      {/* Footer links */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <a
          href={paper.arxiv_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ fontSize: 11, color: '#9ca3af', textDecoration: 'none' }}
        >
          arXiv ↗
        </a>
        <a
          href={paper.repo_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ fontSize: 11, color: '#9ca3af', textDecoration: 'none' }}
        >
          GitHub ↗
        </a>
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 500, color: '#3b82f6' }}>
          Read →
        </span>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: '#fff', minWidth: 260 }}>
      {[140, 100, 220, 60].map((w, i) => (
        <div key={i} style={{
          height: i === 0 ? 18 : 12, width: w, marginBottom: 10,
          background: '#f3f4f6', borderRadius: 4,
        }} />
      ))}
    </div>
  )
}

function LineageSection({
  group,
  papers,
  onCardClick,
}: {
  group: typeof LINEAGE_GROUPS[0]
  papers: PaperIndexEntry[]
  onCardClick: (id: string) => void
}) {
  return (
    <section style={{ marginBottom: 48 }}>
      {/* Group header */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: '#111827' }}>
          {group.name}
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.6, maxWidth: 720 }}>
          {group.description}
        </p>
      </div>

      {/* Card strip */}
      <div style={{ display: 'flex', alignItems: 'stretch', overflowX: 'auto', paddingBottom: 6, gap: 0 }}>
        {papers.map((paper, i) => (
          <div key={paper.id} style={{ display: 'flex', alignItems: 'stretch', flexShrink: 0 }}>
            {/* Card */}
            <div style={{ width: 280 }}>
              <PaperCard
                paper={paper}
                onClick={() => onCardClick(paper.id)}
                buildsOn={BUILDS_ON[paper.id]}
              />
            </div>

            {/* Arrow connector */}
            {group.showArrows && i < papers.length - 1 && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', width: 36, flexShrink: 0, gap: 2,
              }}>
                <div style={{ width: 1, height: 28, background: '#e5e7eb' }} />
                <span style={{ fontSize: 14, color: '#9ca3af', lineHeight: 1 }}>→</span>
                <div style={{ width: 1, height: 28, background: '#e5e7eb' }} />
              </div>
            )}

            {/* Gap for peer groups (no arrows) */}
            {!group.showArrows && i < papers.length - 1 && (
              <div style={{ width: 16, flexShrink: 0 }} />
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

// --- Page ---

export function PaperList() {
  const navigate = useNavigate()
  const [papers, setPapers] = useState<PaperIndexEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchIndex()
      .then(setPapers)
      .catch((e: Error) => setError(e.message))
  }, [])

  // Build a lookup map once papers are loaded
  const paperMap = new Map(papers?.map((p) => [p.id, p]) ?? [])

  // Papers not assigned to any lineage group
  const assignedIds = new Set(LINEAGE_GROUPS.flatMap((g) => g.paperIds))
  const ungrouped = papers?.filter((p) => !assignedIds.has(p.id)) ?? []

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '16px 24px' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>PaperTeardown</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
          Deconstructed PyTorch papers — browse chapters, read code explanations
        </p>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        {error && (
          <div role="alert" style={{
            background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8,
            padding: 16, color: '#b91c1c', marginBottom: 24,
          }}>
            {error}
            <button onClick={() => window.location.reload()} style={{ marginLeft: 12, cursor: 'pointer' }}>
              Retry
            </button>
          </div>
        )}

        {/* Loading skeletons */}
        {papers === null && !error && (
          <div style={{ display: 'flex', gap: 16 }}>
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {papers !== null && papers.length === 0 && (
          <div style={{ textAlign: 'center', padding: 64, color: '#6b7280' }}>
            <p style={{ fontSize: 16, marginBottom: 8 }}>No papers ingested yet.</p>
            <code style={{ fontSize: 13, background: '#f3f4f6', padding: '4px 8px', borderRadius: 4 }}>
              python -m backend.ingest --spec specs/papers/&lt;paper&gt;.md
            </code>
          </div>
        )}

        {/* Lineage groups */}
        {papers !== null && papers.length > 0 && (
          <>
            {LINEAGE_GROUPS.map((group) => {
              const groupPapers = group.paperIds
                .map((id) => paperMap.get(id))
                .filter((p): p is PaperIndexEntry => p !== undefined)
              if (groupPapers.length === 0) return null
              return (
                <LineageSection
                  key={group.id}
                  group={group}
                  papers={groupPapers}
                  onCardClick={(id) => navigate(`/paper/${id}`)}
                />
              )
            })}

            {/* Catch-all for any papers not in a lineage group */}
            {ungrouped.length > 0 && (
              <section>
                <h2 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700, color: '#111827' }}>
                  Other Papers
                </h2>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {ungrouped.map((p) => (
                    <div key={p.id} style={{ width: 280 }}>
                      <PaperCard paper={p} onClick={() => navigate(`/paper/${p.id}`)} />
                    </div>
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
