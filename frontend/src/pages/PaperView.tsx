import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchPaper } from '../api/papers'
import { ModuleNav, type NavItem } from '../components/ModuleNav'
import { ExplanationPanel } from '../components/ExplanationPanel'
import { CodePanel } from '../components/CodePanel'
import { PdfViewer } from '../components/PdfViewer'
import type { AnalysisResult, PaperMeta } from '../types'

export function PaperView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [meta, setMeta] = useState<PaperMeta | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedNav, setSelectedNav] = useState<NavItem | null>(null)
  const [highlightRange, setHighlightRange] = useState<[number, number] | null>(null)

  useEffect(() => {
    if (!id) return
    fetchPaper(id)
      .then(({ meta, analysis }) => {
        setMeta(meta)
        setAnalysis(analysis)
        if (analysis.analyzed_modules.length > 0) {
          setSelectedNav({ kind: 'module', index: 0, label: analysis.analyzed_modules[0].module_name })
        } else if (analysis.analyzed_loops.length > 0) {
          setSelectedNav({ kind: 'loop', index: 0, label: `Loop L${analysis.analyzed_loops[0].start_line}` })
        }
      })
      .catch((e: Error) => setError(e.message))
  }, [id])

  const selectedItem =
    analysis && selectedNav
      ? selectedNav.kind === 'module'
        ? analysis.analyzed_modules[selectedNav.index]
        : analysis.analyzed_loops[selectedNav.index]
      : null

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
            {analysis.analyzed_modules.length} module{analysis.analyzed_modules.length !== 1 ? 's' : ''}
          </span>
        </div>
      </header>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Module nav sidebar */}
        <ModuleNav
          modules={analysis.analyzed_modules}
          loops={analysis.analyzed_loops}
          selected={selectedNav}
          onSelect={(item) => { setSelectedNav(item); setHighlightRange(null) }}
        />

        {/* Right area: panels + PDF */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Side-by-side panels */}
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            {selectedItem ? (
              <>
                <div style={{ width: '40%', borderRight: '1px solid #e5e7eb', overflow: 'hidden' }}>
                  <ExplanationPanel
                    item={selectedItem}
                    activeRange={highlightRange}
                    onAnnotationHover={setHighlightRange}
                    onAnnotationClick={setHighlightRange}
                  />
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <CodePanel
                    item={selectedItem}
                    highlightRange={highlightRange}
                    onLineClick={(line) => {
                      const ann = selectedItem.annotations.find(
                        (a) => line >= a.start_line && line <= a.end_line
                      )
                      if (ann) setHighlightRange([ann.start_line, ann.end_line])
                    }}
                  />
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                Select a module from the sidebar
              </div>
            )}
          </div>

          {/* PDF viewer (collapsible, at bottom) */}
          {id && <PdfViewer paperId={id} />}
        </div>
      </div>
    </div>
  )
}
