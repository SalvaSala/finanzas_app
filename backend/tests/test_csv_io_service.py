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
from app.models.categorization_rule import CategorizationRule
from app.models.enums import TransactionType
from app.schemas.csv import ColumnMapping
from app.services import csv_io as service
from app.services.exceptions import NotFoundError


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


def _mapping(**overrides: str | bool | None) -> ColumnMapping:
    base: dict[str, str | bool | None] = {
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


# ── Detección de separador ────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("content", "expected"),
    [
        ("Fecha;Concepto;Importe\n01/06/2026;Compra;-20,00\n", ";"),
        ("Fecha,Concepto,Importe\n2026-06-01,Compra,-20.00\n", ","),
        ("Fecha\tConcepto\tImporte\n01/06/2026\tCompra\t-20,00\n", "\t"),
        ("01/09/2026|Compra|01/09/2026|-20.00|100.00||ref\n", "|"),
    ],
)
def test_detect_separator(content: str, expected: str) -> None:
    assert service._detect_separator(content) == expected


def test_detect_separator_prefers_the_delimiter_with_more_columns() -> None:
    """Con decimales en coma y sin cabecera, el punto y coma debe ganar."""
    content = "01/06/2026;Compra;-20,00\n02/06/2026;Nómina;1500,00\n"

    assert service._detect_separator(content) == ";"


# ── Ficheros sin cabecera (extracto tipo Banco Sabadell) ──────────────────────

# Barras verticales, sin cabecera ni preámbulo, con fecha de operación, fecha
# de valor, importe con signo, saldo corriente y dos columnas de referencia.
SABADELL_TXT = (
    b"07/09/2026|PAGO BIZUM ANA L.|06/09/2026|-33.00|1846.26||111111111111\n"
    b"07/09/2026|COMPRA TARJ. 5555XXXXXXXX1234 TIENDA UNO|08/09/2026|-45.89|1879.26||5555__1234\n"
    b"04/09/2026|COMPRA TARJ. 5555XXXXXXXX1234 TIENDA DOS|07/09/2026|-27.90|1925.15||5555__1234\n"
    b"03/09/2026|COMPRA TARJ. 5555XXXXXXXX1234 TIENDA TRES|06/09/2026|-7.55|1953.05||5555__1234\n"
    b"01/09/2026|TRANSFERENCIA RECIBIDA|01/09/2026|450.00|1960.60|333333333|\n"
)


def test_detect_csv_without_header_names_the_columns() -> None:
    preview = service.detect_csv(SABADELL_TXT)

    assert preview.has_header is False
    assert preview.separator == "|"
    assert preview.headers[:3] == ["Columna 1", "Columna 2", "Columna 3"]
    assert len(preview.preview_rows) == 5


def test_detect_csv_recognises_a_header_row() -> None:
    preview = service.detect_csv(b"Fecha;Concepto;Importe\n01/06/2026;Compra;-20,00\n")

    assert preview.has_header is True
    assert preview.headers == ["Fecha", "Concepto", "Importe"]


def test_detect_csv_honours_the_header_override() -> None:
    """El usuario puede corregir la detección desde el asistente."""
    preview = service.detect_csv(SABADELL_TXT, has_header=True)

    assert preview.has_header is True
    assert preview.headers[0] == "07/09/2026"
    assert len(preview.preview_rows) == 4


def test_import_mapped_without_header_keeps_the_first_row(session: Session) -> None:
    bank, _, _, _ = _setup(session)
    mapping = ColumnMapping(
        date_col="Columna 1",
        concept_col="Columna 2",
        amount_col="Columna 4",
        has_header=False,
    )

    result = service.import_csv_mapped(session, SABADELL_TXT, _require_id(bank.id), mapping)

    assert result.imported == 5
    assert result.skipped == 0
    types = [tx.type for tx in session.exec(select(Transaction)).all()]
    assert types.count(TransactionType.expense) == 4
    assert types.count(TransactionType.income) == 1


# ── Sugerencia automática de columnas ─────────────────────────────────────────


