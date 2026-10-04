#!/usr/bin/env python3
"""Build a clean submission zip archive for Mausam Setu.

Excludes secrets, local databases, virtual environments, node_modules,
build outputs, and cache directories.
"""

from __future__ import annotations

import os
import sys
import zipfile
from pathlib import Path

# Root directory of the repository
ROOT_DIR = Path(__file__).resolve().parent.parent
OUTPUT_ZIP = ROOT_DIR / "mausam-setu-submission.zip"

FORBIDDEN_DIR_NAMES = {
    ".git",
    "build",
    ".ruff_cache",
    ".cache",
    ".mypy_cache",
    ".idea",
    ".vscode",
    "coverage",
    "tmp",
    "temp",
    ".venv",
    "venv",
    "node_modules",
    "dist",
    ".pytest_cache",
    "__pycache__",
    "playwright-report",
    "test-results",
}

FORBIDDEN_EXTENSIONS = {
    ".pyc",
    ".log",
    ".tmp",
    ".bak",
    ".sqlite",
    ".sqlite3",
    ".pyo",
    ".db",
    ".db-journal",
    ".db-wal",
    ".db-shm",
    ".zip",
}

FORBIDDEN_EXACT_FILES = {
    ".DS_Store",
    "Thumbs.db",
    "mausam.db",
}


def is_forbidden_file(file_path: Path) -> bool:
    name = file_path.name
    if name in FORBIDDEN_EXACT_FILES:
        return True
    if file_path.suffix in FORBIDDEN_EXTENSIONS:
        return True
    # Disallow any .env file except .env.example
    return name.startswith(".env") and name != ".env.example"


def forbidden_path(path: Path) -> bool:
    return (
        ("docs" in path.parts and "qa" in path.parts)
        or any(
            part in FORBIDDEN_DIR_NAMES or part.startswith((".venv", "venv"))
            for part in path.parts
        )
        or is_forbidden_file(path)
    )


def build_submission_zip(output_path: Path = OUTPUT_ZIP) -> Path:
    print(f"Creating submission zip at: {output_path}")

    # Remove existing zip if present
    if output_path.exists():
        output_path.unlink()

    included_count = 0
    total_uncompressed = 0

    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for root, dirs, files in os.walk(ROOT_DIR):
            root_path = Path(root)

            # Exclude forbidden directories in-place so os.walk doesn't descend into them
            dirs[:] = [
                d
                for d in dirs
                if not (root_path / d).is_symlink()
                and not (root_path == ROOT_DIR / "docs" and d == "qa")
                and d not in FORBIDDEN_DIR_NAMES
                and not d.startswith(".venv")
                and not d.startswith("venv")
            ]

            for file in files:
                file_path = root_path / file
                if file_path.is_symlink() or is_forbidden_file(file_path):
                    continue
                if file_path.resolve() == output_path.resolve():
                    continue

                rel_path = file_path.relative_to(ROOT_DIR)
                # Ensure archive paths use forward slash for cross-platform portability
                arcname = str(rel_path).replace("\\", "/")

                # Prefix inside zip with Mausam-Setu folder
                zip_arcname = f"Mausam-Setu/{arcname}"
                zf.write(file_path, zip_arcname)
                included_count += 1
                total_uncompressed += file_path.stat().st_size

    size_bytes = output_path.stat().st_size
    size_mb = size_bytes / (1024 * 1024)
    print(f"Successfully packaged {included_count} files.")
    print(f"Uncompressed size: {total_uncompressed / (1024 * 1024):.2f} MB")
    print(f"Zip archive size:  {size_mb:.2f} MB ({size_bytes} bytes)")

    # Run sanity checks on the generated archive
    verify_archive(output_path)
    return output_path


def verify_archive(zip_path: Path) -> None:
    from check_clean_deliverable import check_zip_hygiene

    errors = check_zip_hygiene(zip_path)
    if errors:
        zip_path.unlink(missing_ok=True)
        raise ValueError("; ".join(errors))
    print("Archive path, CRC and known-secret checks passed.")


if __name__ == "__main__":
    try:
        build_submission_zip()
    except (OSError, ValueError, zipfile.BadZipFile) as e:
        print(f"Error building submission zip: {e}", file=sys.stderr)
        sys.exit(1)
