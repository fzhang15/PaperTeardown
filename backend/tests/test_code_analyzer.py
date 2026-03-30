"""
Tests for CodeAnalyzer — derived from specs/03-code-analyzer.md acceptance criteria.
All Anthropic API calls are mocked; no real network calls are made.
"""
import hashlib
import json
from dataclasses import dataclass
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from analyzer.code_analyzer import (
    AnalysisResult,
    AnalyzedLoop,
    AnalyzedModule,
    CodeAnalyzer,
    LineAnnotation,
    CONCEPT_TAGS,
)
from parser.pytorch_parser import ModuleInfo, ParseResult, TrainingLoopInfo


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

VALID_TAGS = set(CONCEPT_TAGS)

def _make_module(name="Net", forward_source="    def forward(self, x):\n        return x\n",
                  forward_start=5, forward_end=6) -> ModuleInfo:
    return ModuleInfo(
        name=name,
        file_path="model.py",
        class_start_line=1,
        class_end_line=10,
        init_source="    def __init__(self): super().__init__()\n",
        forward_source=forward_source,
        forward_start_line=forward_start,
        forward_end_line=forward_end,
        other_methods=[],
    )


def _make_loop() -> TrainingLoopInfo:
    return TrainingLoopInfo(
        file_path="train.py",
        start_line=1,
        end_line=8,
        source="def train():\n    for b in loader:\n        optimizer.zero_grad()\n        loss.backward()\n        optimizer.step()\n",
        detected_patterns=["zero_grad", "backward", "step"],
    )


def _make_parse_result(modules=None, loops=None) -> ParseResult:
    return ParseResult(
        modules=modules or [],
        training_loops=loops or [],
        parse_errors=[],
    )


def _annotation_response(start: int, end: int, explanation: str, tag: str) -> dict:
    return {"start_line": start, "end_line": end, "explanation": explanation, "concept_tag": tag}


def _mock_claude_response(annotations: list[dict], overview: str = "An overview.") -> MagicMock:
    """Build a mock Anthropic message response with the expected JSON payload."""
    payload = json.dumps({"overview": overview, "annotations": annotations})
    msg = MagicMock()
    msg.content = [MagicMock(text=payload)]
    return msg


# ---------------------------------------------------------------------------
# Overview mode
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_overview_mode_returns_nonempty_overview(tmp_path):
    analyzer = CodeAnalyzer()
    pr = _make_parse_result(modules=[_make_module()])
    mock_resp = _mock_claude_response([], overview="This model applies a linear transform.")
    with patch.object(analyzer._client.messages, "create", return_value=mock_resp):
        result = await analyzer.analyze(pr, detail_level="overview", context=None)
    assert len(result.analyzed_modules) == 1
    assert result.analyzed_modules[0].overview != ""


@pytest.mark.asyncio
async def test_overview_mode_annotations_are_empty(tmp_path):
    analyzer = CodeAnalyzer()
    pr = _make_parse_result(modules=[_make_module()])
    mock_resp = _mock_claude_response([], overview="Overview text.")
    with patch.object(analyzer._client.messages, "create", return_value=mock_resp):
        result = await analyzer.analyze(pr, detail_level="overview", context=None)
    assert result.analyzed_modules[0].annotations == []


# ---------------------------------------------------------------------------
# Detailed mode — annotations
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_detailed_mode_returns_annotations(tmp_path):
    analyzer = CodeAnalyzer()
    pr = _make_parse_result(modules=[_make_module(forward_start=5, forward_end=6)])
    annotations = [_annotation_response(5, 6, "Returns input unchanged.", "linear")]
    mock_resp = _mock_claude_response(annotations, overview="Identity model.")
    with patch.object(analyzer._client.messages, "create", return_value=mock_resp):
        result = await analyzer.analyze(pr, detail_level="detailed", context=None)
    assert len(result.analyzed_modules[0].annotations) == 1


