export interface LineAnnotation {
  start_line: number
  end_line: number
  explanation: string
  concept_tag?: string | null
}

export interface AnalyzedModule {
  module_name: string
  file_path: string
  overview: string
  annotations: LineAnnotation[]
  error?: string | null
}

export interface AnalyzedLoop {
  file_path: string
  start_line: number
  overview: string
  annotations: LineAnnotation[]
  error?: string | null
}

export interface AnalysisResult {
  analyzed_modules: AnalyzedModule[]
  analyzed_loops: AnalyzedLoop[]
  summary: string
}

export interface PaperIndexEntry {
  id: string
  title: string
  authors: string[]
  arxiv_url: string
  repo_url: string
  abstract: string
  module_count: number
  ingested_at: string
}

export interface PaperMeta extends PaperIndexEntry {
  introduction_excerpt: string
  pytorch_file_count: number
}
