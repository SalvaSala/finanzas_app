#!/usr/bin/env python3
"""
Genera una base de datos example.db con datos ficticios para demostración.
Ejecutar desde la raíz del proyecto:
    uv run --project backend python scripts/create_example_db.py
"""

import os
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

_backend = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(_backend))

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "example.db"

# El esquema se crea aplicando las migraciones de Alembic (`run_migrations`), no con
# `SQLModel.metadata.create_all`. Motivo: `create_all` deja la BD SIN la tabla
# `alembic_version` sellada, así que al copiar esta BD a la carpeta de datos del
# usuario la app intenta aplicar la migración inicial sobre un esquema que ya existe
# y muere con "table accounts already exists". Aplicando las migraciones, la BD de
# demo nace exactamente igual que la de la app real y queda sellada en head.
#
# `alembic/env.py` fija la URL desde `get_settings()`, así que la única manera de
# apuntar las migraciones a example.db es la variable de entorno FINAPP_DATABASE_URL,
# y hay que definirla ANTES de importar nada de `app` (los settings se cachean con
# `lru_cache` y el engine de `app.core.db` se crea al importar el módulo).
os.environ["FINAPP_DATABASE_URL"] = f"sqlite:///{DB_PATH}"

if DB_PATH.exists():
    DB_PATH.unlink()

from sqlalchemy import text  # noqa: E402
from sqlmodel import Session  # noqa: E402

from app.core.db import engine, run_migrations  # noqa: E402
from app.models import (  # noqa: E402
    Account, AccountType,
    Category, CategoryType,
    Transaction, TransactionType,
    Tag,
    Budget, BudgetPeriod,
    SavingsGoal,
    CategorizationRule,
)