@pytest.mark.asyncio
async def test_annotations_have_correct_line_numbers(tmp_path):
    analyzer = CodeAnalyzer()
    forward_source = "    def forward(self, x):\n        x = self.fc(x)\n        return x\n"
    pr = _make_parse_result(modules=[_make_module(forward_source=forward_source, forward_start=10, forward_end=12)])
    annotations = [
        _annotation_response(10, 10, "Method signature.", "linear"),
        _annotation_response(11, 11, "Applies linear layer.", "linear"),
        _annotation_response(12, 12, "Returns result.", "linear"),
    ]
    mock_resp = _mock_claude_response(annotations)
    with patch.object(analyzer._client.messages, "create", return_value=mock_resp):
        result = await analyzer.analyze(pr, detail_level="detailed", context=None)
    ann = result.analyzed_modules[0].annotations
    assert ann[0].start_line == 10
    assert ann[1].start_line == 11
    assert ann[2].start_line == 12


# ---------------------------------------------------------------------------
# Concept tag taxonomy
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_concept_tag_from_fixed_taxonomy_passes_through(tmp_path):
    analyzer = CodeAnalyzer()
    pr = _make_parse_result(modules=[_make_module()])
    annotations = [_annotation_response(5, 6, "Attention layer.", "attention")]
    mock_resp = _mock_claude_response(annotations)
    with patch.object(analyzer._client.messages, "create", return_value=mock_resp):
        result = await analyzer.analyze(pr, detail_level="detailed", context=None)
    tag = result.analyzed_modules[0].annotations[0].concept_tag
    assert tag == "attention"
    assert tag in VALID_TAGS


@pytest.mark.asyncio
async def test_concept_tag_other_with_sublabel_is_valid(tmp_path):
    analyzer = CodeAnalyzer()
    pr = _make_parse_result(modules=[_make_module()])
    annotations = [_annotation_response(5, 6, "Custom masking op.", "other:custom_masking")]
    mock_resp = _mock_claude_response(annotations)
    with patch.object(analyzer._client.messages, "create", return_value=mock_resp):
        result = await analyzer.analyze(pr, detail_level="detailed", context=None)
    tag = result.analyzed_modules[0].annotations[0].concept_tag
    assert tag is not None
    assert tag.startswith("other")


@pytest.mark.asyncio
async def test_invalid_concept_tag_from_llm_is_coerced_to_other(tmp_path):
    """If the LLM returns a tag not in the taxonomy and not 'other:...', coerce to 'other'."""
    analyzer = CodeAnalyzer()
    pr = _make_parse_result(modules=[_make_module()])
    annotations = [_annotation_response(5, 6, "Something.", "made_up_tag")]
    mock_resp = _mock_claude_response(annotations)
    with patch.object(analyzer._client.messages, "create", return_value=mock_resp):
        result = await analyzer.analyze(pr, detail_level="detailed", context=None)
    tag = result.analyzed_modules[0].annotations[0].concept_tag
    assert tag == "other"


# ---------------------------------------------------------------------------
# Caching
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cache_prevents_duplicate_api_calls(tmp_path):
    analyzer = CodeAnalyzer()
    pr = _make_parse_result(modules=[_make_module()])
    mock_resp = _mock_claude_response([_annotation_response(5, 6, "Identity.", "linear")])
    with patch.object(analyzer._client.messages, "create", return_value=mock_resp) as mock_create:
        await analyzer.analyze(pr, detail_level="detailed", context=None)
        await analyzer.analyze(pr, detail_level="detailed", context=None)
    assert mock_create.call_count == 1  # second call served from cache


@pytest.mark.asyncio
async def test_different_detail_levels_have_separate_cache_entries(tmp_path):
    analyzer = CodeAnalyzer()
    pr = _make_parse_result(modules=[_make_module()])
    overview_resp = _mock_claude_response([], overview="Overview.")
    detailed_resp = _mock_claude_response([_annotation_response(5, 6, "Detail.", "linear")])
    responses = [overview_resp, detailed_resp]
    with patch.object(analyzer._client.messages, "create", side_effect=responses) as mock_create:
        await analyzer.analyze(pr, detail_level="overview", context=None)
        await analyzer.analyze(pr, detail_level="detailed", context=None)
    assert mock_create.call_count == 2


@pytest.mark.asyncio
async def test_cache_stats_returns_dict(tmp_path):
    analyzer = CodeAnalyzer()
    stats = analyzer.cache_stats()
    assert isinstance(stats, dict)
    assert "size" in stats


