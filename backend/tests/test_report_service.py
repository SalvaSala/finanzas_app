"""Tests for the PDF report service.

No se valida el contenido visual del PDF (eso es trabajo de la vista previa
manual): se comprueba que se genera un PDF válido en los casos límite y que los
helpers de formato respetan el locale es-ES y la moneda EUR.
"""

import datetime as dt
from decimal import Decimal

import pytest
from sqlmodel import Session

from app.models import Account, AccountType, Category, CategoryType, Transaction
from app.models.enums import TransactionType
from app.services import report as service


def _setup(session: Session) -> tuple[Account, Category, Category]:
    account = Account(name="Banco", type=AccountType.bank)
    food = Category(name="Alimentación", type=CategoryType.expense, color="#ff5722")
    salary = Category(name="Nómina", type=CategoryType.income)
    session.add_all([account, food, salary])
    session.commit()
    for entity in (account, food, salary):
        session.refresh(entity)
    return account, food, salary


def _tx(
    session: Session,
    account: Account,
    category: Category,
    tx_type: TransactionType,
    amount: str,
    date: dt.date,
) -> None:
    session.add(
        Transaction(
            date=date,
            type=tx_type,
            concept="Movimiento",
            amount=Decimal(amount),
            account_id=account.id,
            category_id=category.id,
        )
    )
    session.commit()


# ── Formato de importes (es-ES / EUR) ─────────────────────────────────────────


@pytest.mark.parametrize(
    ("amount", "expected"),
    [
        (Decimal("0"), "0,00 €"),
        (Decimal("5.5"), "5,50 €"),
        (Decimal("1234.56"), "1.234,56 €"),
        (Decimal("1000000"), "1.000.000,00 €"),
        # El signo se representa aparte (color), aquí siempre valor absoluto.
        (Decimal("-42.10"), "42,10 €"),
    ],
)
def test_fmt_money_uses_spanish_locale(amount: Decimal, expected: str) -> None:
    assert service._fmt_money(amount) == expected


@pytest.mark.parametrize(
    ("year", "month", "expected"),
    [
        (2026, None, "2026"),
        (2026, 1, "Enero 2026"),
        (2026, 6, "Junio 2026"),
        (2026, 12, "Diciembre 2026"),
    ],
)
def test_period_label(year: int, month: int | None, expected: str) -> None:
    assert service._period_label(year, month) == expected


# ── Conversión de color ───────────────────────────────────────────────────────


def test_hex_to_rgb_parses_css_color() -> None:
    assert service._hex_to_rgb("#ff5722", (0, 0, 0)) == (255, 87, 34)


@pytest.mark.parametrize("value", [None, "", "rojo", "#fff", "#gggggg", "ff5722"])
def test_hex_to_rgb_falls_back_on_invalid(value: str | None) -> None:
    fallback = (1, 2, 3)
    assert service._hex_to_rgb(value, fallback) == fallback


# ── Generación del PDF ────────────────────────────────────────────────────────


def _assert_is_pdf(data: bytes) -> None:
    assert data.startswith(b"%PDF"), "La salida no es un PDF"
    assert b"%%EOF" in data[-1024:], "El PDF no está cerrado correctamente"
    assert len(data) > 1000


def test_generate_pdf_monthly(session: Session) -> None:
    account, food, salary = _setup(session)
    _tx(session, account, salary, TransactionType.income, "1500.00", dt.date(2026, 6, 1))
    _tx(session, account, food, TransactionType.expense, "220.75", dt.date(2026, 6, 10))

    _assert_is_pdf(service.generate_pdf(session, 2026, 6))


def test_generate_pdf_yearly_includes_monthly_chart(session: Session) -> None:
    account, food, salary = _setup(session)
    for month in (1, 5, 11):
        _tx(session, account, salary, TransactionType.income, "1500.00", dt.date(2026, month, 1))
        _tx(session, account, food, TransactionType.expense, "300.00", dt.date(2026, month, 10))

    _assert_is_pdf(service.generate_pdf(session, 2026, None))


def test_generate_pdf_with_empty_period(session: Session) -> None:
    """Un periodo sin movimientos debe generar un PDF válido, no reventar."""
    _setup(session)
    _assert_is_pdf(service.generate_pdf(session, 2026, 6))


def test_generate_pdf_with_uncategorized_transactions(session: Session) -> None:
    account, _, _ = _setup(session)
    session.add(
        Transaction(
            date=dt.date(2026, 6, 5),
            type=TransactionType.expense,
            concept="Sin categoría",
            amount=Decimal("15.00"),
            account_id=account.id,
        )
    )
    session.commit()

    _assert_is_pdf(service.generate_pdf(session, 2026, 6))


def test_generate_pdf_with_many_categories(session: Session) -> None:
    """El gráfico de tarta recorta al top 8; con más categorías no debe fallar."""
    account, _, _ = _setup(session)
    for i in range(12):
        cat = Category(name=f"Categoría {i}", type=CategoryType.expense)
        session.add(cat)
        session.commit()
        session.refresh(cat)
        _tx(session, account, cat, TransactionType.expense, f"{i + 1}0.00", dt.date(2026, 6, 5))

    _assert_is_pdf(service.generate_pdf(session, 2026, 6))


def test_generate_pdf_with_only_income(session: Session) -> None:
    """Sin gastos no hay tarta de distribución; el resto del informe sigue saliendo."""
    account, _, salary = _setup(session)
    _tx(session, account, salary, TransactionType.income, "1500.00", dt.date(2026, 6, 1))

    _assert_is_pdf(service.generate_pdf(session, 2026, 6))


def test_generate_pdf_spans_multiple_pages(session: Session) -> None:
    """Con muchos movimientos la tabla salta de página sin romper el documento."""
    account, food, _ = _setup(session)
    for day in range(1, 29):
        _tx(session, account, food, TransactionType.expense, "10.00", dt.date(2026, 6, day))

    data = service.generate_pdf(session, 2026, 6)
    _assert_is_pdf(data)
    # Con un solo movimiento fpdf emite un único objeto de página; aquí deben ser varios.
    assert data.count(b"/Type /Page\n") > 1
