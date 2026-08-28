"""Tests for the CSV service: export, native import and mapped external import.

Es el servicio más grande del backend y el que más regresiones ha acumulado
(parseo DMY, ISO con barras y subcategorías), así que los helpers privados de
parseo se prueban directamente además del flujo completo.
"""

import datetime as dt
from decimal import Decimal

import pytest
from sqlmodel import Session, select

from app.models import Account, AccountType, Category, CategoryType, Transaction
from app.models.enums import TransactionType
from app.schemas.csv import ColumnMapping
from app.services import csv_io as service


def _require_id(value: int | None) -> int:
    """Narrow an optional primary key to ``int`` after commit+refresh (para mypy)."""
    assert value is not None
    return value


def _setup(session: Session) -> tuple[Account, Account, Category, Category]:
    bank = Account(name="Banco", type=AccountType.bank)
    cash = Account(name="Efectivo", type=AccountType.cash)
    food = Category(name="Alimentación", type=CategoryType.expense)
    session.add_all([bank, cash, food])
    session.commit()
    for entity in (bank, cash, food):
        session.refresh(entity)

    market = Category(name="Supermercado", type=CategoryType.expense, parent_id=food.id)
    session.add(market)
    session.commit()
    session.refresh(market)
    return bank, cash, food, market


# ── Export ────────────────────────────────────────────────────────────────────


def test_export_csv_writes_headers_and_rows(session: Session) -> None:
    bank, _, food, market = _setup(session)
    tx = Transaction(
        date=dt.date(2026, 6, 15),
        type=TransactionType.expense,
        concept="Compra semanal",
        description="Notas",
        amount=Decimal("42.50"),
        account_id=bank.id,
        category_id=food.id,
        subcategory_id=market.id,
    )
    session.add(tx)
    session.commit()

    output = service.export_csv(session, [tx])
    lines = output.strip().splitlines()

    assert lines[0].split(",")[:3] == ["fecha", "tipo", "concepto"]
    assert "2026-06-15" in lines[1]
    assert "gasto" in lines[1]
    assert "42.50" in lines[1]
    assert "Alimentación" in lines[1]
    assert "Supermercado" in lines[1]


def test_export_csv_handles_empty_optional_fields(session: Session) -> None:
    bank, _, _, _ = _setup(session)
    tx = Transaction(
        date=dt.date(2026, 6, 15),
        type=TransactionType.income,
        concept="Nómina",
        amount=Decimal("1200.00"),
        account_id=bank.id,
    )
    session.add(tx)
    session.commit()

    output = service.export_csv(session, [tx])
    # Sin categoría, sin subcategoría y sin cuenta destino: campos vacíos, no "None".
    assert "None" not in output
    assert "ingreso" in output


# ── Import nativo ─────────────────────────────────────────────────────────────


def test_import_csv_imports_valid_rows(session: Session) -> None:
    _setup(session)
    content = (
        "fecha,tipo,concepto,descripcion,importe,cuenta,cuenta_destino,categoria,subcategoria\n"
        "2026-06-01,gasto,Compra,,20.00,Banco,,Alimentación,Supermercado\n"
        "2026-06-02,ingreso,Nómina,,1500.00,Banco,,,\n"
    )
    result = service.import_csv(session, content)

    assert result.imported == 2
    assert result.skipped == 0
    assert result.errors == []


def test_import_csv_accepts_comma_decimal(session: Session) -> None:
    _setup(session)
    # La coma decimal choca con el separador de columnas, así que se entrecomilla.
    content = (
        "fecha,tipo,concepto,descripcion,importe,cuenta\n"
        '2026-06-01,gasto,Compra,,"20,50",Banco\n'
    )
    result = service.import_csv(session, content)
    assert result.imported == 1


def test_import_csv_reports_missing_headers(session: Session) -> None:
    _setup(session)
    result = service.import_csv(session, "fecha,concepto\n2026-06-01,Compra\n")
    assert result.imported == 0
    assert "Columnas obligatorias no encontradas" in result.errors[0]


def test_import_csv_reports_empty_file(session: Session) -> None:
    _setup(session)
    result = service.import_csv(session, "")
    assert result.imported == 0
    assert "vacío" in result.errors[0]


@pytest.mark.parametrize(
    ("row", "expected_error"),
    [
        ("01/06/2026,gasto,Compra,,20.00,Banco", "Fecha inválida"),
        ("2026-06-01,perdido,Compra,,20.00,Banco", "desconocido"),
        ("2026-06-01,gasto,,,20.00,Banco", "concepto"),
        ("2026-06-01,gasto,Compra,,-20.00,Banco", "Importe inválido"),
        ("2026-06-01,gasto,Compra,,20.00,Inexistente", "no encontrada"),
    ],
)
def test_import_csv_skips_invalid_rows(session: Session, row: str, expected_error: str) -> None:
    _setup(session)
    content = f"fecha,tipo,concepto,descripcion,importe,cuenta\n{row}\n"
    result = service.import_csv(session, content)

    assert result.imported == 0
    assert result.skipped == 1
    assert expected_error in result.errors[0]


