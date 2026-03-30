import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ChapterView } from './ChapterView'
import type { Chapter } from '../types'

const chapter: Chapter = {
  id: 'test-ch',
  title: 'The Core Innovation',
  narrative: 'This is the first paragraph.\n\nThis is the second paragraph.',
  code_blocks: [
    {
      label: 'Attention mechanism',
      source: 'q = self.q_proj(x)\nk = self.k_proj(x)',
      source_start_line: 10,
      file_path: 'model.py',
      annotations: [
        { start_line: 10, end_line: 11, explanation: 'Project Q and K.', concept_tag: 'attention' },
      ],
    },
  ],
}

describe('ChapterView', () => {
  it('renders chapter title', () => {
    render(<ChapterView chapter={chapter} index={2} />)
    expect(screen.getByText('The Core Innovation')).toBeInTheDocument()
  })

  it('renders chapter number', () => {
    render(<ChapterView chapter={chapter} index={2} />)
    expect(screen.getByText('Chapter 2')).toBeInTheDocument()
  })

  it('renders narrative paragraphs', () => {
    render(<ChapterView chapter={chapter} index={0} />)
    expect(screen.getByText('This is the first paragraph.')).toBeInTheDocument()
    expect(screen.getByText('This is the second paragraph.')).toBeInTheDocument()
  })

  it('renders code block label', () => {
    render(<ChapterView chapter={chapter} index={0} />)
    expect(screen.getByText('Attention mechanism')).toBeInTheDocument()
  })

  it('renders code block file path', () => {
    render(<ChapterView chapter={chapter} index={0} />)
    expect(screen.getByText('model.py')).toBeInTheDocument()
  })
})
