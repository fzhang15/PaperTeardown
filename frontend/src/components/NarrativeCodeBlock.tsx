import { useEffect, useMemo, useRef, useState } from 'react'
import hljs from 'highlight.js/lib/core'
import python from 'highlight.js/lib/languages/python'
import 'highlight.js/styles/github.css'
import type { CodeBlock, LineAnnotation } from '../types'

hljs.registerLanguage('python', python)

interface Props {
  block: CodeBlock
}

export function NarrativeCodeBlock({ block }: Props) {
  const [activeAnnotation, setActiveAnnotation] = useState<LineAnnotation | null>(null)
  const codeContainerRef = useRef<HTMLDivElement | null>(null)
  const lineRefs = useRef<Record<number, HTMLDivElement | null>>({})

  const displayLines = useMemo(() => {
    if (!block.source) return []
    const lines = block.source.split('\n')
    const start = block.source_start_line ?? 1
    return lines.map((text, i) => ({ line: start + i, text }))
  }, [block.source, block.source_start_line])

  const highlightedLines = useMemo(() => {
    if (!block.source) return []
    return hljs.highlight(block.source, { language: 'python' }).value.split('\n')
  }, [block.source])

  // Scroll ONLY within the code container — never move the outer page
  useEffect(() => {
    if (!activeAnnotation || !codeContainerRef.current) return
    const el = lineRefs.current[activeAnnotation.start_line]
    if (!el) return
    const container = codeContainerRef.current
    const elTop = el.offsetTop - container.offsetTop
    container.scrollTo({ top: Math.max(0, elTop - 8), behavior: 'smooth' })
  }, [activeAnnotation])

  const isHighlighted = (line: number) =>
    activeAnnotation !== null && line >= activeAnnotation.start_line && line <= activeAnnotation.end_line

  const getAnnotationForLine = (line: number) =>
    block.annotations.find(a => line >= a.start_line && line <= a.end_line) ?? null

  return (
    <div style={{ margin: '20px 0', borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
      {/* Code block header */}
      <div style={{
        padding: '8px 14px', background: '#f3f4f6', borderBottom: '1px solid #e5e7eb',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{block.label}</span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>{block.file_path}</span>
      </div>

      {/* Code area — scrolls independently */}
      <div
        ref={codeContainerRef}
        style={{
          overflow: 'auto', fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
          fontSize: 13, background: '#fafafa', maxHeight: 500,
        }}
      >
        <div style={{ padding: '8px 0', minWidth: 'fit-content' }}>
          {displayLines.map(({ line }, i) => (
            <div
              key={line}
              ref={(el) => { lineRefs.current[line] = el }}
              onClick={() => {
                const ann = getAnnotationForLine(line)
                setActiveAnnotation(ann === activeAnnotation ? null : ann)
              }}
              style={{
                display: 'flex', gap: 8, padding: '1px 12px 1px 0', cursor: 'pointer',
                background: isHighlighted(line) ? '#fef9c3' : 'transparent',
                transition: 'background 0.15s', lineHeight: '20px',
              }}
            >
              <span style={{
                color: '#9ca3af', userSelect: 'none', minWidth: 40, textAlign: 'right',
                paddingRight: 8, borderRight: '1px solid #e5e7eb', fontSize: 12, lineHeight: '20px',
              }}>
                {line}
              </span>
              <span
                className="hljs"
                style={{ flex: 1, whiteSpace: 'pre', tabSize: 4 }}
                dangerouslySetInnerHTML={{ __html: highlightedLines[i] || '&nbsp;' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Inline annotations below code */}
      {block.annotations.length > 0 && (
        <div style={{ borderTop: '1px solid #e5e7eb', background: '#fff' }}>
          {block.annotations.map((ann, i) => {
            const isActive = activeAnnotation === ann
            return (
              <div
                key={i}
                onMouseEnter={() => setActiveAnnotation(ann)}
                onMouseLeave={() => setActiveAnnotation(null)}
                onClick={() => setActiveAnnotation(isActive ? null : ann)}
                style={{
                  padding: '10px 14px', cursor: 'pointer',
                  borderBottom: i < block.annotations.length - 1 ? '1px solid #f3f4f6' : 'none',
                  background: isActive ? '#fffbeb' : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{
                    fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', flexShrink: 0,
                  }}>
                    L{ann.start_line}{ann.end_line !== ann.start_line ? `–${ann.end_line}` : ''}
                  </span>
                  {ann.concept_tag && (
                    <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 3,
                      background: '#eff6ff', color: '#3b82f6', fontWeight: 600,
                    }}>
                      {ann.concept_tag}
                    </span>
                  )}
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                  {ann.explanation}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
