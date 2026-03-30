"""
PyTorchParser — spec 02-pytorch-parser
Extracts nn.Module classes, forward() methods, and training loops from Python source
using the stdlib ast module. Preserves original source text and line numbers.
"""
import ast
import textwrap
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from cloner.repo_cloner import CloneResult


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class MethodInfo:
    name: str
    start_line: int
    end_line: int
    source: str


@dataclass
class ModuleInfo:
    name: str
    file_path: str
    class_start_line: int
    class_end_line: int
    init_source: str
    forward_source: str
    forward_start_line: int
    forward_end_line: int
    other_methods: list[MethodInfo] = field(default_factory=list)


@dataclass
class TrainingLoopInfo:
    file_path: str
    start_line: int
    end_line: int
    source: str
    detected_patterns: list[str] = field(default_factory=list)


@dataclass
class ParseError:
    file_path: str
    error: str


@dataclass
class ParseResult:
    modules: list[ModuleInfo] = field(default_factory=list)
    training_loops: list[TrainingLoopInfo] = field(default_factory=list)
    parse_errors: list[ParseError] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Import alias resolution
# ---------------------------------------------------------------------------

def _collect_nn_aliases(tree: ast.Module) -> set[str]:
    """
    Return the set of names that refer to torch.nn.
    E.g. 'import torch.nn as nn' → {'nn'}
         'from torch import nn'  → {'nn'}
         'import torch'          → {'torch.nn'}  (handled separately via attr check)
    """
    aliases: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                # import torch.nn as nn  OR  import torch.nn (name = torch.nn)
                if alias.name == "torch.nn":
                    aliases.add(alias.asname if alias.asname else "torch.nn")
        elif isinstance(node, ast.ImportFrom):
            if node.module == "torch":
                for alias in node.names:
                    if alias.name == "nn":
                        aliases.add(alias.asname if alias.asname else "nn")
            elif node.module == "torch.nn":
                # from torch.nn import Module → Module is a direct base name
                for alias in node.names:
                    if alias.name == "Module":
                        aliases.add(alias.asname if alias.asname else "Module")
    return aliases


def _is_nn_module_base(base_node: ast.expr, nn_aliases: set[str]) -> bool:
    """Return True if a base class expression refers to nn.Module."""
    # nn.Module  /  torch.nn.Module
    if isinstance(base_node, ast.Attribute):
        if base_node.attr == "Module":
            value = base_node.value
            if isinstance(value, ast.Name) and value.id in nn_aliases:
                return True
            # torch.nn.Module
            if isinstance(value, ast.Attribute) and value.attr == "nn":
                if isinstance(value.value, ast.Name) and value.value.id == "torch":
                    return True
    # from torch.nn import Module → base is just Name("Module")
    if isinstance(base_node, ast.Name) and base_node.id in nn_aliases:
        return True
    return False


# ---------------------------------------------------------------------------
# Source extraction
# ---------------------------------------------------------------------------

def _extract_source(lines: list[str], start_line: int, end_line: int) -> str:
    """Extract lines [start_line, end_line] (1-indexed, inclusive)."""
    return "".join(lines[start_line - 1 : end_line])


def _node_end_line(node: ast.AST, fallback_end: int) -> int:
    return getattr(node, "end_lineno", fallback_end)


# ---------------------------------------------------------------------------
# Training loop detection
# ---------------------------------------------------------------------------

_TRAINING_CALL_PATTERNS = {
    "zero_grad": lambda n: (
        isinstance(n, ast.Call)
        and isinstance(n.func, ast.Attribute)
        and n.func.attr == "zero_grad"
    ),
    "backward": lambda n: (
        isinstance(n, ast.Call)
        and isinstance(n.func, ast.Attribute)
        and n.func.attr == "backward"
    ),
    "step": lambda n: (
        isinstance(n, ast.Call)
        and isinstance(n.func, ast.Attribute)
        and n.func.attr == "step"
        # avoid false positives: only count step() on objects (not e.g. range.step)
    ),
}


def _find_training_patterns(subtree: ast.AST) -> list[str]:
    found = []
    for name, pred in _TRAINING_CALL_PATTERNS.items():
        for node in ast.walk(subtree):
            if pred(node):
                found.append(name)
                break
    return found


