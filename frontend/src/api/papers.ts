import type { AnalysisResult, PaperIndexEntry, PaperMeta } from '../types'

export async function fetchIndex(): Promise<PaperIndexEntry[]> {
  const res = await fetch('/data/papers/index.json')
  if (!res.ok) throw new Error(`Failed to load paper index (${res.status})`)
  return res.json()
}

export async function fetchPaper(id: string): Promise<{ meta: PaperMeta; analysis: AnalysisResult }> {
  const [metaRes, analysisRes] = await Promise.all([
    fetch(`/data/papers/${id}/meta.json`),
    fetch(`/data/papers/${id}/analysis.json`),
  ])
  if (!metaRes.ok) throw new Error(`Paper not found: ${id}`)
  if (!analysisRes.ok) throw new Error(`Analysis not available for: ${id}`)
  const [meta, analysis] = await Promise.all([metaRes.json(), analysisRes.json()])
  return { meta, analysis }
}
