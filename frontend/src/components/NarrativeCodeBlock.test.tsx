import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeAll } from 'vitest'
import { NarrativeCodeBlock } from './NarrativeCodeBlock'

// jsdom doesn't implement scroll methods
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {}
  Element.prototype.scrollTo = (() => {}) as any
})
import type { CodeBlock } from '../types'

const block: CodeBlock = {
  label: 'Self-attention',
  source: 'class Attn(nn.Module):\n    def forward(self, x):\n        return self.proj(x)',
  source_start_line: 5,
  file_path: 'attn.py',
  annotations: [
    { start_line: 5, end_line: 5, explanation: 'Class definition.', concept_tag: 'attention' },
    { start_line: 6, end_line: 7, explanation: 'Forward method.', concept_tag: 'linear' },
  ],
}

describe('NarrativeCodeBlock', () => {
  it('renders code block label and file path', () => {
    render(<NarrativeCodeBlock block={block} />)
    expect(screen.getByText('Self-attention')).toBeInTheDocument()
    expect(screen.getByText('attn.py')).toBeInTheDocument()
  })

  it('renders line numbers starting from source_start_line', () => {
    render(<NarrativeCodeBlock block={block} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('renders annotation explanations', () => {
    render(<NarrativeCodeBlock block={block} />)
    expect(screen.getByText('Class definition.')).toBeInTheDocument()
    expect(screen.getByText('Forward method.')).toBeInTheDocument()
  })

  it('renders concept tags', () => {
    render(<NarrativeCodeBlock block={block} />)
    expect(screen.getByText('attention')).toBeInTheDocument()
    expect(screen.getByText('linear')).toBeInTheDocument()
  })

  it('renders line range labels', () => {
    render(<NarrativeCodeBlock block={block} />)
    expect(screen.getByText('L5')).toBeInTheDocument()
    expect(screen.getByText('L6–7')).toBeInTheDocument()
  })

  it('highlights lines when annotation is hovered', () => {
    render(<NarrativeCodeBlock block={block} />)
    const annEl = screen.getByText('Class definition.').closest('div')!
    fireEvent.mouseEnter(annEl)
    // The annotation card should have the active background
    expect(annEl).toHaveStyle({ background: '#fffbeb' })
  })
})
