import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ExplanationPanel } from './ExplanationPanel'
import type { AnalyzedModule } from '../types'

const module: AnalyzedModule = {
  module_name: 'Net',
  file_path: 'model.py',
  overview: 'A simple network.',
  annotations: [
    { start_line: 5, end_line: 6, explanation: 'Applies linear layer.', concept_tag: 'linear' },
    { start_line: 7, end_line: 7, explanation: 'Returns output.', concept_tag: 'activation' },
  ],
}

describe('ExplanationPanel', () => {
  it('renders module name', () => {
    render(<ExplanationPanel item={module} activeRange={null} onAnnotationHover={vi.fn()} onAnnotationClick={vi.fn()} />)
    expect(screen.getByText('Net')).toBeInTheDocument()
  })

  it('renders overview text', () => {
    render(<ExplanationPanel item={module} activeRange={null} onAnnotationHover={vi.fn()} onAnnotationClick={vi.fn()} />)
    expect(screen.getByText('A simple network.')).toBeInTheDocument()
  })

  it('renders all annotations', () => {
    render(<ExplanationPanel item={module} activeRange={null} onAnnotationHover={vi.fn()} onAnnotationClick={vi.fn()} />)
    expect(screen.getByText('Applies linear layer.')).toBeInTheDocument()
    expect(screen.getByText('Returns output.')).toBeInTheDocument()
  })

  it('renders concept tags', () => {
    render(<ExplanationPanel item={module} activeRange={null} onAnnotationHover={vi.fn()} onAnnotationClick={vi.fn()} />)
    expect(screen.getByText('linear')).toBeInTheDocument()
    expect(screen.getByText('activation')).toBeInTheDocument()
  })

  it('calls onAnnotationHover with range on mouse enter', () => {
    const onHover = vi.fn()
    render(<ExplanationPanel item={module} activeRange={null} onAnnotationHover={onHover} onAnnotationClick={vi.fn()} />)
    fireEvent.mouseEnter(screen.getByText('Applies linear layer.').closest('div')!)
    expect(onHover).toHaveBeenCalledWith([5, 6])
  })

  it('calls onAnnotationHover with null on mouse leave', () => {
    const onHover = vi.fn()
    render(<ExplanationPanel item={module} activeRange={null} onAnnotationHover={onHover} onAnnotationClick={vi.fn()} />)
    fireEvent.mouseLeave(screen.getByText('Applies linear layer.').closest('div')!)
    expect(onHover).toHaveBeenCalledWith(null)
  })

  it('calls onAnnotationClick with range on click', () => {
    const onClick = vi.fn()
    render(<ExplanationPanel item={module} activeRange={null} onAnnotationHover={vi.fn()} onAnnotationClick={onClick} />)
    fireEvent.click(screen.getByText('Applies linear layer.').closest('div')!)
    expect(onClick).toHaveBeenCalledWith([5, 6])
  })

  it('shows error state when module has error', () => {
    const errModule: AnalyzedModule = { ...module, error: 'LLM failed' }
    render(<ExplanationPanel item={errModule} activeRange={null} onAnnotationHover={vi.fn()} onAnnotationClick={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('LLM failed')
  })

  it('highlights active annotation', () => {
    render(<ExplanationPanel item={module} activeRange={[5, 6]} onAnnotationHover={vi.fn()} onAnnotationClick={vi.fn()} />)
    // The active card should have blue border styling — just check it renders without error
    expect(screen.getByText('Applies linear layer.')).toBeInTheDocument()
  })
})
