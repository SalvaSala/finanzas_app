"""Initial seed data: default accounts and categories/subcategories.

Idempotent: accounts and categories are only inserted when their table is empty,
so deleting a default later is not undone on the next startup. Category/account
names are user-facing, hence in Spanish; model/field names stay in English.
"""

from sqlmodel import Session

from app.models import Account, AccountType, Category, CategoryType
from app.repositories import account as account_repo
from app.repositories import category as category_repo

# (name, type)
DEFAULT_ACCOUNTS: list[tuple[str, AccountType]] = [
    ("Efectivo", AccountType.cash),
    ("Banco principal", AccountType.bank),
    ("Tarjeta de crédito", AccountType.card),
    ("Ahorros", AccountType.savings),
]

# (name, type, color, [subcategories])
DEFAULT_CATEGORIES: list[tuple[str, CategoryType, str, list[str]]] = [
    # Ingresos
    ("Nómina", CategoryType.income, "#16a34a", []),
    ("Ingresos extra", CategoryType.income, "#22c55e", ["Freelance", "Ventas"]),
    ("Inversiones", CategoryType.income, "#15803d", ["Dividendos", "Intereses"]),
    ("Otros ingresos", CategoryType.income, "#4ade80", []),
    # Gastos
    (
        "Vivienda",
        CategoryType.expense,
        "#ef4444",
        ["Alquiler/Hipoteca", "Luz", "Agua", "Gas", "Internet y teléfono", "Comunidad"],
    ),
    (
        "Alimentación",
        CategoryType.expense,
        "#f97316",
        ["Supermercado", "Restaurantes", "Café"],
    ),
    (
        "Transporte",
        CategoryType.expense,
        "#f59e0b",
        ["Combustible", "Transporte público", "Taxi y VTC", "Mantenimiento"],
    ),
    (
        "Ocio",
        CategoryType.expense,
        "#8b5cf6",
        ["Cine y teatro", "Suscripciones", "Viajes", "Deporte"],
    ),
    (
        "Salud",
        CategoryType.expense,
        "#ec4899",
        ["Farmacia", "Médico", "Seguro médico"],
    ),
    (
        "Compras",
        CategoryType.expense,
        "#06b6d4",
        ["Ropa", "Electrónica", "Hogar"],
    ),
    ("Educación", CategoryType.expense, "#3b82f6", ["Cursos", "Libros"]),
    ("Otros gastos", CategoryType.expense, "#6b7280", []),
]


def seed_initial_data(session: Session) -> dict[str, int]:
    """Insert default accounts and categories if they are not present yet.

    Returns the number of rows created per entity (0 when already seeded).
    """
    created = {"accounts": 0, "categories": 0}

    if not account_repo.exists(session):
        accounts = [Account(name=name, type=acc_type) for name, acc_type in DEFAULT_ACCOUNTS]
        account_repo.add_all(session, accounts)
        created["accounts"] = len(accounts)

    if not category_repo.exists(session):
        created["categories"] = _seed_categories(session)

    return created


def _seed_categories(session: Session) -> int:
    """Insert top-level categories first, then their subcategories."""
    parents = [
        Category(name=name, type=cat_type, color=color)
        for name, cat_type, color, _ in DEFAULT_CATEGORIES
    ]
    category_repo.add_all(session, parents)

    parent_id_by_name = {parent.name: parent.id for parent in parents}
    children = [
        Category(name=sub, type=cat_type, color=color, parent_id=parent_id_by_name[name])
        for name, cat_type, color, subs in DEFAULT_CATEGORIES
        for sub in subs
    ]
    category_repo.add_all(session, children)

    return len(parents) + len(children)
