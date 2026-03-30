import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ProgressView } from './ProgressView'
import type { JobStatus } from '../types'

function makeStatus(status: JobStatus['status'], current_module?: string): JobStatus {
  return {
    job_id: 'test',
    status,
    progress: { current_module: current_module ?? null, modules_done: 1, modules_total: 3 },
    error: null,
  }
}

describe('ProgressView', () => {
  it('renders three step indicators', () => {
    render(<ProgressView status={makeStatus('cloning')} onCancel={vi.fn()} />)
    expect(screen.getByText(/Cloning repository/i)).toBeInTheDocument()
    expect(screen.getByText(/Parsing PyTorch/i)).toBeInTheDocument()
    expect(screen.getByText(/Analyzing modules/i)).toBeInTheDocument()
  })

  it('shows current module name when analyzing', () => {
    render(<ProgressView status={makeStatus('analyzing', 'ResNet')} onCancel={vi.fn()} />)
    expect(screen.getByText(/ResNet/)).toBeInTheDocument()
  })

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn()
    render(<ProgressView status={makeStatus('cloning')} onCancel={onCancel} />)
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
