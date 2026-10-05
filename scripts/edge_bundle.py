"""Collect local Edge Function dependencies while preserving import paths."""
from pathlib import Path
import re

FUNCTION_ROOT = Path(__file__).resolve().parent.parent / "supabase/functions"


def function_sources(slug):
    if not re.fullmatch(r"[a-z][a-z0-9-]*", slug):
        raise ValueError("Invalid Edge Function name.")
    pending = [FUNCTION_ROOT / slug / "index.ts"]
    sources = {}
    while pending:
        source = pending.pop().resolve()
        if source in sources:
            continue
        if not source.is_relative_to(FUNCTION_ROOT) or not source.is_file():
            raise ValueError("An Edge Function dependency is missing or outside its source tree.")
        content = source.read_bytes()
        sources[source] = content
        imports = re.findall(r'(?:from\s*|import\s*\(\s*|import\s*)[\'\"](\.[^\'\"]+)[\'\"]', content.decode())
        pending.extend(source.parent / path for path in imports)
    return sources
