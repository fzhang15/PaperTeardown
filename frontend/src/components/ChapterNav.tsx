import type { Chapter } from '../types'

interface Props {
  chapters: Chapter[]
  activeId: string | null
  onSelect: (id: string) => void
}

export function ChapterNav({ chapters, activeId, onSelect }: Props) {
  return (
    <nav style={{
      width: 220, flexShrink: 0, borderRight: '1px solid #e5e7eb',
      overflow: 'auto', background: '#fafafa', padding: '16px 0',
    }}>
      <div style={{ padding: '0 16px 12px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>
        Chapters
      </div>
      {chapters.map((ch, i) => {
        const isActive = ch.id === activeId
        return (
          <button
            key={ch.id}
            onClick={() => onSelect(ch.id)}
            style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
              padding: '10px 16px',
              background: isActive ? '#eff6ff' : 'transparent',
              borderLeft: isActive ? '3px solid #3b82f6' : '3px solid transparent',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#1d4ed8' : '#374151',
              fontSize: 13, lineHeight: '1.4',
            }}
          >
            <span style={{ color: '#9ca3af', fontWeight: 600, flexShrink: 0, minWidth: 18 }}>
              {i}.
            </span>
            <span>{ch.title}</span>
          </button>
        )
      })}
    </nav>
  )
}
