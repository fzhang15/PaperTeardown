# Spec: Code Analyzer

**Status**: `implemented`
**ID**: 03-code-analyzer
**Created**: 2026-03-29
**Updated**: 2026-03-29

---

## Overview

Takes extracted PyTorch code blocks from the Parser and uses the Claude API to generate line-by-line (or block-by-block) explanations. Output is structured so the frontend can align explanation text with specific source lines.

## Goals

- Generate clear, technical explanations of `forward()` methods and training loops
- Produce line-anchored annotations so the UI can highlight code alongside explanations
- Cache results to avoid re-analyzing the same code on repeated requests
- Work for both beginner-friendly summaries and expert-level detail

## Non-Goals

- Generating modified or corrected code (read-only analysis)
- Running or validating the code
- Explaining non-PyTorch Python code

## Inputs & Outputs

**Input:**
- `parse_result: ParseResult` — output from spec 02
- `detail_level: "overview" | "detailed"` — controls explanation depth
- `context: str | None` — optional paper title or description to ground the explanation

**Output:**
```python
{
  "analyzed_modules": list[AnalyzedModule],
  "analyzed_loops": list[AnalyzedLoop],
  "summary": str  # high-level summary of what the codebase does
}
```

## Detailed Behavior

### Explanation Granularity

**Overview mode**: One paragraph per `forward()` method, one paragraph per training loop.

**Detailed mode**: Statement-anchored annotations. Pre-split the source into groups using AST statement boundaries, then group adjacent related statements (2-3 lines max) into annotation units. Ask the LLM to explain each group. This gives predictable line anchoring while letting the LLM determine logical grouping within bounds.

Each annotation includes:
- The line range it covers (start_line, end_line)
- An explanation string (1-3 sentences, plain English)
- Optional `concept_tag`: chosen from the fixed taxonomy below

### LLM Prompting Strategy

For each `forward()` method:
1. System prompt: establishes role as a PyTorch expert explaining code to a ML researcher
2. User prompt includes: the full source, file/class context, optional paper title
3. Request structured JSON output with the annotation schema

Use Claude's structured output / tool use to enforce the response format.

### Caching

- Cache key: `sha256(source_text + detail_level)`
- Store in an in-memory dict (upgrade to Redis later)
- Cache TTL: 24 hours
- Expose `cache_stats()` for monitoring

### Concept Tag Taxonomy

The LLM must choose `concept_tag` from this fixed list:

```
attention, convolution, normalization, activation, loss, optimizer,
embedding, pooling, residual, dropout, linear, data_loading, logging, other
```

If none of the above fit, use `"other"` and append a free-form sub-label separated by a colon (e.g. `"other:custom_masking"`).

### Rate Limiting / Batching

- Process modules sequentially to avoid API rate limits
- Accept an optional `on_progress` callback (`Callable[[str, int, int], None]`) invoked after each module completes with `(module_name, done_count, total_count)`
- The API server (spec 05) owns SSE streaming — it wraps the analyzer and emits events via the callback

### Error Cases

| Condition | Expected Behavior |
|-----------|-------------------|
| Claude API error | Retry once; if still failing, return `error` field on that module |
| Response doesn't match expected schema | Log warning, return raw text as single annotation |
| Empty source input | Return empty annotations, no API call |
| Cache hit | Return cached result immediately, skip API call |

## Interface / API Contract

```python
@dataclass
class LineAnnotation:
    start_line: int
    end_line: int
    explanation: str
    concept_tag: str | None

@dataclass
class AnalyzedModule:
    module_name: str
    file_path: str
    overview: str
    annotations: list[LineAnnotation]  # empty in overview mode

@dataclass
class AnalyzedLoop:
    file_path: str
    start_line: int
    overview: str
    annotations: list[LineAnnotation]

class CodeAnalyzer:
    async def analyze(
        self,
        parse_result: ParseResult,
        detail_level: str,
        context: str | None,
        on_progress: Callable[[str, int, int], None] | None = None,
    ) -> AnalysisResult: ...
    async def analyze_module(self, module: ModuleInfo, detail_level: str, context: str | None) -> AnalyzedModule: ...
    def cache_stats(self) -> dict: ...
```

## Acceptance Criteria

- [x] Generates non-empty explanations for a real `forward()` method
- [x] Detailed mode annotations are line-anchored (line numbers present and correct)
- [x] Cache prevents duplicate API calls for the same source
- [x] API errors on one module do not prevent other modules from being analyzed
- [x] `concept_tag` is always a value from the fixed taxonomy (or `"other:..."`)
- [x] `on_progress` callback is called after each module with correct counts

## Dependencies

- `anthropic` Python SDK
- Spec 02 (ParseResult, ModuleInfo, TrainingLoopInfo)
- `ANTHROPIC_API_KEY` env var must be set

## Decisions

- **Concept tags**: Fixed taxonomy with `"other:sub-label"` escape hatch (see taxonomy above)
- **Streaming**: `CodeAnalyzer` is a plain async coroutine with an `on_progress` callback; the API server owns SSE emission
- **Annotation granularity**: Pre-split by AST statement, group 2-3 adjacent related lines, LLM explains each group

## Open Questions

- Should the LLM identify which paper architecture this resembles (e.g. "this looks like a ViT")?
- Should we pass the paper PDF/abstract as context when available?
