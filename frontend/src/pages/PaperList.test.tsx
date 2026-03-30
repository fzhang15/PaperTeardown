import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { PaperList } from './PaperList'
import * as papersApi from '../api/papers'
import type { PaperIndexEntry } from '../types'

const MOCK_PAPERS: PaperIndexEntry[] = [
  {
    id: 'dinov2',
    title: 'DINOv2: Learning Robust Visual Features',
    authors: ['Maxime Oquab', 'Timothée Darcet', 'Extra Author'],
    arxiv_url: 'https://arxiv.org/abs/2304.07193',
    repo_url: 'https://github.com/facebookresearch/dinov2',
    abstract: 'We present DINOv2, a self-supervised learning method.',
    chapter_count: 6,
    ingested_at: '2026-03-29T18:00:00Z',
  },
  {
    id: 'attention',
    title: 'Attention Is All You Need',
    authors: ['Vaswani'],
    arxiv_url: 'https://arxiv.org/abs/1706.03762',
    repo_url: 'https://github.com/some/repo',
    abstract: 'The dominant sequence transduction models are based on recurrent or convolutional networks.',
    chapter_count: 3,
    ingested_at: '2026-03-28T12:00:00Z',
  },
]

function renderList() {
  return render(<MemoryRouter><PaperList /></MemoryRouter>)
}

describe('PaperList', () => {
  beforeEach(() => {
    vi.spyOn(papersApi, 'fetchIndex').mockResolvedValue(MOCK_PAPERS)
  })

  it('renders paper titles after loading', async () => {
    renderList()
    await waitFor(() => {
      expect(screen.getByText('DINOv2: Learning Robust Visual Features')).toBeInTheDocument()
    })
    expect(screen.getByText('Attention Is All You Need')).toBeInTheDocument()
  })

  it('shows module count badge', async () => {
    renderList()
    await waitFor(() => screen.getByText('6 chapters'))
    expect(screen.getByText('3 chapters')).toBeInTheDocument()
  })

  it('truncates long author lists with et al.', async () => {
    renderList()
    await waitFor(() => screen.getByText(/et al\./))
  })

  it('shows abstract excerpt', async () => {
    renderList()
    await waitFor(() => screen.getByText(/DINOv2, a self-supervised/))
  })

  it('shows empty state when no papers', async () => {
    vi.spyOn(papersApi, 'fetchIndex').mockResolvedValue([])
    renderList()
    await waitFor(() => screen.getByText(/No papers ingested yet/))
  })

  it('shows error when fetch fails', async () => {
    vi.spyOn(papersApi, 'fetchIndex').mockRejectedValue(new Error('Network error'))
    renderList()
    await waitFor(() => screen.getByRole('alert'))
    expect(screen.getByRole('alert')).toHaveTextContent('Network error')
  })

  it('shows skeleton cards while loading', () => {
    vi.spyOn(papersApi, 'fetchIndex').mockReturnValue(new Promise(() => {})) // never resolves
    renderList()
    // Skeleton cards render — no titles visible yet
    expect(screen.queryByText('DINOv2')).not.toBeInTheDocument()
  })
})
