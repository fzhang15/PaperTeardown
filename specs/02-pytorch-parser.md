# Spec: PyTorch Parser

**Status**: `implemented`
**ID**: 02-pytorch-parser
**Created**: 2026-03-29
**Updated**: 2026-03-29

---

## Overview

Takes the list of Python files from the Repo Cloner and uses Python's `ast` module to extract meaningful PyTorch constructs: `nn.Module` subclasses, `forward()` methods, and training loop patterns. Produces structured code blocks with source line numbers preserved.

## Goals

- Extract all `nn.Module` subclasses and their architecture
- Extract `forward()` method bodies with full source context
- Detect training loops (optimizer step, loss backward patterns)
- Preserve original file path and line numbers for UI highlighting

## Non-Goals

- Executing or running any extracted code
- Handling `.ipynb` notebooks in this spec (deferred to a future spec)
- Resolving cross-file imports or inheritance chains across files (deferred)

## Inputs & Outputs

**Input:**
- `clone_result: CloneResult` — output from spec 01
- `files: list[str]` — subset of `python_files` to parse (defaults to all)

**Output:**
```python
{
  "modules": list[ModuleInfo],
  "training_loops": list[TrainingLoopInfo],
  "parse_errors": list[ParseError]
}
```

## Detailed Behavior

### nn.Module Extraction

1. Walk the AST of each file
2. Identify `class Foo(nn.Module)` or `class Foo(torch.nn.Module)` patterns
3. For each class, extract:
   - Class name and line range
   - `__init__` body (layer definitions)
   - `forward()` method body
   - Any other methods defined on the class
4. Record the source file path and start/end line numbers

### forward() Method Extraction

1. Within each detected Module class, extract the full `forward()` source
2. Also detect standalone `forward` functions not inside a class (less common, still capture)
3. Annotate each line with its original line number

### Training Loop Detection

Detect patterns that indicate a training loop:

- Calls to `optimizer.zero_grad()`
- Calls to `loss.backward()` or `<var>.backward()`
- Calls to `optimizer.step()`
- A `for` loop containing any of the above

Capture the entire enclosing function or loop block.

### Source Extraction

Use `ast.get_source_segment()` or `inspect`-style line slicing to get the exact source text for each extracted block. Do not reconstruct from AST — preserve original formatting.

### Error Cases

| Condition | Expected Behavior |
|-----------|-------------------|
| Syntax error in `.py` file | Record in `parse_errors`, skip file, continue |
| File not readable | Record in `parse_errors`, skip file, continue |
| No modules found | Return empty `modules` list, not an error |
| Encoding issue (non-UTF8) | Try `latin-1` fallback; if still fails, record as parse error |

## Interface / API Contract

```python
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
    other_methods: list[MethodInfo]

@dataclass
class TrainingLoopInfo:
    file_path: str
    start_line: int
    end_line: int
    source: str
    detected_patterns: list[str]  # e.g. ["zero_grad", "backward", "step"]

@dataclass
class ParseError:
    file_path: str
    error: str

class PyTorchParser:
    def parse(self, clone_result: CloneResult) -> ParseResult: ...
    def parse_file(self, file_path: str) -> FileParsResult: ...
```

## Acceptance Criteria

- [x] Detects `nn.Module` subclasses including aliased imports (`from torch import nn`)
- [x] Extracts `forward()` source with correct start/end line numbers
- [x] Detects training loops containing `zero_grad`, `backward`, `step`
- [x] Syntax errors in individual files do not crash the parser
- [x] Source text matches original file exactly (no reformatting)
- [ ] Works on at least 3 real-world PyTorch repos (validation) — deferred to integration testing

## Dependencies

- `ast` (stdlib)
- `pathlib` (stdlib)
- Spec 01 (CloneResult)

## Open Questions

- Should we recurse into inherited `forward()` from parent class?
- How deep should we go for nested modules (modules that contain other modules)?
- Should training loop detection cover PyTorch Lightning's `training_step()`?
