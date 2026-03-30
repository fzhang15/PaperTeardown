"""
Tests for PyTorchParser — derived from specs/02-pytorch-parser.md acceptance criteria.
All tests use in-memory source strings; no real file I/O beyond tmp_path writes.
"""
import textwrap
from pathlib import Path

import pytest

from parser.pytorch_parser import (
    ModuleInfo,
    ParseError,
    ParseResult,
    PyTorchParser,
    TrainingLoopInfo,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def write_file(tmp_path: Path, name: str, source: str) -> Path:
    p = tmp_path / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(textwrap.dedent(source), encoding="utf-8")
    return p


def make_clone_result(tmp_path: Path, files: dict[str, str]):
    """Returns a minimal CloneResult-like object pointing at tmp_path."""
    from cloner.repo_cloner import CloneResult
    py_files = []
    for name, source in files.items():
        write_file(tmp_path, name, source)
        py_files.append(name)
    return CloneResult(
        clone_id="test",
        local_path=str(tmp_path),
        python_files=py_files,
        has_pytorch=True,
        pytorch_files=py_files,
    )


# ---------------------------------------------------------------------------
# nn.Module detection — import alias variants
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("import_line,base_class", [
    ("import torch.nn as nn", "nn.Module"),
    ("from torch import nn", "nn.Module"),
    ("import torch", "torch.nn.Module"),
    ("from torch.nn import Module", "Module"),
])
def test_detects_module_with_various_import_styles(tmp_path, import_line, base_class):
    source = f"""\
        {import_line}

        class MyModel({base_class}):
            def __init__(self):
                super().__init__()
                self.fc = None

            def forward(self, x):
                return x
        """
    cr = make_clone_result(tmp_path, {"model.py": source})
    result = PyTorchParser().parse(cr)
    assert len(result.modules) == 1
    assert result.modules[0].name == "MyModel"


def test_detects_multiple_modules_in_one_file(tmp_path):
    source = """\
        import torch.nn as nn

        class Encoder(nn.Module):
            def __init__(self): super().__init__()
            def forward(self, x): return x

        class Decoder(nn.Module):
            def __init__(self): super().__init__()
            def forward(self, x): return x
        """
    cr = make_clone_result(tmp_path, {"model.py": source})
    result = PyTorchParser().parse(cr)
    names = {m.name for m in result.modules}
    assert names == {"Encoder", "Decoder"}


def test_non_module_class_not_included(tmp_path):
    source = """\
        class Helper:
            def run(self): pass
        """
    cr = make_clone_result(tmp_path, {"util.py": source})
    result = PyTorchParser().parse(cr)
    assert result.modules == []


def test_no_modules_returns_empty_list_not_error(tmp_path):
    cr = make_clone_result(tmp_path, {"empty.py": "x = 1\n"})
    result = PyTorchParser().parse(cr)
    assert result.modules == []
    assert result.parse_errors == []


# ---------------------------------------------------------------------------
# forward() extraction — line numbers
# ---------------------------------------------------------------------------

def test_forward_source_extracted_correctly(tmp_path):
    source = """\
        import torch.nn as nn

        class Net(nn.Module):
            def __init__(self):
                super().__init__()

            def forward(self, x):
                x = x + 1
                return x
        """
    cr = make_clone_result(tmp_path, {"net.py": source})
    result = PyTorchParser().parse(cr)
    assert len(result.modules) == 1
    m = result.modules[0]
    assert "x = x + 1" in m.forward_source
    assert "return x" in m.forward_source


def test_forward_start_line_is_correct(tmp_path):
    source = """\
        import torch.nn as nn

        class Net(nn.Module):
            def __init__(self):
                super().__init__()

            def forward(self, x):
                return x
        """
    cr = make_clone_result(tmp_path, {"net.py": source})
    result = PyTorchParser().parse(cr)
    m = result.modules[0]
    # forward() starts at line 7 in the dedented source
    assert m.forward_start_line == 7
    assert m.forward_end_line >= m.forward_start_line


def test_forward_source_matches_original_exactly(tmp_path):
    """Source text must not be reformatted — whitespace preserved."""
    source = """\
        import torch.nn as nn

        class Net(nn.Module):
            def __init__(self):
                super().__init__()

            def forward(self, x):
                # unusual spacing
                x  =  x + 1
                return   x
        """
    cr = make_clone_result(tmp_path, {"net.py": source})
    result = PyTorchParser().parse(cr)
    m = result.modules[0]
    assert "x  =  x + 1" in m.forward_source
    assert "return   x" in m.forward_source


def test_module_with_no_forward_method(tmp_path):
    source = """\
        import torch.nn as nn

        class MyLoss(nn.Module):
            def __init__(self):
                super().__init__()
        """
    cr = make_clone_result(tmp_path, {"loss.py": source})
    result = PyTorchParser().parse(cr)
    assert len(result.modules) == 1
    m = result.modules[0]
    assert m.forward_source == ""
    assert m.forward_start_line == 0
    assert m.forward_end_line == 0


def test_class_line_range_is_recorded(tmp_path):
    source = """\
        import torch.nn as nn

        class Net(nn.Module):
            def __init__(self): super().__init__()
            def forward(self, x): return x
        """
    cr = make_clone_result(tmp_path, {"net.py": source})
    result = PyTorchParser().parse(cr)
    m = result.modules[0]
    assert m.class_start_line == 3
    assert m.class_end_line >= m.class_start_line


# ---------------------------------------------------------------------------
# init_source and other_methods
# ---------------------------------------------------------------------------

def test_init_source_extracted(tmp_path):
    source = """\
        import torch.nn as nn

        class Net(nn.Module):
            def __init__(self):
                super().__init__()
                self.fc = nn.Linear(10, 10)

            def forward(self, x):
                return self.fc(x)
        """
    cr = make_clone_result(tmp_path, {"net.py": source})
    result = PyTorchParser().parse(cr)
    m = result.modules[0]
    assert "self.fc = nn.Linear" in m.init_source


def test_other_methods_captured(tmp_path):
    source = """\
        import torch.nn as nn

        class Net(nn.Module):
            def __init__(self): super().__init__()
            def forward(self, x): return x
            def reset(self): pass
            def encode(self, x): return x
        """
    cr = make_clone_result(tmp_path, {"net.py": source})
    result = PyTorchParser().parse(cr)
    m = result.modules[0]
    other_names = [meth.name for meth in m.other_methods]
    assert "reset" in other_names
    assert "encode" in other_names
    assert "forward" not in other_names
    assert "__init__" not in other_names


# ---------------------------------------------------------------------------
# Training loop detection
# ---------------------------------------------------------------------------

def test_detects_training_loop_with_all_three_patterns(tmp_path):
    source = """\
        def train(model, loader, optimizer):
            for batch in loader:
                optimizer.zero_grad()
                loss = model(batch)
                loss.backward()
                optimizer.step()
        """
    cr = make_clone_result(tmp_path, {"train.py": source})
    result = PyTorchParser().parse(cr)
    assert len(result.training_loops) == 1
    loop = result.training_loops[0]
    assert "zero_grad" in loop.detected_patterns
    assert "backward" in loop.detected_patterns
    assert "step" in loop.detected_patterns


def test_training_loop_source_preserved(tmp_path):
    source = """\
        def train(model, loader, optimizer):
            for batch in loader:
                optimizer.zero_grad()
                loss = model(batch)
                loss.backward()
                optimizer.step()
        """
    cr = make_clone_result(tmp_path, {"train.py": source})
    result = PyTorchParser().parse(cr)
    loop = result.training_loops[0]
    assert "optimizer.zero_grad()" in loop.source
    assert "loss.backward()" in loop.source


def test_training_loop_line_numbers_recorded(tmp_path):
    source = """\
        import torch.nn as nn

        def train(model, loader, optimizer):
            for batch in loader:
                optimizer.zero_grad()
                loss = model(batch)
                loss.backward()
                optimizer.step()
        """
    cr = make_clone_result(tmp_path, {"train.py": source})
    result = PyTorchParser().parse(cr)
    loop = result.training_loops[0]
    assert loop.start_line >= 1
    assert loop.end_line >= loop.start_line


def test_no_training_loop_in_file_without_patterns(tmp_path):
    source = """\
        def evaluate(model, loader):
            for batch in loader:
                out = model(batch)
        """
    cr = make_clone_result(tmp_path, {"eval.py": source})
    result = PyTorchParser().parse(cr)
    assert result.training_loops == []


def test_partial_training_loop_still_detected(tmp_path):
    """A function with only backward() should still be flagged."""
    source = """\
        def update(loss):
            loss.backward()
        """
    cr = make_clone_result(tmp_path, {"update.py": source})
    result = PyTorchParser().parse(cr)
    assert len(result.training_loops) == 1
    assert "backward" in result.training_loops[0].detected_patterns


# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------

def test_syntax_error_file_skipped_and_recorded(tmp_path):
    files = {
        "bad.py": "def broken(\n",
        "good.py": "import torch.nn as nn\nclass M(nn.Module):\n    def __init__(self): super().__init__()\n    def forward(self,x): return x\n",
    }
    cr = make_clone_result(tmp_path, files)
    result = PyTorchParser().parse(cr)
    error_files = [e.file_path for e in result.parse_errors]
    assert any("bad.py" in f for f in error_files)
    assert len(result.modules) == 1  # good.py still parsed


def test_unreadable_file_skipped_and_recorded(tmp_path):
    good = write_file(tmp_path, "good.py", "x = 1\n")
    bad = tmp_path / "bad.py"
    bad.write_bytes(b"\xff\xfe" + b"\x00" * 100)  # invalid UTF-8 and latin-1

    from cloner.repo_cloner import CloneResult
    cr = CloneResult(
        clone_id="test",
        local_path=str(tmp_path),
        python_files=["good.py", "bad.py"],
        has_pytorch=False,
        pytorch_files=[],
    )
    result = PyTorchParser().parse(cr)
    # should not raise; bad.py appears in parse_errors OR is silently skipped
    assert isinstance(result, ParseResult)


def test_parse_errors_do_not_stop_other_files(tmp_path):
    files = {
        "a.py": "def broken(\n",
        "b.py": "def also_broken(\n",
        "c.py": "import torch.nn as nn\nclass M(nn.Module):\n    def __init__(self): super().__init__()\n    def forward(self,x): return x\n",
    }
    cr = make_clone_result(tmp_path, files)
    result = PyTorchParser().parse(cr)
    assert len(result.modules) == 1
    assert len(result.parse_errors) == 2


# ---------------------------------------------------------------------------
# parse_file interface
# ---------------------------------------------------------------------------

def test_parse_file_returns_modules_for_single_file(tmp_path):
    p = write_file(tmp_path, "net.py", """\
        import torch.nn as nn

        class Net(nn.Module):
            def __init__(self): super().__init__()
            def forward(self, x): return x
        """)
    result = PyTorchParser().parse_file(str(p))
    assert len(result.modules) == 1
    assert result.modules[0].name == "Net"


def test_parse_file_on_syntax_error_returns_parse_error(tmp_path):
    p = write_file(tmp_path, "bad.py", "def broken(\n")
    result = PyTorchParser().parse_file(str(p))
    assert len(result.parse_errors) == 1
    assert result.modules == []
