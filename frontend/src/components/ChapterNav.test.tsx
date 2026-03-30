import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ChapterNav } from './ChapterNav'
import type { Chapter } from '../types'

const chapters: Chapter[] = [
  { id: 'intro', title: 'Introduction', narrative: '', code_blocks: [] },
  { id: 'attention', title: 'Cross-Scale Attention', narrative: '', code_blocks: [] },
  { id: 'training', title: 'Training Loss', narrative: '', code_blocks: [] },
]

describe('ChapterNav', () => {
  it('renders all chapter titles', () => {
    render(<ChapterNav chapters={chapters} activeId={null} onSelect={vi.fn()} />)
    expect(screen.getByText('Introduction')).toBeInTheDocument()
    expect(screen.getByText('Cross-Scale Attention')).toBeInTheDocument()
    expect(screen.getByText('Training Loss')).toBeInTheDocument()
  })

  it('renders chapter numbers', () => {
    render(<ChapterNav chapters={chapters} activeId={null} onSelect={vi.fn()} />)
    expect(screen.getByText('0.')).toBeInTheDocument()
    expect(screen.getByText('1.')).toBeInTheDocument()
    expect(screen.getByText('2.')).toBeInTheDocument()
  })

  it('calls onSelect with chapter id when clicked', async () => {
    const onSelect = vi.fn()
    render(<ChapterNav chapters={chapters} activeId={null} onSelect={onSelect} />)
    await userEvent.click(screen.getByText('Cross-Scale Attention'))
    expect(onSelect).toHaveBeenCalledWith('attention')
  })

  it('highlights the active chapter', () => {
    render(<ChapterNav chapters={chapters} activeId="attention" onSelect={vi.fn()} />)
    const btn = screen.getByText('Cross-Scale Attention').closest('button')!
    expect(btn).toHaveStyle({ fontWeight: '600' })
  })
})
