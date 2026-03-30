import type { AnalysisResult, JobStatus } from '../types'

const BASE = '/api'

export async function startAnalysis(
  repoUrl: string,
  detailLevel: 'overview' | 'detailed' = 'overview',
  context?: string,
): Promise<string> {
  const res = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_url: repoUrl, detail_level: detailLevel, context }),
  })
  const body = await res.json()
  if (!res.ok || body.error) throw new Error(body.error ?? 'Failed to start analysis')
  return body.data.job_id as string
}

export async function getStatus(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${BASE}/status/${jobId}`)
  const body = await res.json()
  if (!res.ok || body.error) throw new Error(body.error ?? 'Failed to get status')
  return body.data as JobStatus
}

export async function getResult(jobId: string): Promise<AnalysisResult> {
  const res = await fetch(`${BASE}/result/${jobId}`)
  const body = await res.json()
  if (!res.ok || body.error) throw new Error(body.error ?? 'Failed to get result')
  return body.data as AnalysisResult
}

export async function deleteJob(jobId: string): Promise<void> {
  await fetch(`${BASE}/job/${jobId}`, { method: 'DELETE' })
}

export function openStatusStream(
  jobId: string,
  onProgress: (data: Record<string, unknown>) => void,
  onDone: (jobId: string) => void,
  onError: (msg: string) => void,
): EventSource {
  const es = new EventSource(`${BASE}/status/${jobId}`)
  es.addEventListener('progress', (e) => onProgress(JSON.parse(e.data)))
  es.addEventListener('done', (e) => { onDone(JSON.parse(e.data).job_id); es.close() })
  es.addEventListener('error', (e) => {
    const msg = (e as MessageEvent).data ? JSON.parse((e as MessageEvent).data).message : 'Stream error'
    onError(msg)
    es.close()
  })
  return es
}