def test_suggest_mapping_by_content_ignores_the_balance() -> None:
    """Sin cabecera: fecha de operación, concepto e importe, nunca el saldo."""
    suggested = service.detect_csv(SABADELL_TXT).suggested

    assert suggested.date_col == "Columna 1"  # la operativa, no la de valor
    assert suggested.concept_col == "Columna 2"
    assert suggested.amount_col == "Columna 4"  # y no la 5, que es el saldo


def test_suggest_mapping_by_header_name() -> None:
    raw = (
        b"F. Operativa;Concepto;F. Valor;Importe;Saldo;Referencia 1;Referencia 2\n"
        b"07/09/2026;Compra;08/09/2026;-45,89;1879,26;;5555__1234\n"
    )

    suggested = service.detect_csv(raw).suggested

    assert suggested.date_col == "F. Operativa"  # y no "F. Valor"
    assert suggested.concept_col == "Concepto"
    assert suggested.amount_col == "Importe"  # "Saldo" está en la lista negra
    assert suggested.description_col == "Referencia 2"


def test_suggest_mapping_leaves_unknown_fields_empty() -> None:
    raw = b"Fecha;Concepto;Importe\n01/06/2026;Compra;-20,00\n"

    suggested = service.detect_csv(raw).suggested

    assert suggested.category_col is None
    assert suggested.type_col is None


# ── Reconocimiento del CSV propio de la app ───────────────────────────────────


def test_detect_csv_recognises_the_app_export(session: Session) -> None:
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

    preview = service.detect_csv(service.export_csv(session, [tx]).encode())

    assert preview.is_native is True


def test_detect_csv_does_not_flag_a_bank_file_as_native() -> None:
    assert service.detect_csv(SABADELL_TXT).is_native is False


# ── Columna de tipo ───────────────────────────────────────────────────────────


def test_import_mapped_type_column_overrides_the_sign(session: Session) -> None:
    """Importes positivos con columna de tipo: el gasto no entra como ingreso."""
    bank, _, _, _ = _setup(session)
    raw = b"Fecha;Tipo;Concepto;Importe\n01/06/2026;gasto;Compra;42,50\n"

    result = service.import_csv_mapped(
        session, raw, _require_id(bank.id), _mapping(type_col="Tipo")
    )

    assert result.imported == 1
    tx = session.exec(select(Transaction)).one()
    assert tx.type == TransactionType.expense
    assert tx.amount == Decimal("42.50")


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("gasto", TransactionType.expense),
        ("Cargo", TransactionType.expense),
        ("D", TransactionType.expense),
        ("ingreso", TransactionType.income),
        ("Abono", TransactionType.income),
        ("H", TransactionType.income),
    ],
)
def test_resolve_type_accepts_bank_wordings(value: str, expected: TransactionType) -> None:
    assert service._resolve_type(value, TransactionType.income) == expected


def test_resolve_type_falls_back_to_the_sign_when_empty() -> None:
    assert service._resolve_type("", TransactionType.expense) == TransactionType.expense


def test_resolve_type_rejects_unknown_values() -> None:
    with pytest.raises(ValueError, match="desconocido"):
        service._resolve_type("nosequé", TransactionType.income)


def test_import_mapped_reports_transfers_it_cannot_place(session: Session) -> None:
    bank, _, _, _ = _setup(session)
    raw = b"Fecha;Tipo;Concepto;Importe\n01/06/2026;transferencia;Traspaso;100,00\n"

    result = service.import_csv_mapped(
        session, raw, _require_id(bank.id), _mapping(type_col="Tipo")
    )

    assert result.imported == 0
    assert "cuenta destino" in result.errors[0]


# ── Recuento de movimientos sin categoría ─────────────────────────────────────


def test_import_mapped_counts_rows_left_without_category(session: Session) -> None:
    """Sin columna de categoría el resultado debe decir que no se categorizó nada."""
    bank, _, _, _ = _setup(session)
    raw = b"Fecha;Concepto;Importe\n01/06/2026;Compra;-20,00\n02/06/2026;Otra;-5,00\n"

    result = service.import_csv_mapped(session, raw, _require_id(bank.id), _mapping())

    assert result.imported == 2
    assert result.uncategorized == 2


