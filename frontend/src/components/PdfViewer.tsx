import { useState } from 'react'

interface Props {
  paperId: string
}

export function PdfViewer({ paperId }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ borderTop: '1px solid #e5e7eb' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', padding: '10px 16px', background: '#f9fafb',
          border: 'none', cursor: 'pointer', textAlign: 'left',
          fontSize: 13, color: '#374151', fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        <span>{open ? '▲' : '▼'}</span>
        {open ? 'Hide Paper PDF' : 'Show Paper PDF'}
      </button>
      {open && (
        <iframe
          src={`/data/papers/${paperId}/paper.pdf`}
          style={{ width: '100%', height: 500, border: 'none', display: 'block' }}
          title="Paper PDF"
          onError={() => {/* handled by browser natively */}}
        />
      )}
    </div>
  )
}
