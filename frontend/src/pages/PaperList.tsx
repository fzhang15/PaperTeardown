import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchIndex } from '../api/papers'
import type { PaperIndexEntry } from '../types'

function formatAuthors(authors: string[]): string {
  if (authors.length <= 2) return authors.join(', ')
  return `${authors[0]}, ${authors[1]}, et al.`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function PaperCard({ paper, onClick }: { paper: PaperIndexEntry; onClick: () => void }) {
  const abstract = paper.abstract.length > 200
    ? paper.abstract.slice(0, 200) + '…'
    : paper.abstract

  return (
    <div
      onClick={onClick}
      style={{
        border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, cursor: 'pointer',
        background: '#fff', transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, lineHeight: 1.4, color: '#111827' }}>
          {paper.title}
        </h2>
        <span style={{
          flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
          background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe',
        }}>
          {paper.module_count} module{paper.module_count !== 1 ? 's' : ''}
        </span>
      </div>
      <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6b7280' }}>
        {formatAuthors(paper.authors)} · {formatDate(paper.ingested_at)}
      </p>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
        {abstract}
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <a
          href={paper.arxiv_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ fontSize: 12, color: '#6b7280', textDecoration: 'none' }}
        >
          arXiv ↗
        </a>
        <a
          href={paper.repo_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ fontSize: 12, color: '#6b7280', textDecoration: 'none' }}
        >
          GitHub ↗
        </a>
        <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 500, color: '#3b82f6' }}>
          View Teardown →
        </span>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, background: '#fff' }}>
      {[180, 120, 300, 80].map((w, i) => (
        <div key={i} style={{
          height: i === 0 ? 20 : 14, width: w, marginBottom: 12,
          background: '#f3f4f6', borderRadius: 4,
        }} />
      ))}
    </div>
  )
}

export function PaperList() {
  const navigate = useNavigate()
  const [papers, setPapers] = useState<PaperIndexEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchIndex()
      .then(setPapers)
      .catch((e: Error) => setError(e.message))
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '16px 24px' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>PaperTeardown</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
          Deconstructed PyTorch papers — browse modules, read code explanations
        </p>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
        {error && (
          <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: 16, color: '#b91c1c', marginBottom: 24 }}>
            {error}
            <button onClick={() => window.location.reload()} style={{ marginLeft: 12, cursor: 'pointer' }}>
              Retry
            </button>
          </div>
        )}

        {papers === null && !error && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 16 }}>
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 16 }}>
            {papers.map((p) => (
              <PaperCard key={p.id} paper={p} onClick={() => navigate(`/paper/${p.id}`)} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
