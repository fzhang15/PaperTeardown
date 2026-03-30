import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { PdfViewer } from './PdfViewer'

describe('PdfViewer', () => {
  it('renders collapsed by default', () => {
    render(<PdfViewer paperId="dinov2" />)
    expect(screen.getByText(/Show Paper PDF/)).toBeInTheDocument()
    expect(screen.queryByTitle('Paper PDF')).not.toBeInTheDocument()
  })

  it('shows iframe when toggled open', async () => {
    render(<PdfViewer paperId="dinov2" />)
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByTitle('Paper PDF')).toBeInTheDocument()
  })

  it('iframe src points to correct paper pdf', async () => {
    render(<PdfViewer paperId="dinov2" />)
    await userEvent.click(screen.getByRole('button'))
    const iframe = screen.getByTitle('Paper PDF') as HTMLIFrameElement
    expect(iframe.src).toContain('/papers/dinov2/paper.pdf')
  })

  it('collapses again on second click', async () => {
    render(<PdfViewer paperId="dinov2" />)
    await userEvent.click(screen.getByRole('button'))
    await userEvent.click(screen.getByRole('button'))
    expect(screen.queryByTitle('Paper PDF')).not.toBeInTheDocument()
  })
})