def seed(session: Session) -> None:
    # ── Accounts ──────────────────────────────────────────────
    efectivo = Account(name="Efectivo", type=AccountType.cash, currency="EUR", initial_balance=Decimal("350.00"))
    banco = Account(name="Banco principal", type=AccountType.bank, currency="EUR", initial_balance=Decimal("4200.00"))
    tarjeta = Account(name="Tarjeta de crédito", type=AccountType.card, currency="EUR", initial_balance=Decimal("0.00"))
    ahorros = Account(name="Ahorros", type=AccountType.savings, currency="EUR", initial_balance=Decimal("8500.00"))
    session.add_all([efectivo, banco, tarjeta, ahorros])
    session.flush()

    # ── Categories ────────────────────────────────────────────
    cats: dict[str, Category] = {}

    def _cat(name: str, ctype: CategoryType, color: str, parent: Category | None = None) -> Category:
        c = Category(name=name, type=ctype, color=color, parent_id=parent.id if parent else None)
        session.add(c)
        session.flush()
        cats[name] = c
        return c

    _cat("Nómina", CategoryType.income, "#16a34a")
    ing_extra = _cat("Ingresos extra", CategoryType.income, "#22c55e")
    _cat("Freelance", CategoryType.income, "#4ade80", parent=ing_extra)
    _cat("Ventas", CategoryType.income, "#86efac", parent=ing_extra)

    inv = _cat("Inversiones", CategoryType.income, "#15803d")
    _cat("Dividendos", CategoryType.income, "#22c55e", parent=inv)
    _cat("Intereses", CategoryType.income, "#4ade80", parent=inv)

    vivienda = _cat("Vivienda", CategoryType.expense, "#ef4444")
    _cat("Alquiler/Hipoteca", CategoryType.expense, "#fca5a5", parent=vivienda)
    _cat("Luz", CategoryType.expense, "#f87171", parent=vivienda)
    _cat("Agua", CategoryType.expense, "#b91c1c", parent=vivienda)
    _cat("Gas", CategoryType.expense, "#dc2626", parent=vivienda)
    _cat("Internet y teléfono", CategoryType.expense, "#ef4444", parent=vivienda)

    alim = _cat("Alimentación", CategoryType.expense, "#f97316")
    _cat("Supermercado", CategoryType.expense, "#fb923c", parent=alim)
    _cat("Restaurantes", CategoryType.expense, "#fdba74", parent=alim)
    _cat("Café", CategoryType.expense, "#fed7aa", parent=alim)

    trans = _cat("Transporte", CategoryType.expense, "#f59e0b")
    _cat("Combustible", CategoryType.expense, "#fbbf24", parent=trans)
    _cat("Transporte público", CategoryType.expense, "#fcd34d", parent=trans)
    _cat("Taxi y VTC", CategoryType.expense, "#fde68a", parent=trans)

    ocio = _cat("Ocio", CategoryType.expense, "#8b5cf6")
    _cat("Suscripciones", CategoryType.expense, "#a78bfa", parent=ocio)
    _cat("Cine y teatro", CategoryType.expense, "#c4b5fd", parent=ocio)
    _cat("Viajes", CategoryType.expense, "#ddd6fe", parent=ocio)
    _cat("Deporte", CategoryType.expense, "#7c3aed", parent=ocio)

    salud = _cat("Salud", CategoryType.expense, "#ec4899")
    _cat("Farmacia", CategoryType.expense, "#f9a8d4", parent=salud)
    _cat("Médico", CategoryType.expense, "#f472b6", parent=salud)

    compras = _cat("Compras", CategoryType.expense, "#06b6d4")
    _cat("Ropa", CategoryType.expense, "#22d3ee", parent=compras)
    _cat("Electrónica", CategoryType.expense, "#67e8f9", parent=compras)
    _cat("Hogar", CategoryType.expense, "#a5f3fc", parent=compras)

    edu = _cat("Educación", CategoryType.expense, "#3b82f6")
    _cat("Cursos", CategoryType.expense, "#60a5fa", parent=edu)
    _cat("Libros", CategoryType.expense, "#93c5fd", parent=edu)

    _cat("Otros gastos", CategoryType.expense, "#6b7280")

    # ── Tags ──────────────────────────────────────────────────
    tag_urgente = Tag(name="Urgente", color="#ef4444")
    tag_fijo = Tag(name="Gasto fijo", color="#6b7280")
    tag_ocasional = Tag(name="Ocasional", color="#8b5cf6")
    tag_personal = Tag(name="Personal", color="#3b82f6")
    session.add_all([tag_urgente, tag_fijo, tag_ocasional, tag_personal])
    session.flush()

    # ── Transactions (junio 2026) ─────────────────────────────
    tx_data = [
        dict(date=date(2026, 6, 1), type=TransactionType.income, concept="Nómina junio", description=None, amount=Decimal("2450.00"), category="Nómina", account=banco.id, transfer=None, tags=[tag_fijo]),
        dict(date=date(2026, 6, 1), type=TransactionType.expense, concept="Alquiler junio", description="Piso centro ciudad", amount=Decimal("850.00"), category="Alquiler/Hipoteca", account=tarjeta.id, transfer=None, tags=[tag_fijo, tag_urgente]),
        dict(date=date(2026, 6, 3), type=TransactionType.expense, concept="Factura luz", description="Endesa", amount=Decimal("62.34"), category="Luz", account=tarjeta.id, transfer=None, tags=[tag_fijo]),
        dict(date=date(2026, 6, 3), type=TransactionType.expense, concept="Factura agua", description="Emasesa", amount=Decimal("28.50"), category="Agua", account=tarjeta.id, transfer=None, tags=[tag_fijo]),
        dict(date=date(2026, 6, 3), type=TransactionType.expense, concept="Factura gas", description="Naturgy", amount=Decimal("45.20"), category="Gas", account=tarjeta.id, transfer=None, tags=[tag_fijo]),
        dict(date=date(2026, 6, 5), type=TransactionType.expense, concept="Internet y móvil", description="Orange — fibra + móvil", amount=Decimal("59.00"), category="Internet y teléfono", account=tarjeta.id, transfer=None, tags=[tag_fijo]),
        dict(date=date(2026, 6, 2), type=TransactionType.expense, concept="Compra semanal", description="Mercadona", amount=Decimal("87.45"), category="Supermercado", account=tarjeta.id, transfer=None, tags=[]),
        dict(date=date(2026, 6, 9), type=TransactionType.expense, concept="Compra semanal", description="Carrefour", amount=Decimal("72.30"), category="Supermercado", account=tarjeta.id, transfer=None, tags=[]),
        dict(date=date(2026, 6, 16), type=TransactionType.expense, concept="Compra semanal", description="Mercadona", amount=Decimal("65.80"), category="Supermercado", account=tarjeta.id, transfer=None, tags=[]),
        dict(date=date(2026, 6, 23), type=TransactionType.expense, concept="Compra semanal", description="Lidl", amount=Decimal("54.20"), category="Supermercado", account=tarjeta.id, transfer=None, tags=[]),
        dict(date=date(2026, 6, 30), type=TransactionType.expense, concept="Compra semanal", description="Mercadona", amount=Decimal("78.90"), category="Supermercado", account=tarjeta.id, transfer=None, tags=[]),
        dict(date=date(2026, 6, 5), type=TransactionType.expense, concept="Cena viernes", description="Restaurante La Plaza", amount=Decimal("38.50"), category="Restaurantes", account=tarjeta.id, transfer=None, tags=[tag_ocasional]),
        dict(date=date(2026, 6, 13), type=TransactionType.expense, concept="Comida cumpleaños", description="Italiano Roma", amount=Decimal("52.00"), category="Restaurantes", account=tarjeta.id, transfer=None, tags=[tag_ocasional]),
        dict(date=date(2026, 6, 2), type=TransactionType.expense, concept="Café lunes", description="Starbucks", amount=Decimal("4.50"), category="Café", account=efectivo.id, transfer=None, tags=[]),
        dict(date=date(2026, 6, 8), type=TransactionType.expense, concept="Café con Ana", description="Café Central", amount=Decimal("6.20"), category="Café", account=efectivo.id, transfer=None, tags=[]),
        dict(date=date(2026, 6, 18), type=TransactionType.expense, concept="Café y bollería", description="Panadería Roca", amount=Decimal("5.80"), category="Café", account=efectivo.id, transfer=None, tags=[]),
        dict(date=date(2026, 6, 7), type=TransactionType.expense, concept="Gasolina", description="Repsol", amount=Decimal("55.00"), category="Combustible", account=tarjeta.id, transfer=None, tags=[]),
        dict(date=date(2026, 6, 3), type=TransactionType.expense, concept="Abono metro", description="Metro de Madrid", amount=Decimal("54.60"), category="Transporte público", account=tarjeta.id, transfer=None, tags=[tag_fijo]),
        dict(date=date(2026, 6, 20), type=TransactionType.expense, concept="Taxi aeropuerto", description="Cabify", amount=Decimal("32.00"), category="Taxi y VTC", account=tarjeta.id, transfer=None, tags=[tag_ocasional]),
        dict(date=date(2026, 6, 1), type=TransactionType.expense, concept="Netflix", description="Suscripción mensual", amount=Decimal("13.99"), category="Suscripciones", account=tarjeta.id, transfer=None, tags=[tag_fijo]),
        dict(date=date(2026, 6, 1), type=TransactionType.expense, concept="Spotify", description="Premium individual", amount=Decimal("10.99"), category="Suscripciones", account=tarjeta.id, transfer=None, tags=[tag_fijo]),
        dict(date=date(2026, 6, 1), type=TransactionType.expense, concept="HBO Max", description="Suscripción mensual", amount=Decimal("9.99"), category="Suscripciones", account=tarjeta.id, transfer=None, tags=[tag_fijo]),
        dict(date=date(2026, 6, 4), type=TransactionType.expense, concept="Gimnasio", description="Basic-Fit cuota mensual", amount=Decimal("29.99"), category="Deporte", account=tarjeta.id, transfer=None, tags=[tag_fijo]),
        dict(date=date(2026, 6, 14), type=TransactionType.expense, concept="Cine", description="Cinepolis — 2 entradas", amount=Decimal("18.00"), category="Cine y teatro", account=efectivo.id, transfer=None, tags=[tag_ocasional]),
        dict(date=date(2026, 6, 10), type=TransactionType.expense, concept="Farmacia", description="Paracetamol + vitamina C", amount=Decimal("12.45"), category="Farmacia", account=efectivo.id, transfer=None, tags=[]),
        dict(date=date(2026, 6, 19), type=TransactionType.expense, concept="Consulta médica", description="Dr. García — revisión anual", amount=Decimal("60.00"), category="Médico", account=tarjeta.id, transfer=None, tags=[]),
        dict(date=date(2026, 6, 11), type=TransactionType.expense, concept="Camisetas", description="Zara — 2 camisetas", amount=Decimal("35.98"), category="Ropa", account=tarjeta.id, transfer=None, tags=[tag_ocasional]),
        dict(date=date(2026, 6, 22), type=TransactionType.expense, concept="Cargador portátil", description="Amazon — Anker 10000mAh", amount=Decimal("22.99"), category="Electrónica", account=tarjeta.id, transfer=None, tags=[tag_personal]),
        dict(date=date(2026, 6, 6), type=TransactionType.expense, concept="Libro", description="Casa del Libro — La Sombra del Viento", amount=Decimal("14.90"), category="Libros", account=efectivo.id, transfer=None, tags=[tag_personal]),
        dict(date=date(2026, 6, 15), type=TransactionType.income, concept="Proyecto web freelance", description="Diseño web para tienda local", amount=Decimal("450.00"), category="Freelance", account=banco.id, transfer=None, tags=[]),
        dict(date=date(2026, 6, 28), type=TransactionType.income, concept="Dividendos Q2", description="Fondo indexado MSCI World", amount=Decimal("38.75"), category="Dividendos", account=ahorros.id, transfer=None, tags=[]),
        dict(date=date(2026, 6, 25), type=TransactionType.transfer, concept="Ahorro mensual", description="Transferencia a cuenta ahorros", amount=Decimal("200.00"), category=None, account=banco.id, transfer=ahorros.id, tags=[]),
        dict(date=date(2026, 6, 1), type=TransactionType.expense, concept="Comunidad julio", description="Comunidad de vecinos", amount=Decimal("95.00"), category="Alquiler/Hipoteca", account=banco.id, transfer=None, tags=[tag_fijo]),
        dict(date=date(2026, 6, 17), type=TransactionType.expense, concept="Curso Python avanzado", description="Udemy — oferta", amount=Decimal("12.99"), category="Cursos", account=tarjeta.id, transfer=None, tags=[tag_personal]),
        dict(date=date(2026, 6, 12), type=TransactionType.expense, concept="Toallas nuevas", description="IKEA", amount=Decimal("24.99"), category="Hogar", account=tarjeta.id, transfer=None, tags=[tag_ocasional]),
        dict(date=date(2026, 6, 21), type=TransactionType.expense, concept="Regalo cumpleaños", description="Librería + tarjeta", amount=Decimal("25.00"), category="Otros gastos", account=efectivo.id, transfer=None, tags=[tag_personal]),
        dict(date=date(2026, 6, 30), type=TransactionType.income, concept="Intereses cuenta ahorros", description="Intereses junio", amount=Decimal("3.22"), category="Intereses", account=ahorros.id, transfer=None, tags=[]),
    ]

    for td in tx_data:
        cat_id = cats[td["category"]].id if td["category"] else None
        tx = Transaction(
            date=td["date"],
            type=td["type"],
            concept=td["concept"],
            description=td["description"],
            amount=td["amount"],
            category_id=cat_id,
            account_id=td["account"],
            transfer_account_id=td["transfer"],
        )
        session.add(tx)
        session.flush()
        for tag in td["tags"]:
            session.execute(
                text("INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (:tid, :tagid)"),
                {"tid": tx.id, "tagid": tag.id},
            )

    # ── Budgets ───────────────────────────────────────────────
    session.add_all([
        Budget(category_id=cats["Alimentación"].id, amount=Decimal("350.00"), period=BudgetPeriod.monthly),
        Budget(category_id=cats["Transporte"].id, amount=Decimal("120.00"), period=BudgetPeriod.monthly),
        Budget(category_id=cats["Ocio"].id, amount=Decimal("100.00"), period=BudgetPeriod.monthly),
        Budget(category_id=cats["Vivienda"].id, amount=Decimal("1050.00"), period=BudgetPeriod.monthly),
        Budget(category_id=cats["Salud"].id, amount=Decimal("80.00"), period=BudgetPeriod.monthly),
    ])

    # ── Savings Goals ─────────────────────────────────────────
    session.add_all([
        SavingsGoal(name="Fondo de emergencia", target_amount=Decimal("6000.00"), current_amount=Decimal("2400.00"), deadline=date(2027, 3, 1), color="#16a34a"),
        SavingsGoal(name="Vacaciones verano", target_amount=Decimal("1500.00"), current_amount=Decimal("800.00"), deadline=date(2026, 8, 1), color="#3b82f6"),
    ])

    # ── Categorization Rules ──────────────────────────────────
    session.add_all([
        CategorizationRule(pattern="MERCADONA", category_id=cats["Supermercado"].id, priority=10),
        CategorizationRule(pattern="CARREFOUR", category_id=cats["Supermercado"].id, priority=10),
        CategorizationRule(pattern="NETFLIX", category_id=cats["Suscripciones"].id, priority=10),
        CategorizationRule(pattern="SPOTIFY", category_id=cats["Suscripciones"].id, priority=10),
        CategorizationRule(pattern="REPSOL", category_id=cats["Combustible"].id, priority=10),
    ])

    session.commit()

    revision = session.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
    print(f"✅ Base de datos creada: {DB_PATH}")
    print(f"   revisión Alembic: {revision}")
    print(f"   4 cuentas")
    print(f"   {len(cats)} categorías")
    print(f"   4 etiquetas")
    print(f"   {len(tx_data)} transacciones (junio 2026)")
    print(f"   5 presupuestos")
    print(f"   2 objetivos de ahorro")
    print(f"   5 reglas de autocategorización")


if __name__ == "__main__":
    # Crea el esquema y sella `alembic_version` en la revisión head.
    run_migrations()
    with Session(engine) as session:
        seed(session)
