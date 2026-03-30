import { useEffect, useRef } from 'react'
import hljs from 'highlight.js/lib/core'
import python from 'highlight.js/lib/languages/python'
import type { AnalyzedModule, AnalyzedLoop } from '../types'

hljs.registerLanguage('python', python)

interface Props {
  item: AnalyzedModule | AnalyzedLoop
  highlightRange: [number, number] | null
  onLineClick: (line: number) => void
}

// Reconstruct line stubs from annotation ranges for display.
// Raw source is not available in the frontend type; line numbers are anchored to original file positions.
function buildDisplayLines(item: AnalyzedModule | AnalyzedLoop): { line: number; text: string }[] {
  const all = item.annotations
  if (all.length === 0) return []
  const min = Math.min(...all.map((a) => a.start_line))
  const max = Math.max(...all.map((a) => a.end_line))
  return Array.from({ length: max - min + 1 }, (_, i) => ({ line: min + i, text: '' }))
}

export function CodePanel({ item, highlightRange, onLineClick }: Props) {
  const lineRefs = useRef<Record<number, HTMLDivElement | null>>({})

  // Scroll to highlighted range
  useEffect(() => {
    if (!highlightRange) return
    const el = lineRefs.current[highlightRange[0]]
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [highlightRange])

  const displayLines = buildDisplayLines(item)

  const isHighlighted = (line: number) =>
    highlightRange !== null && line >= highlightRange[0] && line <= highlightRange[1]

  return (
    <div style={{ height: '100%', overflow: 'auto', fontFamily: 'monospace', fontSize: 13 }}>
      <div style={{ padding: '8px 0' }}>
        {displayLines.map(({ line, text }) => (
          <div
            key={line}
            ref={(el) => { lineRefs.current[line] = el }}
            onClick={() => onLineClick(line)}
            style={{
              display: 'flex', gap: 12, padding: '1px 12px', cursor: 'pointer',
              background: isHighlighted(line) ? '#fef9c3' : 'transparent',
              transition: 'background 0.15s',
            }}
          >
            <span style={{ color: '#9ca3af', userSelect: 'none', minWidth: 32, textAlign: 'right' }}>
              {line}
            </span>
            <span
              style={{ flex: 1, whiteSpace: 'pre' }}
              dangerouslySetInnerHTML={{ __html: text ? hljs.highlight(text, { language: 'python' }).value : '&nbsp;' }}
            />
          </div>
        ))}
        {displayLines.length === 0 && (
          <p style={{ padding: '16px 12px', color: '#9ca3af' }}>No code to display.</p>
        )}
      </div>
    </div>
  )
}
