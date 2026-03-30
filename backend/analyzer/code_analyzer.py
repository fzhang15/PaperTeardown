"""
CodeAnalyzer — spec 03-code-analyzer
Uses the Claude API to generate line-anchored explanations of PyTorch code.
"""
import ast
import hashlib
import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Callable, TYPE_CHECKING

import anthropic

if TYPE_CHECKING:
    from parser.pytorch_parser import ModuleInfo, ParseResult, TrainingLoopInfo

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Concept tag taxonomy
# ---------------------------------------------------------------------------

CONCEPT_TAGS: list[str] = [
    "attention", "convolution", "normalization", "activation", "loss",
    "optimizer", "embedding", "pooling", "residual", "dropout", "linear",
    "data_loading", "logging", "other",
]

_VALID_TAGS = set(CONCEPT_TAGS)


def _coerce_tag(tag: str | None) -> str | None:
    if tag is None:
        return None
    if tag in _VALID_TAGS:
        return tag
    if tag.startswith("other:"):
        return tag
    return "other"


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

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
    annotations: list[LineAnnotation] = field(default_factory=list)
    error: str | None = None


@dataclass
class AnalyzedLoop:
    file_path: str
    start_line: int
    overview: str
    annotations: list[LineAnnotation] = field(default_factory=list)
    error: str | None = None


@dataclass
class AnalysisResult:
    analyzed_modules: list[AnalyzedModule] = field(default_factory=list)
    analyzed_loops: list[AnalyzedLoop] = field(default_factory=list)
    summary: str = ""


# ---------------------------------------------------------------------------
# Statement grouping (for detailed mode)
# ---------------------------------------------------------------------------

def _group_statements(source: str, base_line: int) -> list[tuple[int, int]]:
    """
    Parse source into AST statements and group adjacent ones (max 3 lines per group).
    Returns list of (start_line, end_line) tuples using original file line numbers.
    Falls back to single group covering whole source if parsing fails.
    """
    try:
        tree = ast.parse(source)
    except SyntaxError:
        lines = source.splitlines()
        return [(base_line, base_line + len(lines) - 1)]

    # Collect (start, end) for each top-level statement, adjusted to file line numbers
    stmts: list[tuple[int, int]] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Module):
            continue
        for stmt in node.body:
            s = stmt.lineno + base_line - 1
            e = getattr(stmt, "end_lineno", stmt.lineno) + base_line - 1
            stmts.append((s, e))
        break

    if not stmts:
        lines = source.splitlines()
        return [(base_line, base_line + len(lines) - 1)]

    # Group into chunks of max 3 lines
    groups: list[tuple[int, int]] = []
    current_start, current_end = stmts[0]
    for s, e in stmts[1:]:
        if (e - current_start) < 3:
            current_end = e
        else:
            groups.append((current_start, current_end))
            current_start, current_end = s, e
    groups.append((current_start, current_end))
    return groups


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """\
You are a PyTorch expert explaining code to ML researchers.
Your explanations are precise, technical, and assume familiarity with deep learning concepts.
Always respond with valid JSON matching the requested schema exactly."""

_TAGS_LIST = ", ".join(CONCEPT_TAGS)


def _build_user_prompt(
    source: str,
    class_name: str,
    file_path: str,
    detail_level: str,
    context: str | None,
    groups: list[tuple[int, int]] | None,
) -> str:
    ctx_line = f"\nPaper/context: {context}" if context else ""
    header = f"File: {file_path}\nClass: {class_name}{ctx_line}\n\nSource:\n```python\n{source}\n```\n"

    if detail_level == "overview":
        return (
            header
            + "\nRespond with JSON: {\"overview\": \"<1-2 paragraph explanation>\", \"annotations\": []}"
        )

    groups_desc = ""
    if groups:
        groups_desc = "\nAnnotate exactly these line ranges (start_line, end_line):\n"
        groups_desc += "\n".join(f"  - lines {s}–{e}" for s, e in groups)

    return (
        header
        + groups_desc
        + f"""
Respond with JSON matching this schema exactly:
{{
  "overview": "<1-2 sentence summary>",
  "annotations": [
    {{
      "start_line": <int>,
      "end_line": <int>,
      "explanation": "<1-3 sentences>",
      "concept_tag": "<one of: {_TAGS_LIST}; or 'other:sub-label'>"
    }}
  ]
}}"""
    )


# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------

@dataclass
class _CacheEntry:
    result: dict
    created_at: float = field(default_factory=time.time)


class _Cache:
    TTL = 86400  # 24 hours

    def __init__(self):
        self._store: dict[str, _CacheEntry] = {}

    def _key(self, source: str, detail_level: str) -> str:
        return hashlib.sha256(f"{source}{detail_level}".encode()).hexdigest()

    def get(self, source: str, detail_level: str) -> dict | None:
        key = self._key(source, detail_level)
        entry = self._store.get(key)
        if entry and (time.time() - entry.created_at) < self.TTL:
            return entry.result
        return None

    def set(self, source: str, detail_level: str, result: dict) -> None:
        self._store[self._key(source, detail_level)] = _CacheEntry(result=result)

    def stats(self) -> dict:
        return {"size": len(self._store)}


