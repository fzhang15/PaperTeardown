import type { AnalyzedModule, AnalyzedLoop, LineAnnotation } from '../types'

interface Props {
  item: AnalyzedModule | AnalyzedLoop
  activeRange: [number, number] | null
  onAnnotationHover: (range: [number, number] | null) => void
  onAnnotationClick: (range: [number, number]) => void
}

const TAG_COLORS: Record<string, string> = {
  attention: '#8b5cf6',
  convolution: '#3b82f6',
  normalization: '#06b6d4',
  activation: '#f59e0b',
  loss: '#ef4444',
  optimizer: '#10b981',
  embedding: '#6366f1',
  pooling: '#0ea5e9',
  residual: '#84cc16',
  dropout: '#f97316',
  linear: '#64748b',
  data_loading: '#a855f7',
  logging: '#94a3b8',
  other: '#9ca3af',
}

function tagColor(tag?: string | null) {
  if (!tag) return '#9ca3af'
  const base = tag.startsWith('other:') ? 'other' : tag
  return TAG_COLORS[base] ?? '#9ca3af'
}

function getName(item: AnalyzedModule | AnalyzedLoop): string {
  return 'module_name' in item ? item.module_name : `Training loop (L${item.start_line})`
}

export function ExplanationPanel({ item, activeRange, onAnnotationHover, onAnnotationClick }: Props) {
  const isActive = (a: LineAnnotation) =>
    activeRange !== null && a.start_line === activeRange[0] && a.end_line === activeRange[1]

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 16 }}>
      <h3 style={{ marginTop: 0, fontFamily: 'monospace' }}>{getName(item)}</h3>
      {item.overview && (
        <p style={{ color: '#374151', lineHeight: 1.6, marginBottom: 20 }}>{item.overview}</p>
      )}
      {'error' in item && item.error && (
        <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: 12, marginBottom: 12, color: '#b91c1c' }}>
          Analysis error: {item.error}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {item.annotations.map((ann, i) => (
          <div
            key={i}
            onMouseEnter={() => onAnnotationHover([ann.start_line, ann.end_line])}
            onMouseLeave={() => onAnnotationHover(null)}
            onClick={() => onAnnotationClick([ann.start_line, ann.end_line])}
            style={{
              padding: 12,
              borderRadius: 6,
              border: `1px solid ${isActive(ann) ? '#3b82f6' : '#e5e7eb'}`,
              background: isActive(ann) ? '#eff6ff' : '#f9fafb',
              cursor: 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#6b7280' }}>
                L{ann.start_line}{ann.end_line !== ann.start_line ? `–${ann.end_line}` : ''}
              </span>
              {ann.concept_tag && (
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 99,
                  background: tagColor(ann.concept_tag) + '22',
                  color: tagColor(ann.concept_tag),
                  border: `1px solid ${tagColor(ann.concept_tag)}44`,
                }}>
                  {ann.concept_tag}
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
              {ann.explanation}
            </p>
          </div>
        ))}
        {item.annotations.length === 0 && !item.overview && (
          <p style={{ color: '#9ca3af' }}>No annotations available.</p>
        )}
      </div>
    </div>
  )
}
