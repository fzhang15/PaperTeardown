import type { Chapter } from '../types'
import { NarrativeCodeBlock } from './NarrativeCodeBlock'

interface Props {
  chapter: Chapter
  index: number
}

export function ChapterView({ chapter, index }: Props) {
  return (
    <article style={{ maxWidth: 820, margin: '0 auto', padding: '32px 24px' }}>
      {/* Chapter heading */}
      <div style={{ marginBottom: 24 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#3b82f6', letterSpacing: 0.5 }}>
          Chapter {index}
        </span>
        <h2 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>
          {chapter.title}
        </h2>
      </div>

      {/* Narrative text */}
      <div style={{ fontSize: 15, lineHeight: 1.8, color: '#374151' }}>
        {chapter.narrative.split('\n\n').map((para, i) => (
          <p key={i} style={{ margin: '0 0 16px' }}>{para}</p>
        ))}
      </div>

      {/* Code blocks */}
      {chapter.code_blocks.map((block, i) => (
        <NarrativeCodeBlock key={i} block={block} />
      ))}
    </article>
  )
}
