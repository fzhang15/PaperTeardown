import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PaperView } from './PaperView'
import * as papersApi from '../api/papers'
import type { PaperMeta, AnalysisResult } from '../types'

const MOCK_META: PaperMeta = {
  id: 'dinov3',
  title: 'DINOv3: Multi-Scale Vision Transformers',
  authors: ['Mahmoud Assran', 'Quentin Duval'],
  arxiv_url: 'https://arxiv.org/abs/2508.10104',
  repo_url: 'https://github.com/facebookresearch/dinov3',
  abstract: 'We present DINOv3.',
  introduction_excerpt: 'Self-supervised learning...',
  chapter_count: 4,
  pytorch_file_count: 8,
  ingested_at: '2026-03-29T20:00:00Z',
}

const MOCK_ANALYSIS: AnalysisResult = {
  chapters: [
    {
      id: 'problem',
      title: 'What Problem Does DINOv3 Solve?',
      narrative: 'Standard ViTs process at one scale.',
      code_blocks: [],
    },
    {
      id: 'attention',
      title: 'Cross-Scale Attention',
      narrative: 'The core innovation.',
      code_blocks: [
        {
          label: 'Q/K/V projections',
          source: 'self.q_proj = nn.Linear(dim, dim)',
          source_start_line: 21,
          file_path: 'attention.py',
          annotations: [
            { start_line: 21, end_line: 21, explanation: 'Query projection.', concept_tag: 'attention' },
          ],
        },
      ],
    },
  ],
  summary: 'DINOv3 uses multi-scale attention.',
}

function renderView(id = 'dinov3') {
  return render(
    <MemoryRouter initialEntries={[`/paper/${id}`]}>
      <Routes>
        <Route path="/paper/:id" element={<PaperView />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('PaperView', () => {
  beforeEach(() => {
    vi.spyOn(papersApi, 'fetchPaper').mockResolvedValue({ meta: MOCK_META, analysis: MOCK_ANALYSIS })
  })

  it('renders paper title after loading', async () => {
    renderView()
    await waitFor(() => screen.getByText('DINOv3: Multi-Scale Vision Transformers'))
  })

  it('renders TL;DR summary', async () => {
    renderView()
    await waitFor(() => screen.getByText('DINOv3 uses multi-scale attention.'))
  })

  it('renders chapter titles in sidebar and content', async () => {
    renderView()
    await waitFor(() => screen.getAllByText('What Problem Does DINOv3 Solve?'))
    // Title appears in both sidebar nav and chapter heading
    expect(screen.getAllByText('What Problem Does DINOv3 Solve?')).toHaveLength(2)
    expect(screen.getAllByText('Cross-Scale Attention')).toHaveLength(2)
  })

  it('renders chapter narrative content', async () => {
    renderView()
    await waitFor(() => screen.getByText('Standard ViTs process at one scale.'))
    expect(screen.getByText('The core innovation.')).toBeInTheDocument()
  })

  it('renders code block with label', async () => {
    renderView()
    await waitFor(() => screen.getByText('Q/K/V projections'))
  })

  it('renders annotation explanation', async () => {
    renderView()
    await waitFor(() => screen.getByText('Query projection.'))
  })

  it('shows chapter count in header', async () => {
    renderView()
    await waitFor(() => screen.getByText('2 chapters'))
  })

  it('shows error when fetch fails', async () => {
    vi.spyOn(papersApi, 'fetchPaper').mockRejectedValue(new Error('Paper not found'))
    renderView('bad')
    await waitFor(() => screen.getByRole('alert'))
  })

  it('back button is rendered', async () => {
    renderView()
    await waitFor(() => screen.getByText('← Catalog'))
  })
})