# ---------------------------------------------------------------------------
# Core analyzer
# ---------------------------------------------------------------------------

class CodeAnalyzer:
    def __init__(self, api_key: str | None = None):
        self._client = anthropic.Anthropic(api_key=api_key or os.environ.get("ANTHROPIC_API_KEY"))
        self._cache = _Cache()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def analyze(
        self,
        parse_result: "ParseResult",
        detail_level: str,
        context: str | None,
        on_progress: Callable[[str, int, int], None] | None = None,
    ) -> AnalysisResult:
        result = AnalysisResult()
        total = len(parse_result.modules) + len(parse_result.training_loops)
        done = 0

        for module in parse_result.modules:
            analyzed = await self.analyze_module(module, detail_level, context)
            result.analyzed_modules.append(analyzed)
            done += 1
            if on_progress:
                on_progress(module.name, done, total)

        for loop in parse_result.training_loops:
            analyzed_loop = await self._analyze_loop(loop, detail_level, context)
            result.analyzed_loops.append(analyzed_loop)
            done += 1
            if on_progress:
                on_progress(f"training_loop:{loop.file_path}:{loop.start_line}", done, total)

        return result

    async def analyze_module(
        self,
        module: "ModuleInfo",
        detail_level: str,
        context: str | None,
    ) -> AnalyzedModule:
        source = module.forward_source
        if not source.strip():
            return AnalyzedModule(
                module_name=module.name,
                file_path=module.file_path,
                overview="",
                annotations=[],
            )

        groups = (
            _group_statements(source, module.forward_start_line)
            if detail_level == "detailed"
            else None
        )

        raw = await self._call_llm_with_retry(
            source=source,
            class_name=module.name,
            file_path=module.file_path,
            detail_level=detail_level,
            context=context,
            groups=groups,
        )

        if raw is None:
            return AnalyzedModule(
                module_name=module.name,
                file_path=module.file_path,
                overview="",
                annotations=[],
                error="LLM call failed after retry",
            )

        annotations = [
            LineAnnotation(
                start_line=a["start_line"],
                end_line=a["end_line"],
                explanation=a["explanation"],
                concept_tag=_coerce_tag(a.get("concept_tag")),
            )
            for a in raw.get("annotations", [])
        ]

        return AnalyzedModule(
            module_name=module.name,
            file_path=module.file_path,
            overview=raw.get("overview", ""),
            annotations=annotations,
        )

    def cache_stats(self) -> dict:
        return self._cache.stats()

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    async def _analyze_loop(
        self,
        loop: "TrainingLoopInfo",
        detail_level: str,
        context: str | None,
    ) -> AnalyzedLoop:
        source = loop.source
        groups = (
            _group_statements(source, loop.start_line)
            if detail_level == "detailed"
            else None
        )

        raw = await self._call_llm_with_retry(
            source=source,
            class_name="training_loop",
            file_path=loop.file_path,
            detail_level=detail_level,
            context=context,
            groups=groups,
        )

        if raw is None:
            return AnalyzedLoop(
                file_path=loop.file_path,
                start_line=loop.start_line,
                overview="",
                error="LLM call failed after retry",
            )

        annotations = [
            LineAnnotation(
                start_line=a["start_line"],
                end_line=a["end_line"],
                explanation=a["explanation"],
                concept_tag=_coerce_tag(a.get("concept_tag")),
            )
            for a in raw.get("annotations", [])
        ]

        return AnalyzedLoop(
            file_path=loop.file_path,
            start_line=loop.start_line,
            overview=raw.get("overview", ""),
            annotations=annotations,
        )

    async def _call_llm_with_retry(
        self,
        source: str,
        class_name: str,
        file_path: str,
        detail_level: str,
        context: str | None,
        groups: list[tuple[int, int]] | None,
    ) -> dict | None:
        cached = self._cache.get(source, detail_level)
        if cached is not None:
            return cached

        prompt = _build_user_prompt(source, class_name, file_path, detail_level, context, groups)

        for attempt in range(2):
            try:
                response = self._client.messages.create(
                    model="claude-sonnet-4-6",
                    max_tokens=4096,
                    system=_SYSTEM_PROMPT,
                    messages=[{"role": "user", "content": prompt}],
                )
                text = response.content[0].text
                raw = json.loads(text)
                self._cache.set(source, detail_level, raw)
                return raw
            except json.JSONDecodeError:
                # Wrap malformed response as a single annotation
                raw = {"overview": text, "annotations": []}
                self._cache.set(source, detail_level, raw)
                return raw
            except Exception as exc:
                logger.warning("LLM call attempt %d failed: %s", attempt + 1, exc)
                if attempt == 1:
                    return None

        return None