def test_import_csv_transfer_requires_distinct_accounts(session: Session) -> None:
    _setup(session)
    content = (
        "fecha,tipo,concepto,descripcion,importe,cuenta,cuenta_destino\n"
        "2026-06-01,transferencia,Traspaso,,50.00,Banco,Banco\n"
    )
    result = service.import_csv(session, content)
    assert result.skipped == 1
    assert "distintas" in result.errors[0]


def test_import_csv_transfer_between_accounts(session: Session) -> None:
    _setup(session)
    content = (
        "fecha,tipo,concepto,descripcion,importe,cuenta,cuenta_destino\n"
        "2026-06-01,transferencia,Traspaso,,50.00,Banco,Efectivo\n"
    )
    result = service.import_csv(session, content)
    assert result.imported == 1


def test_export_import_round_trip(session: Session) -> None:
    """Lo exportado se puede volver a importar sin pérdidas."""
    bank, _, food, market = _setup(session)
    tx = Transaction(
        date=dt.date(2026, 6, 15),
        type=TransactionType.expense,
        concept="Compra semanal",
        amount=Decimal("42.50"),
        account_id=bank.id,
        category_id=food.id,
        subcategory_id=market.id,
    )
    session.add(tx)
    session.commit()

    exported = service.export_csv(session, [tx])
    result = service.import_csv(session, exported)

    assert result.imported == 1
    assert result.errors == []


# ── Detección de CSV externo ──────────────────────────────────────────────────


def test_detect_csv_semicolon_separator() -> None:
    raw = b"Fecha;Concepto;Importe\n01/06/2026;Compra;-20,00\n"
    preview = service.detect_csv(raw)

    assert preview.separator == ";"
    assert preview.headers == ["Fecha", "Concepto", "Importe"]
    assert preview.preview_rows == [["01/06/2026", "Compra", "-20,00"]]


def test_detect_csv_comma_separator() -> None:
    raw = b"Date,Concept,Amount\n2026-06-01,Groceries,-20.00\n"
    preview = service.detect_csv(raw)

    assert preview.separator == ","
    assert preview.headers == ["Date", "Concept", "Amount"]


def test_detect_csv_latin1_encoding() -> None:
    raw = "Fecha;Concepto;Importe\n01/06/2026;Alimentación;-20,00\n".encode("latin-1")
    preview = service.detect_csv(raw)

    assert preview.encoding == "latin-1"
    assert preview.preview_rows[0][1] == "Alimentación"


def test_detect_csv_limits_preview_to_five_rows() -> None:
    rows = "\n".join(f"2026-06-0{i},Compra,-1.00" for i in range(1, 9))
    preview = service.detect_csv(f"Fecha,Concepto,Importe\n{rows}\n".encode())
    assert len(preview.preview_rows) == 5


def test_detect_csv_empty_file() -> None:
    preview = service.detect_csv(b"")
    assert preview.headers == []
    assert preview.preview_rows == []


# ── Parseo de fechas ──────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("value", "fmt", "expected"),
    [
        ("2026-06-01", "auto", dt.date(2026, 6, 1)),
        ("2026-06-01", "iso", dt.date(2026, 6, 1)),
        # ISO con barras: el fix de julio de 2026.
        ("2026/07/01", "auto", dt.date(2026, 7, 1)),
        ("01/06/2026", "auto", dt.date(2026, 6, 1)),  # DMY gana en modo auto
        ("01/06/2026", "dmy", dt.date(2026, 6, 1)),
        ("06/01/2026", "mdy", dt.date(2026, 6, 1)),
        ("13/06/2026", "auto", dt.date(2026, 6, 13)),  # solo válido como DMY
    ],
)
def test_parse_date(value: str, fmt: str, expected: dt.date) -> None:
    assert service._parse_date(value, fmt) == expected


@pytest.mark.parametrize(
    ("value", "fmt"),
    [
        ("01/06/2026", "iso"),
        ("2026-06-01", "dmy"),
        ("32/06/2026", "dmy"),
        ("no es una fecha", "auto"),
    ],
)
def test_parse_date_rejects_invalid(value: str, fmt: str) -> None:
    with pytest.raises(ValueError, match="Fecha inválida"):
        service._parse_date(value, fmt)


# ── Parseo de importes ────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("value", "sep", "expected_amount", "expected_type"),
    [
        ("-20.00", "dot", Decimal("20.00"), TransactionType.expense),
        ("20.00", "dot", Decimal("20.00"), TransactionType.income),
        ("-20,00", "comma", Decimal("20.00"), TransactionType.expense),
        ("-20,00", "auto", Decimal("20.00"), TransactionType.expense),
        ("1.234,56", "auto", Decimal("1234.56"), TransactionType.income),  # miles con punto
        ("1,234.56", "auto", Decimal("1234.56"), TransactionType.income),  # miles con coma
        ("1.234,56", "comma", Decimal("1234.56"), TransactionType.income),
    ],
)
def test_parse_amount(
    value: str, sep: str, expected_amount: Decimal, expected_type: TransactionType
) -> None:
    amount, tx_type = service._parse_amount(value, sep, "signed")
    assert amount == expected_amount
    assert tx_type == expected_type


