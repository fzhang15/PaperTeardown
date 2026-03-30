"""
Entry point: python -m ingest --spec specs/papers/dinov2.md
             python -m ingest --id dinov2 --arxiv URL --repo URL
"""
import argparse
import asyncio
import sys
from pathlib import Path

import yaml

from ingest.pipeline import IngestConfig, IngestPipeline


def _parse_spec(spec_path: str) -> IngestConfig:
    text = Path(spec_path).read_text(encoding="utf-8")
    # Extract YAML frontmatter between --- markers
    if not text.startswith("---"):
        raise ValueError(f"Spec file {spec_path!r} has no YAML frontmatter")
    end = text.index("---", 3)
    fm = yaml.safe_load(text[3:end])
    required = ("id", "arxiv", "repo")
    for key in required:
        if key not in fm:
            raise ValueError(f"Spec frontmatter missing required key: {key!r}")
    return IngestConfig(
        id=fm["id"],
        arxiv_url=fm["arxiv"],
        repo_url=fm["repo"],
        detail_level=fm.get("detail_level", "detailed"),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest a PyTorch paper into PaperTeardown")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--spec", metavar="PATH", help="Path to a paper spec .md file")
    group.add_argument("--id", metavar="ID", help="Paper ID (used with --arxiv and --repo)")

    parser.add_argument("--arxiv", metavar="URL", help="arXiv abstract URL")
    parser.add_argument("--repo", metavar="URL", help="GitHub repo URL")
    parser.add_argument("--detail", default="detailed", choices=["overview", "detailed"],
                        dest="detail_level")
    parser.add_argument("--force", action="store_true", help="Overwrite existing output")

    args = parser.parse_args()

    if args.spec:
        try:
            config = _parse_spec(args.spec)
        except Exception as exc:
            print(f"Error reading spec: {exc}", file=sys.stderr)
            sys.exit(1)
        config.force = args.force
    else:
        if not args.arxiv or not args.repo:
            parser.error("--id requires --arxiv and --repo")
        config = IngestConfig(
            id=args.id,
            arxiv_url=args.arxiv,
            repo_url=args.repo,
            detail_level=args.detail_level,
            force=args.force,
        )

    asyncio.run(IngestPipeline().run(config))


if __name__ == "__main__":
    main()
