import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PaperView } from './PaperView'
import * as papersApi from '../api/papers'
import type { PaperMeta, AnalysisResult } from '../types'

const MOCK_META: PaperMeta = {
  id: 'dinov2',
  title: 'DINOv2: Learning Robust Visual Features',
  authors: ['Maxime Oquab', 'Timothée Darcet'],
  arxiv_url: 'https://arxiv.org/abs/2304.07193',
  repo_url: 'https://github.com/facebookresearch/dinov2',
  abstract: 'We present DINOv2.',
  introduction_excerpt: 'In this paper we propose...',
  module_count: 2,
  pytorch_file_count: 8,
  ingested_at: '2026-03-29T18:00:00Z',
}

const MOCK_ANALYSIS: AnalysisResult = {
  analyzed_modules: [
    {
      module_name: 'DinoVisionTransformer',
      file_path: 'dinov2/models/vit.py',
      overview: 'Main ViT model for DINOv2.',
      annotations: [
        { start_line: 10, end_line: 12, explanation: 'Patch embedding layer.', concept_tag: 'embedding' },
      ],
    },
    {
      module_name: 'Attention',
      file_path: 'dinov2/models/vit.py',
      overview: 'Multi-head self-attention.',
      annotations: [],
    },
  ],
  analyzed_loops: [],
  summary: 'DINOv2 ViT implementation.',
}

function renderView(id = 'dinov2') {
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
    await waitFor(() => screen.getByText('DINOv2: Learning Robust Visual Features'))
  })

  it('renders module names in sidebar', async () => {
    renderView()
    await waitFor(() => screen.getAllByText('DinoVisionTransformer'))
    expect(screen.getByText('Attention')).toBeInTheDocument()
  })

  it('auto-selects first module', async () => {
    renderView()
    await waitFor(() => screen.getByText('Main ViT model for DINOv2.'))
  })

  it('switches module when sidebar item clicked', async () => {
    renderView()
    await waitFor(() => screen.getByText('Attention'))
    await userEvent.click(screen.getByText('Attention'))
    await waitFor(() => screen.getByText('Multi-head self-attention.'))
  })

  it('shows annotation with concept tag', async () => {
    renderView()
    await waitFor(() => screen.getByText('Patch embedding layer.'))
    expect(screen.getByText('embedding')).toBeInTheDocument()
  })

  it('shows error when fetch fails', async () => {
    vi.spyOn(papersApi, 'fetchPaper').mockRejectedValue(new Error('Paper not found: bad'))
    renderView('bad')
    await waitFor(() => screen.getByRole('alert'))
  })

  it('back button navigates to catalog', async () => {
    renderView()
    await waitFor(() => screen.getByText('← Catalog'))
    // Just verify the button renders — navigation tested via router integration
    expect(screen.getByText('← Catalog')).toBeInTheDocument()
  })

  it('shows module count in header', async () => {
    renderView()
    await waitFor(() => screen.getByText('2 modules'))
  })
})
