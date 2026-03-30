import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CodePanel } from './CodePanel'
import type { AnalyzedModule } from '../types'

const module: AnalyzedModule = {
  module_name: 'Net',
  file_path: 'model.py',
  overview: 'A net.',
  annotations: [
    { start_line: 10, end_line: 11, explanation: 'Linear layer.', concept_tag: 'linear' },
    { start_line: 12, end_line: 12, explanation: 'Return.', concept_tag: 'linear' },
  ],
}

describe('CodePanel', () => {
  it('renders line numbers from annotations', () => {
    render(<CodePanel item={module} highlightRange={null} onLineClick={vi.fn()} />)
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('11')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('line numbers reflect original file positions (not reset to 1)', () => {
    render(<CodePanel item={module} highlightRange={null} onLineClick={vi.fn()} />)
    // First line shown should be 10, not 1
    const lineNumbers = screen.getAllByText(/^\d+$/).map((el) => parseInt(el.textContent!))
    expect(Math.min(...lineNumbers)).toBe(10)
  })

  it('calls onLineClick when a line is clicked', () => {
    const onLineClick = vi.fn()
    render(<CodePanel item={module} highlightRange={null} onLineClick={onLineClick} />)
    fireEvent.click(screen.getByText('10').closest('div')!)
    expect(onLineClick).toHaveBeenCalledWith(10)
  })

  it('renders placeholder when no annotations', () => {
    const empty: AnalyzedModule = { ...module, annotations: [] }
    render(<CodePanel item={empty} highlightRange={null} onLineClick={vi.fn()} />)
    expect(screen.getByText(/No code to display/i)).toBeInTheDocument()
  })
})