def test_import_mapped_does_not_count_what_a_rule_categorized(session: Session) -> None:
    bank, _, food, _ = _setup(session)
    session.add(CategorizationRule(pattern="Mercadona", category_id=_require_id(food.id)))
    session.commit()
    raw = b"Fecha;Concepto;Importe\n01/06/2026;Compra Mercadona;-20,00\n"

    result = service.import_csv_mapped(session, raw, _require_id(bank.id), _mapping())

    assert result.uncategorized == 0
    tx = session.exec(select(Transaction)).one()
    assert tx.category_id == food.id


# ── Deduplicación ─────────────────────────────────────────────────────────────

# Dos movimientos distintos el mismo día, para reimportar el fichero entero.
DOS_FILAS = b"Fecha;Concepto;Importe\n01/06/2026;Compra;-20,00\n01/06/2026;Cena;-35,00\n"


def test_import_mapped_skips_what_is_already_stored(session: Session) -> None:
    """Reimportar el mismo extracto no debe duplicar nada."""
    bank, _, _, _ = _setup(session)

    primera = service.import_csv_mapped(session, DOS_FILAS, _require_id(bank.id), _mapping())
    segunda = service.import_csv_mapped(session, DOS_FILAS, _require_id(bank.id), _mapping())

    assert primera.imported == 2
    assert primera.duplicates == 0
    assert segunda.imported == 0
    assert segunda.duplicates == 2
    assert len(session.exec(select(Transaction)).all()) == 2


def test_import_mapped_can_import_duplicates_on_purpose(session: Session) -> None:
    bank, _, _, _ = _setup(session)
    service.import_csv_mapped(session, DOS_FILAS, _require_id(bank.id), _mapping())

    result = service.import_csv_mapped(
        session, DOS_FILAS, _require_id(bank.id), _mapping(skip_duplicates=False)
    )

    assert result.imported == 2
    assert result.duplicates == 2  # se informa igualmente
    assert len(session.exec(select(Transaction)).all()) == 4


def test_import_mapped_keeps_genuine_repeats_within_a_file(session: Session) -> None:
    """Dos cafés idénticos el mismo día son dos movimientos, no un duplicado."""
    bank, _, _, _ = _setup(session)
    raw = b"Fecha;Concepto;Importe\n01/06/2026;Cafe;-1,50\n01/06/2026;Cafe;-1,50\n"

    result = service.import_csv_mapped(session, raw, _require_id(bank.id), _mapping())

    assert result.imported == 2
    assert result.duplicates == 0


def test_import_mapped_matches_repeats_one_by_one(session: Session) -> None:
    """Con uno guardado y dos en el fichero, entra solo el que falta."""
    bank, _, _, _ = _setup(session)
    service.import_csv_mapped(
        session,
        b"Fecha;Concepto;Importe\n01/06/2026;Cafe;-1,50\n",
        _require_id(bank.id),
        _mapping(),
    )
    raw = b"Fecha;Concepto;Importe\n01/06/2026;Cafe;-1,50\n01/06/2026;Cafe;-1,50\n"

    result = service.import_csv_mapped(session, raw, _require_id(bank.id), _mapping())

    assert result.imported == 1
    assert result.duplicates == 1
    assert len(session.exec(select(Transaction)).all()) == 2


def test_import_mapped_does_not_confuse_other_accounts(session: Session) -> None:
    """El mismo movimiento en otra cuenta no es un duplicado."""
    bank, cash, _, _ = _setup(session)
    service.import_csv_mapped(session, DOS_FILAS, _require_id(bank.id), _mapping())

    result = service.import_csv_mapped(session, DOS_FILAS, _require_id(cash.id), _mapping())

    assert result.imported == 2
    assert result.duplicates == 0


