import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { UrlInput } from './UrlInput'

describe('UrlInput', () => {
  it('renders input and button', () => {
    render(<UrlInput onSubmit={vi.fn()} loading={false} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /analyze/i })).toBeInTheDocument()
  })

  it('calls onSubmit with the entered URL', async () => {
    const onSubmit = vi.fn()
    render(<UrlInput onSubmit={onSubmit} loading={false} />)
    await userEvent.type(screen.getByRole('textbox'), 'https://github.com/user/repo')
    await userEvent.click(screen.getByRole('button', { name: /analyze/i }))
    expect(onSubmit).toHaveBeenCalledWith('https://github.com/user/repo')
  })

  it('disables button when loading', () => {
    render(<UrlInput onSubmit={vi.fn()} loading={true} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('displays error message when provided', () => {
    render(<UrlInput onSubmit={vi.fn()} loading={false} error="Invalid URL" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid URL')
  })

  it('does not show error when error prop is absent', () => {
    render(<UrlInput onSubmit={vi.fn()} loading={false} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
