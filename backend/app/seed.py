"""Manual database seeding entry point.

Run with:  uv run python -m app.seed

Applies migrations first (so the tables exist) and then inserts the default
accounts and categories if they are not present yet.
"""

from sqlmodel import Session

from app.core.db import engine, run_migrations
from app.services.seed import seed_initial_data


def main() -> None:
    run_migrations()
    with Session(engine) as session:
        created = seed_initial_data(session)
    print(
        f"Semilla aplicada: {created['accounts']} cuentas, " f"{created['categories']} categorías."
    )


if __name__ == "__main__":
    main()
