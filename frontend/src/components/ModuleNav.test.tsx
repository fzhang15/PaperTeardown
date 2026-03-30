import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ModuleNav } from './ModuleNav'
import type { AnalyzedModule, AnalyzedLoop } from '../types'

const modules: AnalyzedModule[] = [
  { module_name: 'Encoder', file_path: 'model.py', overview: '', annotations: [] },
  { module_name: 'Decoder', file_path: 'model.py', overview: '', annotations: [] },
]

const loops: AnalyzedLoop[] = [
  { file_path: 'train.py', start_line: 10, overview: '', annotations: [] },
]

describe('ModuleNav', () => {
  it('renders all module names', () => {
    render(<ModuleNav modules={modules} loops={[]} selected={null} onSelect={vi.fn()} />)
    expect(screen.getByText('Encoder')).toBeInTheDocument()
    expect(screen.getByText('Decoder')).toBeInTheDocument()
  })

  it('renders training loops', () => {
    render(<ModuleNav modules={[]} loops={loops} selected={null} onSelect={vi.fn()} />)
    expect(screen.getByText(/Loop L10/)).toBeInTheDocument()
  })

  it('calls onSelect with correct item when module clicked', async () => {
    const onSelect = vi.fn()
    render(<ModuleNav modules={modules} loops={[]} selected={null} onSelect={onSelect} />)
    await userEvent.click(screen.getByText('Encoder'))
    expect(onSelect).toHaveBeenCalledWith({ kind: 'module', index: 0, label: 'Encoder' })
  })

  it('highlights selected module', () => {
    render(<ModuleNav modules={modules} loops={[]} selected={{ kind: 'module', index: 1, label: 'Decoder' }} onSelect={vi.fn()} />)
    const btn = screen.getByText('Decoder').closest('button')!
    expect(btn).toHaveStyle({ fontWeight: '600' })
  })
})