def _extract_training_loops(
    tree: ast.Module, lines: list[str], file_path: str
) -> list[TrainingLoopInfo]:
    loops: list[TrainingLoopInfo] = []

    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        patterns = _find_training_patterns(node)
        if not patterns:
            continue
        start = node.lineno
        end = _node_end_line(node, len(lines))
        loops.append(TrainingLoopInfo(
            file_path=file_path,
            start_line=start,
            end_line=end,
            source=_extract_source(lines, start, end),
            detected_patterns=patterns,
        ))

    return loops


# ---------------------------------------------------------------------------
# Module extraction
# ---------------------------------------------------------------------------

def _extract_method(
    func_node: ast.FunctionDef | ast.AsyncFunctionDef, lines: list[str]
) -> MethodInfo:
    start = func_node.lineno
    end = _node_end_line(func_node, len(lines))
    return MethodInfo(
        name=func_node.name,
        start_line=start,
        end_line=end,
        source=_extract_source(lines, start, end),
    )


def _extract_modules(
    tree: ast.Module, lines: list[str], file_path: str, nn_aliases: set[str]
) -> list[ModuleInfo]:
    modules: list[ModuleInfo] = []

    for node in ast.walk(tree):
        if not isinstance(node, ast.ClassDef):
            continue
        if not any(_is_nn_module_base(b, nn_aliases) for b in node.bases):
            continue

        class_start = node.lineno
        class_end = _node_end_line(node, len(lines))

        init_source = ""
        forward_source = ""
        forward_start = 0
        forward_end = 0
        other_methods: list[MethodInfo] = []

        for item in node.body:
            if not isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            if item.name == "__init__":
                init_source = _extract_source(
                    lines, item.lineno, _node_end_line(item, len(lines))
                )
            elif item.name == "forward":
                forward_start = item.lineno
                forward_end = _node_end_line(item, len(lines))
                forward_source = _extract_source(lines, forward_start, forward_end)
            else:
                other_methods.append(_extract_method(item, lines))

        modules.append(ModuleInfo(
            name=node.name,
            file_path=file_path,
            class_start_line=class_start,
            class_end_line=class_end,
            init_source=init_source,
            forward_source=forward_source,
            forward_start_line=forward_start,
            forward_end_line=forward_end,
            other_methods=other_methods,
        ))

    return modules


# ---------------------------------------------------------------------------
# File parsing
# ---------------------------------------------------------------------------

def _read_source(file_path: str) -> str | None:
    """Try UTF-8 then latin-1; return None on failure."""
    path = Path(file_path)
    for enc in ("utf-8", "latin-1"):
        try:
            return path.read_text(encoding=enc)
        except UnicodeDecodeError:
            continue
        except OSError:
            return None
    return None


def _parse_source(
    source: str, file_path: str, rel_path: str
) -> tuple[list[ModuleInfo], list[TrainingLoopInfo], list[ParseError]]:
    try:
        tree = ast.parse(source, filename=file_path)
    except SyntaxError as exc:
        return [], [], [ParseError(file_path=rel_path, error=str(exc))]

    lines = source.splitlines(keepends=True)
    nn_aliases = _collect_nn_aliases(tree)
    modules = _extract_modules(tree, lines, rel_path, nn_aliases)
    loops = _extract_training_loops(tree, lines, rel_path)
    return modules, loops, []


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

class PyTorchParser:
    def parse(self, clone_result: "CloneResult", files: list[str] | None = None) -> ParseResult:
        target_files = files if files is not None else clone_result.python_files
        result = ParseResult()
        root = Path(clone_result.local_path)

        for rel in target_files:
            abs_path = str(root / rel)
            source = _read_source(abs_path)
            if source is None:
                result.parse_errors.append(
                    ParseError(file_path=rel, error="Could not read file")
                )
                continue
            modules, loops, errors = _parse_source(source, abs_path, rel)
            result.modules.extend(modules)
            result.training_loops.extend(loops)
            result.parse_errors.extend(errors)

        return result

    def parse_file(self, file_path: str) -> ParseResult:
        result = ParseResult()
        source = _read_source(file_path)
        if source is None:
            result.parse_errors.append(
                ParseError(file_path=file_path, error="Could not read file")
            )
            return result
        modules, loops, errors = _parse_source(source, file_path, file_path)
        result.modules.extend(modules)
        result.training_loops.extend(loops)
        result.parse_errors.extend(errors)
        return result