def test_parse_amount_rejects_garbage() -> None:
    with pytest.raises(ValueError, match="Importe inválido"):
        service._parse_amount("no es un importe", "auto", "signed")


# ── Importación con mapeo de columnas ─────────────────────────────────────────


def _mapping(**overrides: str | None) -> ColumnMapping:
    base: dict[str, str | None] = {
        "date_col": "Fecha",
        "concept_col": "Concepto",
        "amount_col": "Importe",
    }
    base.update(overrides)
    return ColumnMapping(**base)


def test_import_mapped_basic(session: Session) -> None:
    bank, _, _, _ = _setup(session)
    raw = "Fecha;Concepto;Importe\n01/06/2026;Compra;-20,00\n02/06/2026;Nómina;1500,00\n".encode()

    result = service.import_csv_mapped(session, raw, _require_id(bank.id), _mapping())

    assert result.imported == 2
    assert result.skipped == 0
    assert result.errors == []


def test_import_mapped_signs_decide_type(session: Session) -> None:
    bank, _, _, _ = _setup(session)
    raw = b"Fecha;Concepto;Importe\n01/06/2026;Compra;-20,00\n"

    service.import_csv_mapped(session, raw, _require_id(bank.id), _mapping())

    tx = session.exec(select(Transaction)).one()
    assert tx.type == TransactionType.expense
    assert tx.amount == Decimal("20.00")


def test_import_mapped_unknown_account(session: Session) -> None:
    _setup(session)
    raw = b"Fecha;Concepto;Importe\n01/06/2026;Compra;-20,00\n"
    result = service.import_csv_mapped(session, raw, 9999, _mapping())

    assert result.imported == 0
    assert "Cuenta no encontrada" in result.errors[0]


def test_import_mapped_defaults_missing_concept(session: Session) -> None:
    bank, _, _, _ = _setup(session)
    raw = b"Fecha;Concepto;Importe\n01/06/2026;;-20,00\n"

    service.import_csv_mapped(session, raw, _require_id(bank.id), _mapping())

    tx = session.exec(select(Transaction)).one()
    assert tx.concept == "(Sin concepto)"


def test_import_mapped_skips_rows_without_date(session: Session) -> None:
    bank, _, _, _ = _setup(session)
    raw = b"Fecha;Concepto;Importe\n;Compra;-20,00\n01/06/2026;Otra;-5,00\n"

    result = service.import_csv_mapped(session, raw, _require_id(bank.id), _mapping())

    assert result.imported == 1
    assert result.skipped == 1
    assert "fecha" in result.errors[0]


def test_import_mapped_resolves_parent_child_category(session: Session) -> None:
    bank, _, food, market = _setup(session)
    raw = (
        "Fecha;Concepto;Importe;Cat\n01/06/2026;Compra;-20,00;Alimentación:Supermercado\n".encode()
    )

    result = service.import_csv_mapped(
        session, raw, _require_id(bank.id), _mapping(category_col="Cat")
    )

    assert result.imported == 1
    assert result.uncategorized == 0
    tx = session.exec(select(Transaction)).one()
    assert tx.category_id == food.id
    assert tx.subcategory_id == market.id


def test_import_mapped_resolves_bare_subcategory_name(session: Session) -> None:
    """'Supermercado' a secas debe resolverse a su padre + subcategoría."""
    bank, _, food, market = _setup(session)
    raw = b"Fecha;Concepto;Importe;Cat\n01/06/2026;Compra;-20,00;Supermercado\n"

    service.import_csv_mapped(session, raw, _require_id(bank.id), _mapping(category_col="Cat"))

    tx = session.exec(select(Transaction)).one()
    assert tx.category_id == food.id
    assert tx.subcategory_id == market.id


def test_import_mapped_counts_uncategorized(session: Session) -> None:
    bank, _, _, _ = _setup(session)
    raw = b"Fecha;Concepto;Importe;Cat\n01/06/2026;Compra;-20,00;Desconocida\n"

    result = service.import_csv_mapped(
        session, raw, _require_id(bank.id), _mapping(category_col="Cat")
    )

    assert result.imported == 1
    assert result.uncategorized == 1
    tx = session.exec(select(Transaction)).one()
    assert tx.category_id is None


def test_import_mapped_optional_description(session: Session) -> None:
    bank, _, _, _ = _setup(session)
    raw = b"Fecha;Concepto;Importe;Notas\n01/06/2026;Compra;-20,00;Detalle\n"

    service.import_csv_mapped(session, raw, _require_id(bank.id), _mapping(description_col="Notas"))

    tx = session.exec(select(Transaction)).one()
    assert tx.description == "Detalle"


def test_import_mapped_empty_file(session: Session) -> None:
    bank, _, _, _ = _setup(session)
    result = service.import_csv_mapped(session, b"", _require_id(bank.id), _mapping())

    assert result.imported == 0
    assert "vacío" in result.errors[0]
