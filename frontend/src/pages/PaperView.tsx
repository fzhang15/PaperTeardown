import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchPaper } from '../api/papers'
import { ChapterNav } from '../components/ChapterNav'
import { ChapterView } from '../components/ChapterView'
import { PdfViewer } from '../components/PdfViewer'
import type { AnalysisResult, PaperMeta } from '../types'

export function PaperView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [meta, setMeta] = useState<PaperMeta | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null)
  const chapterRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    if (!id) return
    fetchPaper(id)
      .then(({ meta, analysis }) => {
        setMeta(meta)
        setAnalysis(analysis)
        if (analysis.chapters.length > 0) {
          setActiveChapterId(analysis.chapters[0].id)
        }
      })
      .catch((e: Error) => setError(e.message))
  }, [id])

  function handleSelectChapter(chapterId: string) {
    setActiveChapterId(chapterId)
    const el = chapterRefs.current[chapterId]
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16 }}>
        <p role="alert" style={{ color: '#b91c1c', fontSize: 16 }}>{error}</p>
        <button onClick={() => navigate('/')} style={{ padding: '8px 20px', cursor: 'pointer' }}>
          ← Back to catalog
        </button>
      </div>
    )
  }

  if (!meta || !analysis) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#9ca3af' }}>
        Loading…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <header style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb', background: '#fff', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => navigate('/')}
            style={{ fontSize: 13, cursor: 'pointer', padding: '4px 10px', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 4, background: 'none' }}
          >
            ← Catalog
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {meta.title}
            </h1>
            <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>
              {meta.authors.slice(0, 3).join(', ')}{meta.authors.length > 3 ? ', et al.' : ''} ·{' '}
              <a href={meta.arxiv_url} target="_blank" rel="noopener noreferrer" style={{ color: '#9ca3af' }}>arXiv ↗</a>
              {' · '}
              <a href={meta.repo_url} target="_blank" rel="noopener noreferrer" style={{ color: '#9ca3af' }}>GitHub ↗</a>
            </p>
          </div>
          <span style={{ fontSize: 12, color: '#6b7280', flexShrink: 0 }}>
            {analysis.chapters.length} chapter{analysis.chapters.length !== 1 ? 's' : ''}
          </span>
        </div>
      </header>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Chapter navigation */}
        <ChapterNav
          chapters={analysis.chapters}
          activeId={activeChapterId}
          onSelect={handleSelectChapter}
        />

        {/* Scrollable content area */}
        <div style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
          {/* Summary */}
          <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 24px 0' }}>
            <div style={{
              padding: '20px 24px', background: '#f0f9ff', borderRadius: 8,
              border: '1px solid #bae6fd', marginBottom: 8,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#0369a1', marginBottom: 6 }}>TL;DR</div>
              <p style={{ margin: 0, fontSize: 14, color: '#0c4a6e', lineHeight: 1.7 }}>
                {analysis.summary}
              </p>
            </div>
          </div>

          {/* Chapters */}
          {analysis.chapters.map((chapter, i) => (
            <div
              key={chapter.id}
              ref={(el) => { chapterRefs.current[chapter.id] = el }}
              style={{ borderBottom: i < analysis.chapters.length - 1 ? '1px solid #e5e7eb' : 'none' }}
            >
              <ChapterView chapter={chapter} index={i} />
            </div>
          ))}

          {/* PDF viewer */}
          {id && (
            <div style={{ maxWidth: 820, margin: '0 auto', padding: '0 24px 32px' }}>
              <PdfViewer paperId={id} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
