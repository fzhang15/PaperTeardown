// --- Chapter-based narrative types (primary) ---

export interface CodeBlock {
  label: string
  source: string
  source_start_line: number
  file_path: string
  annotations: LineAnnotation[]
}

export interface Chapter {
  id: string
  title: string
  narrative: string          // Markdown-ish text explaining the concept
  code_blocks: CodeBlock[]   // Code snippets embedded in the narrative
}

export interface LineAnnotation {
  start_line: number
  end_line: number
  explanation: string
  concept_tag?: string | null
}

export interface AnalysisResult {
  chapters: Chapter[]
  summary: string
}

// --- Paper metadata types ---

export interface PaperIndexEntry {
  id: string
  title: string
  authors: string[]
  arxiv_url: string
  repo_url: string
  abstract: string
  chapter_count: number
  ingested_at: string
}

export interface PaperMeta extends PaperIndexEntry {
  introduction_excerpt: string
  pytorch_file_count: number
}
