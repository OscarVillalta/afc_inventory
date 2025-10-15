# migrations/env.py

from __future__ import annotations
import os
import sys
from alembic import context
from sqlalchemy import engine_from_config, pool
from logging.config import fileConfig
from sqlalchemy import create_engine
from pathlib import Path

# ✅ Load .env from project root (afc_inventory/.env)
ROOT_DIR = Path(__file__).resolve().parents[2]  # migrations -> database -> project root
ENV_PATH = ROOT_DIR / ".env"
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

if ENV_PATH.exists():
    from dotenv import load_dotenv
    load_dotenv(ENV_PATH)
else:
    print(f"⚠️ WARNING: .env file not found at {ENV_PATH}")

# ---- Load config ----
config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

# ✅ Load DATABASE_URL from environment (not alembic.ini)
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL env var not set")

config.set_main_option("sqlalchemy.url", DATABASE_URL)

# ✅ Import Base directly from database package
from database.models import Supplier, Filter, Quantity
from database import Base
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
