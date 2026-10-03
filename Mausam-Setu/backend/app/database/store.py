"""Persist provider snapshots. User preferences remain on the device."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import JSON, DateTime, String, create_engine, delete
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from app.core.config import settings


def database_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


url = database_url(settings.database_url)
connection_options = {"check_same_thread": False} if url.startswith("sqlite") else {}
engine_kwargs: dict = {"connect_args": connection_options, "pool_pre_ping": True}
if url in ("sqlite://", "sqlite:///:memory:"):
    from sqlalchemy.pool import StaticPool

    engine_kwargs["poolclass"] = StaticPool
engine = create_engine(url, **engine_kwargs)
Session = sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class Snapshot(Base):
    __tablename__ = "weather_snapshots"

    key: Mapped[str] = mapped_column(String(160), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


def initialize() -> None:
    Base.metadata.create_all(engine)


def get_snapshot(key: str) -> dict | None:
    with Session() as session:
        snapshot = session.get(Snapshot, key)
        return snapshot.payload if snapshot is not None else None


def put_snapshot(key: str, payload: dict) -> None:
    timestamp = datetime.now(timezone.utc)
    insert = sqlite_insert if engine.dialect.name == "sqlite" else postgres_insert
    statement = insert(Snapshot).values(key=key, payload=payload, created_at=timestamp)
    statement = statement.on_conflict_do_update(
        index_elements=[Snapshot.key],
        set_={"payload": payload, "created_at": timestamp},
    )
    cutoff = timestamp - timedelta(seconds=settings.cache_max_seconds)
    with Session.begin() as session:
        session.execute(statement)
        session.execute(delete(Snapshot).where(Snapshot.created_at < cutoff))
