#!/usr/bin/env python3
"""Enforce deliverable hygiene for Mausam Setu.

Verifies:
1. No secrets, .env files (except .env.example), or hardcoded API keys.
2. No local SQLite database files (mausam.db, *.db).
3. No dependency directories or build outputs in the archive or deliverable.
4. AI prompt/request files are archived in docs/archive/ and not polluting docs/.
5. .gitignore rules properly protect .env, databases, dependencies, and build outputs.
"""

from __future__ import annotations

import re
import sys
import zipfile
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent

LEAKED_SECRET_PATTERNS = [
    re.compile(r"a4fa3424-d2cb-48d5-8455-b09f93979819"),
    re.compile(r"tvvGfZ2Zol0PXhVHCWBwSBpemOsayzIM"),
    re.compile(r"579b464db66ec23bdd0000018a8cb664c5a941706ad45b7c4af24051"),
]

PROMPT_FILES_TO_ARCHIVE = [
    "BUILD-DIRECTIVE.txt",
    "PART1-REQUEST.txt",
    "PART2-REQUEST.txt",
    "PART3-REQUEST.txt",
    "PART3-UI-REQUEST.txt",
    "PART1-FILES-CHANGED.txt",
    "PART2-FILES-CHANGED.txt",
    "PART3-FILES-CHANGED.txt",
]


def check_source_hygiene() -> list[str]:
    errors: list[str] = []

    # 1. Check for forbidden .env files
    for env_file in ROOT_DIR.glob("**/.env*"):
        if ".venv" in env_file.parts or "venv" in env_file.parts or "node_modules" in env_file.parts:
            continue
        if env_file.name != ".env.example":
            errors.append(f"Forbidden env file found: {env_file.relative_to(ROOT_DIR)}")

    # 2. Check that .env.example exists and contains no actual secrets
    env_example = ROOT_DIR / "backend" / ".env.example"
    if not env_example.exists():
        errors.append("backend/.env.example is missing")
    else:
        text = env_example.read_text(encoding="utf-8")
        for key in ["WORLDTIDES_API_KEY", "TOMTOM_API_KEY", "CPCB_DATA_GOV_API_KEY", "COMMUNITY_REVIEW_TOKEN"]:
            match = re.search(rf"^{key}\s*=\s*(\S+)", text, re.MULTILINE)
            if match and match.group(1):
                errors.append(f"backend/.env.example has non-empty secret for {key}: {match.group(1)}")

    # 3. Check for local databases in tracked/working tree
    for db_file in ROOT_DIR.glob("**/*.db"):
        if ".venv" in db_file.parts or "venv" in db_file.parts or "node_modules" in db_file.parts:
            continue
        errors.append(f"Forbidden database file found: {db_file.relative_to(ROOT_DIR)}")

    # 4. Check that AI prompt/request files are moved to docs/archive/
    docs_dir = ROOT_DIR / "docs"
    for prompt_file in PROMPT_FILES_TO_ARCHIVE:
        unarchived = docs_dir / prompt_file
        if unarchived.exists():
            errors.append(f"AI prompt file must be moved to docs/archive/: docs/{prompt_file}")

        archived = docs_dir / "archive" / prompt_file
        if not archived.exists():
            errors.append(f"Archived file missing: docs/archive/{prompt_file}")

    # 5. Check .gitignore covers required patterns
    gitignore_file = ROOT_DIR / ".gitignore"
    if not gitignore_file.exists():
        errors.append(".gitignore file missing")
    else:
        gi_text = gitignore_file.read_text(encoding="utf-8")
        for expected in [".env", "node_modules", "dist", ".venv", "*.db", ".pytest_cache"]:
            if expected not in gi_text:
                errors.append(f".gitignore missing pattern for: {expected}")

    # 6. Check for leaked secret signatures in source files
    scan_exts = {".py", ".js", ".jsx", ".ts", ".tsx", ".json", ".md", ".html", ".sh", ".bat", ".yml", ".yaml"}
    for path in ROOT_DIR.glob("**/*"):
        if not path.is_file() or path.suffix not in scan_exts:
            continue
        if any(part in path.parts for part in [".venv", "venv", "node_modules", ".git", ".pytest_cache"]):
            continue
        if path.resolve() == Path(__file__).resolve():
            continue

        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        for pat in LEAKED_SECRET_PATTERNS:
            if pat.search(content):
                errors.append(f"Found known secret signature in {path.relative_to(ROOT_DIR)}")

    return errors


def check_zip_hygiene(zip_path: Path) -> list[str]:
    errors: list[str] = []
    if not zip_path.exists():
        return [f"Submission zip does not exist at {zip_path}"]

    size_mb = zip_path.stat().st_size / (1024 * 1024)
    print(f"Checking zip: {zip_path.name} ({size_mb:.2f} MB)...")

    forbidden_dirs = {".git", ".venv", "venv", "node_modules", "dist", ".pytest_cache", "__pycache__"}
    with zipfile.ZipFile(zip_path, "r") as zf:
        for info in zf.infolist():
            path_str = info.filename
            parts = path_str.split("/")

            for fd in forbidden_dirs:
                if fd in parts:
                    errors.append(f"Zip contains forbidden directory '{fd}': {path_str}")

            filename = parts[-1]
            if (filename.startswith(".env") or filename == ".env") and not filename.endswith(".example"):
                errors.append(f"Zip contains forbidden env file: {path_str}")

            if filename.endswith(".db") or filename == "mausam.db":
                errors.append(f"Zip contains forbidden database file: {path_str}")

            if filename.endswith((".pyc", ".pyo")):
                errors.append(f"Zip contains compiled bytecode: {path_str}")

    return errors


def main() -> int:
    print("Enforcing deliverable hygiene for Mausam Setu...")
    source_errors = check_source_hygiene()
    for err in source_errors:
        print(f"  [SOURCE ERROR] {err}", file=sys.stderr)

    zip_errors = []
    submission_zip = ROOT_DIR / "mausam-setu-submission.zip"
    if submission_zip.exists():
        zip_errors = check_zip_hygiene(submission_zip)
        for err in zip_errors:
            print(f"  [ZIP ERROR] {err}", file=sys.stderr)

    total_errors = len(source_errors) + len(zip_errors)
    if total_errors > 0:
        print(f"\nDeliverable hygiene check FAILED with {total_errors} error(s).", file=sys.stderr)
        return 1

    print("\nDeliverable hygiene check PASSED! Clean deliverable verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
