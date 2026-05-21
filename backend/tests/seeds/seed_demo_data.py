"""Seed script for integration test environments.

Run directly: python -m tests.seeds.seed_demo_data
Or via: python backend/tests/seeds/seed_demo_data.py

Creates demo users and a sample project if they don't already exist.
"""

from __future__ import annotations

import asyncio
import os

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg://arcsphere:arcsphere@localhost:5433/arcsphere_test",
)


async def seed(session: AsyncSession) -> None:
    from sqlalchemy import text

    from app.security import hash_password

    pw_hash = hash_password("arcsphere-demo")

    await session.execute(
        text(
            """
            INSERT INTO users (sub, email, role, password_hash)
            VALUES
              (:s1, :e1, 'admin', :h),
              (:s2, :e2, 'viewer', :h)
            ON CONFLICT (email) DO NOTHING
            """
        ),
        {
            "s1": "demo@arcsphere3d.dev",
            "e1": "demo@arcsphere3d.dev",
            "s2": "other@arcsphere3d.dev",
            "e2": "other@arcsphere3d.dev",
            "h": pw_hash,
        },
    )
    await session.commit()
    print("Seed complete: demo users inserted (or already existed).")


async def main() -> None:
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        await seed(session)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