def test_import_mapped_ignores_case_and_spacing_in_the_concept(session: Session) -> None:
    bank, _, _, _ = _setup(session)
    service.import_csv_mapped(
        session,
        b"Fecha;Concepto;Importe\n01/06/2026;Compra;-20,00\n",
        _require_id(bank.id),
        _mapping(),
    )
    raw = b"Fecha;Concepto;Importe\n01/06/2026;COMPRA  ;-20,00\n"

    result = service.import_csv_mapped(session, raw, _require_id(bank.id), _mapping())

    assert result.duplicates == 1


# ── Previsualización (dry run) ────────────────────────────────────────────────


def test_preview_does_not_write_anything(session: Session) -> None:
    bank, _, _, _ = _setup(session)

    preview = service.preview_import_mapped(session, DOS_FILAS, _require_id(bank.id), _mapping())

    assert preview.total == 2
    assert preview.ready == 2
    assert preview.duplicates == 0
    assert preview.errors == 0
    assert session.exec(select(Transaction)).all() == []


def test_preview_shows_the_parsed_values(session: Session) -> None:
    bank, _, _, _ = _setup(session)

    preview = service.preview_import_mapped(session, DOS_FILAS, _require_id(bank.id), _mapping())

    first = preview.rows[0]
    assert first.line == 2  # la 1 es la cabecera
    assert first.date == "2026-06-01"
    assert first.type == TransactionType.expense
    assert first.amount == "20.00"
    assert first.concept == "Compra"
    assert first.error is None


def test_preview_marks_rows_already_stored(session: Session) -> None:
    bank, _, _, _ = _setup(session)
    service.import_csv_mapped(session, DOS_FILAS, _require_id(bank.id), _mapping())

    preview = service.preview_import_mapped(session, DOS_FILAS, _require_id(bank.id), _mapping())

    assert preview.ready == 0
    assert preview.duplicates == 2
    assert all(row.duplicate for row in preview.rows)


def test_preview_reports_the_row_that_will_fail(session: Session) -> None:
    bank, _, _, _ = _setup(session)
    raw = b"Fecha;Concepto;Importe\n01/06/2026;Compra;-20,00\nno-es-fecha;Otra;-5,00\n"

    preview = service.preview_import_mapped(session, raw, _require_id(bank.id), _mapping())

    assert preview.ready == 1
    assert preview.errors == 1
    fallida = preview.rows[1]
    assert fallida.line == 3
    assert fallida.error is not None and "Fecha inválida" in fallida.error
    assert fallida.amount is None


def test_preview_shows_the_category_a_rule_would_assign(session: Session) -> None:
    """La previsualización debe reflejar las reglas, no solo la columna del CSV."""
    bank, _, food, market = _setup(session)
    session.add(
        CategorizationRule(
            pattern="Mercadona",
            category_id=_require_id(food.id),
            subcategory_id=_require_id(market.id),
        )
    )
    session.commit()
    raw = b"Fecha;Concepto;Importe\n01/06/2026;Compra Mercadona;-20,00\n"

    preview = service.preview_import_mapped(session, raw, _require_id(bank.id), _mapping())

    assert preview.rows[0].category == "Alimentación › Supermercado"


def test_preview_unknown_account(session: Session) -> None:
    _setup(session)
    with pytest.raises(NotFoundError):
        service.preview_import_mapped(session, DOS_FILAS, 9999, _mapping())


# ── Escritura en una sola transacción ─────────────────────────────────────────


def test_import_mapped_writes_the_good_rows_and_reports_the_bad(session: Session) -> None:
    """Una fila inválida no debe impedir que entren las demás."""
    bank, _, _, _ = _setup(session)
    raw = b"Fecha;Concepto;Importe\n01/06/2026;Buena;-20,00\nno-es-fecha;Mala;-5,00\n"

    result = service.import_csv_mapped(session, raw, _require_id(bank.id), _mapping())

    assert result.imported == 1
    assert result.skipped == 1
    assert len(session.exec(select(Transaction)).all()) == 1