# ---------------------------------------------------------------------------
# Error handling — API errors
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_api_error_on_one_module_does_not_prevent_others(tmp_path):
    analyzer = CodeAnalyzer()
    modules = [
        _make_module("Good",     forward_source="    def forward(self, x):\n        return x\n"),
        _make_module("Bad",      forward_source="    def forward(self, x):\n        return x + 1\n"),
        _make_module("AlsoGood", forward_source="    def forward(self, x):\n        return x + 2\n"),
    ]
    pr = _make_parse_result(modules=modules)
    good_resp = _mock_claude_response([], overview="Fine.")

    call_count = 0
    def side_effect(**kwargs):
        nonlocal call_count
        call_count += 1
        if call_count in (2, 3):  # both attempts for "Bad" module fail
            raise Exception("API error")
        return good_resp

    with patch.object(analyzer._client.messages, "create", side_effect=side_effect):
        result = await analyzer.analyze(pr, detail_level="overview", context=None)

    assert len(result.analyzed_modules) == 3
    error_module = next(m for m in result.analyzed_modules if m.module_name == "Bad")
    assert error_module.error is not None


@pytest.mark.asyncio
async def test_api_error_retried_once(tmp_path):
    analyzer = CodeAnalyzer()
    pr = _make_parse_result(modules=[_make_module()])
    good_resp = _mock_claude_response([], overview="OK.")
    call_count = 0

    def side_effect(**kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise Exception("Transient error")
        return good_resp

    with patch.object(analyzer._client.messages, "create", side_effect=side_effect):
        result = await analyzer.analyze(pr, detail_level="overview", context=None)

    assert call_count == 2
    assert result.analyzed_modules[0].error is None


@pytest.mark.asyncio
async def test_empty_forward_source_skips_api_call(tmp_path):
    analyzer = CodeAnalyzer()
    module = _make_module(forward_source="", forward_start=0, forward_end=0)
    pr = _make_parse_result(modules=[module])
    with patch.object(analyzer._client.messages, "create") as mock_create:
        result = await analyzer.analyze(pr, detail_level="detailed", context=None)
    mock_create.assert_not_called()
    assert result.analyzed_modules[0].annotations == []


# ---------------------------------------------------------------------------
# Progress callback
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_on_progress_callback_called_per_module(tmp_path):
    analyzer = CodeAnalyzer()
    pr = _make_parse_result(modules=[_make_module("A"), _make_module("B")])
    mock_resp = _mock_claude_response([], overview="OK.")
    calls = []

    def on_progress(name, done, total):
        calls.append((name, done, total))

    with patch.object(analyzer._client.messages, "create", return_value=mock_resp):
        await analyzer.analyze(pr, detail_level="overview", context=None, on_progress=on_progress)

    assert len(calls) == 2
    assert calls[0][1] == 1 and calls[0][2] == 2
    assert calls[1][1] == 2 and calls[1][2] == 2


@pytest.mark.asyncio
async def test_on_progress_not_required(tmp_path):
    """Calling analyze without on_progress should not raise."""
    analyzer = CodeAnalyzer()
    pr = _make_parse_result(modules=[_make_module()])
    mock_resp = _mock_claude_response([], overview="OK.")
    with patch.object(analyzer._client.messages, "create", return_value=mock_resp):
        result = await analyzer.analyze(pr, detail_level="overview", context=None)
    assert result is not None


# ---------------------------------------------------------------------------
# Training loops
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_training_loops_analyzed(tmp_path):
    analyzer = CodeAnalyzer()
    pr = _make_parse_result(loops=[_make_loop()])
    mock_resp = _mock_claude_response([], overview="Standard training loop.")
    with patch.object(analyzer._client.messages, "create", return_value=mock_resp):
        result = await analyzer.analyze(pr, detail_level="overview", context=None)
    assert len(result.analyzed_loops) == 1
    assert result.analyzed_loops[0].overview != ""


# ---------------------------------------------------------------------------
# Context passed to LLM
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_context_string_included_in_prompt(tmp_path):
    analyzer = CodeAnalyzer()
    pr = _make_parse_result(modules=[_make_module()])
    mock_resp = _mock_claude_response([], overview="OK.")
    with patch.object(analyzer._client.messages, "create", return_value=mock_resp) as mock_create:
        await analyzer.analyze(pr, detail_level="overview", context="Attention Is All You Need")
    call_kwargs = mock_create.call_args
    prompt_text = str(call_kwargs)
    assert "Attention Is All You Need" in prompt_text
