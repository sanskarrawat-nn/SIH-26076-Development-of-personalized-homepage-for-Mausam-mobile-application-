import os

# Tests always use an isolated database and never delete a developer database.
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
