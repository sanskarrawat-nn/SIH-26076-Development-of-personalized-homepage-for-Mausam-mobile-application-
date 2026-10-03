#!/usr/bin/env python3
"""Check tracked source and submission bytes; never reject an ignored local .env."""

from __future__ import annotations

import hashlib
import re
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
# One-way fingerprints of previously exposed credentials, never plaintext.
KNOWN_SECRET_HASHES = {
    "fdfbc333dbcfaeda4dd3578ca4d05d83e80af7db8bd339a4ea5f26ad25ca1da2",
    "9b1dc8c1c09a45414c164be7e2d6103a60684fb3140b303eefd779a2fb53632e",
    "bb35df615a765240bb2afada5274e4929d5e58560950ce3a7cb38d314e29644c",
}
TOKEN = re.compile(rb"[A-Za-z0-9_-]{20,}")
PRIVATE_KEY = re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")
ASSIGNMENT = re.compile(
    r"(?im)^[ \t]*(?:[A-Z_]*(?:API_KEY|PASSWORD|SECRET|TOKEN))[ \t]*=[ \t]*([^\r\n#]+)"
)


def secret_errors(data: bytes, name: str) -> list[str]:
    errors = []
    if any(
        hashlib.sha256(m.group()).hexdigest() in KNOWN_SECRET_HASHES
        for m in TOKEN.finditer(data)
    ):
        errors.append(f"Known exposed credential in {name}")
    if PRIVATE_KEY.search(data):
        errors.append(f"Private key in {name}")
    if Path(name).name.startswith(".env"):
        for match in ASSIGNMENT.finditer(data.decode("utf-8", errors="replace")):
            value = match.group(1).strip().strip("\"'")
            if value and not any(
                marker in value.lower()
                for marker in ("your_", "replace", "placeholder", "example", "<")
            ):
                errors.append(f"Non-placeholder credential assignment in {name}")
    return errors


def check_source_hygiene() -> list[str]:
    from make_submission_zip import forbidden_path

    errors = []
    tracked = (
        subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT_DIR)
        .decode()
        .split("\0")
    )
    for name in filter(None, tracked):
        path = ROOT_DIR / name
        if not name.startswith("docs/qa/") and forbidden_path(Path(name)):
            errors.append(f"Forbidden tracked path: {name}")
        if path.is_file():
            errors.extend(secret_errors(path.read_bytes(), name))
    if not (ROOT_DIR / "backend/.env.example").is_file():
        errors.append("Missing backend/.env.example")
    required = [
        ".env",
        "backend/.env",
        ".venv/probe",
        "backend/.venv/probe",
        "node_modules/probe",
        "frontend/node_modules/probe",
        "backend/a.db",
        ".pytest_cache/probe",
        "__pycache__/probe",
        "frontend/dist/probe",
        "build/probe",
        "mausam-setu-submission.zip",
    ]
    for name in required:
        if (
            subprocess.run(
                ["git", "check-ignore", "--no-index", "-q", name],
                cwd=ROOT_DIR,
                check=False,
            ).returncode
            != 0
        ):
            errors.append(f"Path is not ignored: {name}")
    return errors


def check_zip_hygiene(zip_path: Path) -> list[str]:
    from make_submission_zip import forbidden_path

    errors = []
    with zipfile.ZipFile(zip_path) as archive:
        if archive.testzip():
            errors.append("ZIP CRC validation failed")
        for info in archive.infolist():
            path = Path(info.filename)
            if path.is_absolute() or ".." in path.parts or forbidden_path(path):
                errors.append(f"Forbidden ZIP path: {info.filename}")
            if not info.is_dir():
                errors.extend(secret_errors(archive.read(info), info.filename))
    return errors


def main() -> int:
    errors = check_source_hygiene()
    archive = ROOT_DIR / "mausam-setu-submission.zip"
    if archive.exists():
        errors.extend(check_zip_hygiene(archive))
    for error in errors:
        print(error, file=sys.stderr)
    print(
        f"Hygiene check: {len(errors)} error(s). Known-secret and path checks cannot prove absence of every possible credential."
    )
    return int(bool(errors))


if __name__ == "__main__":
    sys.exit(main())
