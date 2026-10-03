import os
from pathlib import Path
import pytest

# Ensure tests run against an in-memory database to prevent creating mausam.db on disk
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_database():
    yield
    # Ensure any sqlite db file accidentally created during test run is removed
    backend_dir = Path(__file__).resolve().parent.parent.parent
    db_file = backend_dir / "mausam.db"
    if db_file.exists():
        try:
            db_file.unlink()
        except OSError:
            pass
