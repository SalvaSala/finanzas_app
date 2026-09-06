"""CSV import and export for transactions."""

import codecs
import csv
import datetime as dt
import io
import re
from collections import Counter
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation

from sqlmodel import Session

from app.models import Category, Transaction
from app.models.enums import TransactionType
from app.repositories import account as account_repo
from app.repositories import category as category_repo
from app.repositories import transaction as transaction_repo
from app.schemas.csv import (
    ColumnMapping,
    CsvImportMappedResult,
    CsvImportPreview,
    CsvPreviewResult,
    ImportPreviewRow,
    SuggestedMapping,
    UncategorizedConcept,
)
from app.schemas.transaction import TransactionCreate
from app.services import transaction as transaction_service
from app.services.exceptions import NotFoundError

# ── Column names in the app-native CSV (Spanish, user-facing) ─────────────────

_HEADERS = [
    "fecha",
    "tipo",
    "concepto",
    "descripcion",
    "importe",
    "cuenta",
    "cuenta_destino",
    "categoria",
    "subcategoria",
]

# The first six are the ones the native importer cannot work without.
_REQUIRED_HEADERS = _HEADERS[:6]

_TYPE_LABEL = {
    TransactionType.income: "ingreso",
    TransactionType.expense: "gasto",
    TransactionType.transfer: "transferencia",
}

_LABEL_TYPE = {v: k for k, v in _TYPE_LABEL.items()}


# ── Export ─────────────────────────────────────────────────────────────────────


def export_csv(session: Session, transactions: list[Transaction]) -> str:
    """Return a CSV string for the given transaction list."""
    accounts = {a.id: a.name for a in account_repo.list_all(session)}
    categories = {c.id: c.name for c in category_repo.list_all(session)}

    buf = io.StringIO()
    writer = csv.writer(buf, quoting=csv.QUOTE_MINIMAL)
    writer.writerow(_HEADERS)

    for tx in transactions:
        writer.writerow(
            [
                tx.date.isoformat(),
                _TYPE_LABEL.get(tx.type, tx.type),
                tx.concept,
                tx.description or "",
                str(tx.amount),
                accounts.get(tx.account_id, ""),
                accounts.get(tx.transfer_account_id, "") if tx.transfer_account_id else "",
                categories.get(tx.category_id, "") if tx.category_id else "",
                categories.get(tx.subcategory_id, "") if tx.subcategory_id else "",
            ]
        )

    return buf.getvalue()


# ── Native import (app-native CSV) ────────────────────────────────────────────


class ImportResult:
    def __init__(self) -> None:
        self.imported = 0
        self.skipped = 0
        self.errors: list[str] = []

    def to_dict(self) -> dict[str, object]:
        return {
            "imported": self.imported,
            "skipped": self.skipped,
            "errors": self.errors,
        }


def import_csv(session: Session, content: str) -> ImportResult:
    """Parse app-native CSV and import valid rows as transactions."""
    result = ImportResult()

    accounts_by_name = {a.name.lower(): a for a in account_repo.list_all(session)}
    categories_by_name = {c.name.lower(): c for c in category_repo.list_all(session)}

    reader = csv.DictReader(io.StringIO(content))

    if reader.fieldnames is None:
        result.errors.append("El archivo CSV está vacío o no tiene cabecera.")
        return result

    fieldnames_lower = [f.strip().lower() for f in reader.fieldnames]
    missing = [h for h in _REQUIRED_HEADERS if h not in fieldnames_lower]
    if missing:
        result.errors.append(f"Columnas obligatorias no encontradas: {', '.join(missing)}")
        return result

    for line_num, raw_row in enumerate(reader, start=2):
        row = {k.strip().lower(): (v.strip() if v else "") for k, v in raw_row.items()}

        try:
            date_str = row.get("fecha", "")
            if not date_str:
                raise ValueError("La columna 'fecha' está vacía.")
            try:
                date = dt.date.fromisoformat(date_str)
            except ValueError:
                raise ValueError(  # noqa: B904
                    f"Fecha inválida: '{date_str}'. Usa el formato YYYY-MM-DD."
                )

            tipo_str = row.get("tipo", "").lower()
            tx_type = _LABEL_TYPE.get(tipo_str)
            if tx_type is None:
                raise ValueError(
                    f"Tipo '{tipo_str}' desconocido. Usa: ingreso, gasto, transferencia."
                )

            concept = row.get("concepto", "")
            if not concept:
                raise ValueError("La columna 'concepto' está vacía.")

            amount_str = row.get("importe", "").replace(",", ".")
            try:
                amount = Decimal(amount_str)
                if amount <= 0:
                    raise ValueError
            except (InvalidOperation, ValueError):
                raise ValueError(f"Importe inválido: '{row.get('importe', '')}'.")  # noqa: B904

            account_name = row.get("cuenta", "").lower()
            account = accounts_by_name.get(account_name)
            if account is None:
                raise ValueError(f"Cuenta '{row.get('cuenta', '')}' no encontrada.")

            transfer_account_id = None
            if tx_type == TransactionType.transfer:
                dest_name = row.get("cuenta_destino", "").lower()
                dest_account = accounts_by_name.get(dest_name)
                if dest_account is None:
                    raise ValueError(
                        f"Cuenta destino '{row.get('cuenta_destino', '')}' no encontrada."
                    )
                if dest_account.id == account.id:
                    raise ValueError("La cuenta origen y destino deben ser distintas.")
                transfer_account_id = dest_account.id

            category_id = None
            subcategory_id = None
            if tx_type != TransactionType.transfer:
                cat_name = row.get("categoria", "").lower()
                if cat_name:
                    cat = categories_by_name.get(cat_name)
                    if cat is None:
                        raise ValueError(f"Categoría '{row.get('categoria', '')}' no encontrada.")
                    category_id = cat.id

                    sub_name = row.get("subcategoria", "").lower()
                    if sub_name:
                        sub = categories_by_name.get(sub_name)
                        if sub is None:
                            raise ValueError(
                                f"Subcategoría '{row.get('subcategoria', '')}' no encontrada."
                            )
                        subcategory_id = sub.id

            data = TransactionCreate(
                date=date,
                type=tx_type,
                concept=concept,
                description=row.get("descripcion") or None,
                amount=amount,
                account_id=account.id,
                transfer_account_id=transfer_account_id,
                category_id=category_id,
                subcategory_id=subcategory_id,
            )
            transaction_service.create_transaction(session, data)
            result.imported += 1

        except Exception as exc:
            result.skipped += 1
            result.errors.append(f"Fila {line_num}: {exc}")

    return result


# ── Layout detection (separator, header row, column roles) ────────────────────

# Banks do not agree on a delimiter: Sabadell writes pipes in its .txt export,
# Spanish spreadsheets favour semicolons and English ones commas.
_SEPARATORS = (";", ",", "\t", "|")

# How many data rows the column-role detection looks at.
_SAMPLE_ROWS = 50
# Share of a column's values that must parse as a date/number to typecast it.
_MATCH_RATIO = 0.8
# Share of rows a column must have filled in before it is worth judging.
_FILL_RATIO = 0.5
# How many parsed rows the dry run sends back for the user to eyeball.
_PREVIEW_ROWS = 50

# Header names we know, best candidate first. Matching is by substring on the
# lowercased header, so "IMPORTE EUR" and "Importe (€)" both match "importe".
_NAME_HINTS: dict[str, tuple[str, ...]] = {
    # The booking date beats the value date: it is when the movement happened.
    "date_col": (
        "f. operativa",
        "fecha operación",
        "fecha operacion",
        "fecha contable",
        "completed date",
        "fecha",
        "date",
        "f. valor",
        "fecha valor",
    ),
    "concept_col": (
        "concepto",
        "descripción",
        "descripcion",
        "description",
        "movimiento",
        "detalle",
        "payee",
        "beneficiario",
    ),
    "amount_col": ("importe", "amount", "cantidad", "monto", "bruto"),
    "type_col": ("tipo", "type", "naturaleza", "debe/haber", "d/h"),
    "category_col": ("subcategoría", "subcategoria", "categoría", "categoria", "category"),
    "description_col": (
        "observaciones",
        "concepto ampliado",
        "comentario",
        "referencia 2",
        "referencia",
        "reference",
        "notes",
    ),
}

# Columns that look like an amount but are not one. Mapping the running balance
# instead of the amount is the classic bank-export mistake.
_AMOUNT_BLACKLIST = (
    "saldo",
    "balance",
    "disponible",
    "comisión",
    "comision",
    "fee",
    "divisa",
    "currency",
)

# Boilerplate Spanish banks put before the merchant or the counterparty. It is
# trimmed off the concept and kept in the description, so the movements table
# reads "MERCADONA GRAN VIA-VALENCIA" instead of the masked card number first.
_CONCEPT_PREFIX = re.compile(
    r"^(?:"
    r"COMPRA\s+TARJ(?:ETA)?\.?\s+[0-9X*][0-9X*_]{3,}"
    r"|(?:PAGO|COMPRA|ABONO)\s+BIZUM"
    r"|BIZUM\s+(?:A|DE)"
    r"|TRANSFERENCIA\s+(?:A\s+FAVOR\s+DE|A|DE)"
    r"|TRANSF\.?\s+(?:A|DE)"
    r"|ADEUDO\s+POR\s+DOMICILIACION(?:\s+DE)?"
    r"|RECIBO(?:\s+DE)?"
    r"|PAGO\s+(?:EN|DE)"
    r"|COMPRA\s+EN"
    r")\s+",
    re.IGNORECASE,
)

# How many distinct uncategorized concepts the result offers to turn into rules.
_RULE_SUGGESTIONS = 8

# Values a mapped type column may hold, in every wording banks use.
_TYPE_ALIASES: dict[str, TransactionType] = {
    **_LABEL_TYPE,
    "ingresos": TransactionType.income,
    "income": TransactionType.income,
    "abono": TransactionType.income,
    "haber": TransactionType.income,
    "h": TransactionType.income,
    "credito": TransactionType.income,
    "crédito": TransactionType.income,
    "entrada": TransactionType.income,
    "gastos": TransactionType.expense,
    "expense": TransactionType.expense,
    "cargo": TransactionType.expense,
    "debe": TransactionType.expense,
    "d": TransactionType.expense,
    "debito": TransactionType.expense,
    "débito": TransactionType.expense,
    "salida": TransactionType.expense,
    "transfer": TransactionType.transfer,
    "traspaso": TransactionType.transfer,
}


@dataclass
class _CsvLayout:
    """How a CSV file is laid out, shared by the preview and the import."""

    separator: str
    has_header: bool
    headers: list[str]
    # (1-based line number in the file, cells) so errors can name the real line.
    rows: list[tuple[int, list[str]]] = field(default_factory=list)


@dataclass
class _ParsedRow:
    """One CSV data row after parsing: a payload, or the reason it cannot load."""

    line: int
    data: TransactionCreate | None = None
    error: str | None = None
    duplicate: bool = False


@dataclass
class _ColumnStats:
    """What the values of one column look like."""

    header: str
    filled: bool
    is_date: bool
    is_number: bool
    monotonic: bool
    distinct: int


def detect_csv(file_bytes: bytes, has_header: bool | None = None) -> CsvPreviewResult:
    """Auto-detect encoding, separator, header row and column roles."""
    layout = _analyze(file_bytes, has_header)
    return CsvPreviewResult(
        encoding=_detect_encoding(file_bytes),
        separator=layout.separator,
        headers=layout.headers,
        preview_rows=[cells for _, cells in layout.rows[:5]],
        has_header=layout.has_header,
        is_native=_is_native(layout),
        suggested=_suggest_mapping(layout),
    )


# ── Mapped import (for external CSVs with custom column mapping) ───────────────


def preview_import_mapped(
    session: Session,
    file_bytes: bytes,
    account_id: int,
    mapping: ColumnMapping,
) -> CsvImportPreview:
    """Dry run: report what the import would do without writing anything."""
    parsed = _prepare(session, file_bytes, account_id, mapping)
    by_id = {c.id: c for c in category_repo.list_all(session)}

    return CsvImportPreview(
        rows=[_preview_row(session, row, by_id) for row in parsed[:_PREVIEW_ROWS]],
        total=len(parsed),
        ready=sum(1 for r in parsed if r.data is not None and not r.duplicate),
        duplicates=sum(1 for r in parsed if r.duplicate),
        errors=sum(1 for r in parsed if r.error is not None),
    )


def import_csv_mapped(
    session: Session,
    file_bytes: bytes,
    account_id: int,
    mapping: ColumnMapping,
) -> CsvImportMappedResult:
    """Import an external CSV using the provided column mapping."""
    result = CsvImportMappedResult(imported=0, skipped=0, uncategorized=0, duplicates=0, errors=[])

    try:
        parsed = _prepare(session, file_bytes, account_id, mapping)
    except NotFoundError as exc:
        result.errors.append(str(exc))
        return result

    if not parsed:
        result.errors.append("El archivo CSV está vacío o no tiene datos.")
        return result

    # Validate row by row so a single bad line is reported by number instead of
    # sinking the whole file, then write what survived in one commit.
    pending: list[Transaction] = []
    for row in parsed:
        if row.error is not None:
            result.skipped += 1
            result.errors.append(f"Fila {row.line}: {row.error}")
            continue
        if row.duplicate:
            # Counted either way: the user is told how many repeats the file
            # carried even when they chose to import them anyway.
            result.duplicates += 1
            if mapping.skip_duplicates:
                continue
        assert row.data is not None
        try:
            built = transaction_service.build_transaction(session, row.data)
        except Exception as exc:
            result.skipped += 1
            result.errors.append(f"Fila {row.line}: {exc}")
            continue
        # The CSV carried no category but a rule filled one in.
        if row.data.category_id is None and built.category_id is not None:
            result.auto_categorized += 1
        pending.append(built)

    try:
        created = transaction_repo.create_many(session, pending)
    except Exception as exc:
        session.rollback()
        result.errors.append(f"No se pudo guardar la importación: {exc}")
        return result

    result.imported = len(created)
    # Rules may have categorized rows on the way in, so ask the saved movements.
    result.uncategorized = sum(1 for tx in created if tx.category_id is None)
    result.uncategorized_concepts = _rule_suggestions(created)
    return result


# ── Private helpers ────────────────────────────────────────────────────────────


def _decode(file_bytes: bytes) -> str:
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return file_bytes.decode(enc)
        except UnicodeDecodeError:
            continue
    return file_bytes.decode("latin-1", errors="replace")


def _detect_encoding(file_bytes: bytes) -> str:
    if file_bytes.startswith(codecs.BOM_UTF8):
        return "utf-8-sig"
    try:
        file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return "latin-1"
    return "utf-8"


def _split(lines: list[str], sep: str) -> list[list[str]]:
    try:
        return list(csv.reader(lines, delimiter=sep))
    except csv.Error:
        return []


def _detect_separator(content: str) -> str:
    """Return the delimiter that splits the file into a consistent grid.

    Each candidate is scored by how many lines agree on a field count; ties go
    to the one yielding more columns, which keeps a semicolon file from being
    read as comma-separated just because its amounts use decimal commas.
    """
    sample = [line for line in content.splitlines()[:20] if line.strip()]
    if not sample:
        return ","

    best, best_score = ",", (0.0, 0)
    for sep in _SEPARATORS:
        counts = [len(row) for row in _split(sample, sep)]
        if not counts:
            continue
        modal, hits = Counter(counts).most_common(1)[0]
        if modal < 2:
            continue
        score = (hits / len(counts), modal)
        if score > best_score:
            best, best_score = sep, score
    return best


def _looks_like_data(row: list[str]) -> bool:
    """True when the row holds values rather than column names."""
    return any(
        _try_date(cell.strip()) is not None or _try_number(cell.strip()) is not None
        for cell in row
        if cell.strip()
    )


def _analyze(file_bytes: bytes, has_header: bool | None = None) -> _CsvLayout:
    """Read the file into a grid, working out its separator and header row.

    *has_header* overrides the detection, so the user can correct it from the
    wizard without the preview and the import disagreeing.
    """
    content = _decode(file_bytes)
    sep = _detect_separator(content)

    numbered = [
        (num, [cell.strip() for cell in cells])
        for num, cells in enumerate(_split(content.splitlines(), sep), start=1)
        if any(cell.strip() for cell in cells)
    ]
    if not numbered:
        return _CsvLayout(separator=sep, has_header=True, headers=[])

    if has_header is None:
        has_header = not _looks_like_data(numbered[0][1])

    if has_header:
        headers, rows = numbered[0][1], numbered[1:]
    else:
        headers = [f"Columna {i}" for i in range(1, max(len(c) for _, c in numbered) + 1)]
        rows = numbered

    return _CsvLayout(separator=sep, has_header=has_header, headers=headers, rows=rows)


def _is_native(layout: _CsvLayout) -> bool:
    """True when the file is a CSV this app exported."""
    if not layout.has_header:
        return False
    lower = {h.lower() for h in layout.headers}
    return all(h in lower for h in _REQUIRED_HEADERS)


def _try_date(value: str) -> dt.date | None:
    try:
        return _parse_date(value, "auto")
    except ValueError:
        return None


def _try_number(value: str) -> Decimal | None:
    try:
        return _to_decimal(value, "auto")
    except ValueError:
        return None


def _is_monotonic(values: list[Decimal]) -> bool:
    """True when the values only ever climb or only ever fall.

    A running balance behaves that way while the amounts beside it do not,
    which is what keeps the 'Saldo' column from being mapped as the amount.
    """
    if len(values) < 3:
        return False
    pairs = list(zip(values, values[1:], strict=False))
    ups = sum(1 for a, b in pairs if b > a)
    downs = sum(1 for a, b in pairs if b < a)
    return max(ups, downs) / len(pairs) >= 0.9


def _column_stats(headers: list[str], rows: list[list[str]]) -> list[_ColumnStats]:
    stats: list[_ColumnStats] = []
    for index, header in enumerate(headers):
        values = [r[index] for r in rows if index < len(r) and r[index]]
        if not values:
            stats.append(_ColumnStats(header, False, False, False, False, 0))
            continue

        filled = len(values) >= 3 and len(values) / len(rows) >= _FILL_RATIO
        dates = sum(1 for v in values if _try_date(v) is not None)
        numbers = [n for n in (_try_number(v) for v in values) if n is not None]
        is_date = filled and dates / len(values) >= _MATCH_RATIO
        is_number = filled and not is_date and len(numbers) / len(values) >= _MATCH_RATIO
        stats.append(
            _ColumnStats(
                header, filled, is_date, is_number, _is_monotonic(numbers), len(set(values))
            )
        )
    return stats


def _suggest_by_name(headers: list[str]) -> dict[str, str]:
    """Match headers against the known names, best-ranked hint winning."""
    picked: dict[str, str] = {}
    used: set[str] = set()
    for field_name, hints in _NAME_HINTS.items():
        best_rank, best_header = len(hints), None
        for header in headers:
            if header in used:
                continue
            low = header.lower()
            if field_name == "amount_col" and any(bad in low for bad in _AMOUNT_BLACKLIST):
                continue
            rank = next((i for i, hint in enumerate(hints) if hint in low), None)
            if rank is not None and rank < best_rank:
                best_rank, best_header = rank, header
        if best_header is not None:
            picked[field_name] = best_header
            used.add(best_header)
    return picked


def _suggest_mapping(layout: _CsvLayout) -> SuggestedMapping:
    """Guess which column plays which role, by header name and by content."""
    picked = _suggest_by_name(layout.headers) if layout.has_header else {}
    suggestion = SuggestedMapping(**picked)

    sample = [cells for _, cells in layout.rows[:_SAMPLE_ROWS]]
    if not sample:
        return suggestion
    stats = _column_stats(layout.headers, sample)

    if suggestion.date_col is None:
        suggestion.date_col = next((s.header for s in stats if s.is_date), None)

    if suggestion.amount_col is None:
        numeric = [s for s in stats if s.is_number and s.header != suggestion.date_col]
        # A running balance climbs steadily; the amounts beside it do not.
        moving = [s for s in numeric if not s.monotonic] or numeric
        suggestion.amount_col = moving[0].header if moving else None

    if suggestion.concept_col is None:
        taken = {suggestion.date_col, suggestion.amount_col}
        text = [
            s
            for s in stats
            if s.filled and not s.is_date and not s.is_number and s.header not in taken
        ]
        # Most distinct values wins; ties keep the leftmost column.
        text.sort(key=lambda s: -s.distinct)
        suggestion.concept_col = text[0].header if text else None

    return suggestion


def _parse_date(val: str, fmt: str) -> dt.date:
    """Try ISO first, then DMY, then MDY.

    DMY is tried before MDY because the app targets Spanish-speaking users
    where DD/MM/YYYY is the standard format.
    """
    if fmt in ("auto", "iso"):
        try:
            return dt.date.fromisoformat(val)
        except ValueError:
            if fmt == "iso":
                raise ValueError(f"Fecha inválida: '{val}'. Se esperaba YYYY-MM-DD.") from None
        # Normalize ISO with slashes (e.g. "2026/07/01") to dashes
        if len(val) >= 10 and val[4] == "/" and val[7] == "/":
            try:
                return dt.date.fromisoformat(val.replace("/", "-"))
            except ValueError:
                pass
    if fmt in ("auto", "dmy"):
        try:
            return dt.datetime.strptime(val, "%d/%m/%Y").date()
        except ValueError:
            if fmt == "dmy":
                raise ValueError(f"Fecha inválida: '{val}'. Se esperaba DD/MM/YYYY.") from None
    if fmt in ("auto", "mdy"):
        try:
            return dt.datetime.strptime(val, "%m/%d/%Y").date()
        except ValueError:
            if fmt == "mdy":
                raise ValueError(f"Fecha inválida: '{val}'. Se esperaba MM/DD/YYYY.") from None
    raise ValueError(f"Fecha inválida: '{val}'.")


def _to_decimal(val: str, decimal_sep: str) -> Decimal:
    """Parse a raw amount string, honouring the chosen decimal separator."""
    v = val.strip()

    # Normalize decimal separator
    if decimal_sep == "comma" or (
        decimal_sep == "auto" and "," in v and v.rfind(",") > v.rfind(".")
    ):
        # comma is the decimal separator: remove thousands dots, replace decimal comma
        v = v.replace(".", "").replace(",", ".")
    else:
        # dot is the decimal separator: remove thousands commas
        v = v.replace(",", "")

    try:
        return Decimal(v)
    except InvalidOperation:
        raise ValueError(f"Importe inválido: '{val}'.") from None


def _parse_amount(
    val: str, decimal_sep: str, sign_convention: str
) -> tuple[Decimal, TransactionType]:
    """Return (absolute_amount, transaction_type) from a raw CSV amount string."""
    amount = _to_decimal(val, decimal_sep)

    if sign_convention == "signed":
        if amount < 0:
            return abs(amount), TransactionType.expense
        return amount, TransactionType.income

    # Fallback: treat as income with positive amount
    if amount <= 0:
        raise ValueError(f"Importe debe ser positivo: '{val}'.")
    return amount, TransactionType.income


def _resolve_type(raw: str, fallback: TransactionType) -> TransactionType:
    """Read the movement type from a mapped column, overriding the sign.

    An empty cell falls back to what the sign of the amount said.
    """
    value = raw.strip().lower()
    if not value:
        return fallback

    declared = _TYPE_ALIASES.get(value)
    if declared is None:
        raise ValueError(f"Tipo '{raw.strip()}' desconocido. Usa: ingreso, gasto o transferencia.")
    if declared == TransactionType.transfer:
        raise ValueError(
            "Las transferencias necesitan una cuenta destino y no se pueden importar "
            "con mapeo de columnas."
        )
    return declared


def _prepare(
    session: Session,
    file_bytes: bytes,
    account_id: int,
    mapping: ColumnMapping,
) -> list[_ParsedRow]:
    """Parse every data row and flag the ones already in the database."""
    account = account_repo.get(session, account_id)
    if account is None:
        raise NotFoundError("Cuenta no encontrada.")

    layout = _analyze(file_bytes, mapping.has_header)
    all_categories = category_repo.list_all(session)
    cats_by_name: dict[str, Category] = {c.name.lower(): c for c in all_categories}

    parsed = [
        _parse_row(
            dict(zip(layout.headers, cells, strict=False)),
            line,
            account_id,
            mapping,
            cats_by_name,
            all_categories,
        )
        for line, cells in layout.rows
    ]
    _mark_duplicates(session, parsed)
    return parsed


def _parse_row(
    row: dict[str, str],
    line: int,
    account_id: int,
    mapping: ColumnMapping,
    cats_by_name: dict[str, Category],
    all_categories: list[Category],
) -> _ParsedRow:
    """Turn one CSV row into a payload, or record why it cannot be imported."""
    try:
        date_val = row.get(mapping.date_col, "")
        if not date_val:
            raise ValueError("La columna de fecha está vacía.")
        date = _parse_date(date_val, mapping.date_format)

        amount_val = row.get(mapping.amount_col, "")
        if not amount_val:
            raise ValueError("La columna de importe está vacía.")
        amount, tx_type = _parse_amount(amount_val, mapping.decimal_sep, mapping.sign_convention)
        if mapping.type_col:
            tx_type = _resolve_type(row.get(mapping.type_col, ""), tx_type)

        concept, prefix = _clean_concept(row.get(mapping.concept_col, ""), mapping.clean_concepts)

        mapped_description = (
            row.get(mapping.description_col, "").strip() if mapping.description_col else ""
        )
        # The trimmed prefix goes here, so nothing of the original line is lost.
        description = " · ".join(part for part in (prefix, mapped_description) if part) or None

        category_id: int | None = None
        subcategory_id: int | None = None
        if mapping.category_col:
            cat_raw = row.get(mapping.category_col, "").strip()
            if cat_raw:
                category_id, subcategory_id = _resolve_category(
                    cat_raw, cats_by_name, all_categories
                )

        return _ParsedRow(
            line=line,
            data=TransactionCreate(
                date=date,
                type=tx_type,
                concept=concept,
                description=description,
                amount=amount,
                account_id=account_id,
                category_id=category_id,
                subcategory_id=subcategory_id,
            ),
        )
    except Exception as exc:
        return _ParsedRow(line=line, error=str(exc))


def _clean_concept(raw: str, clean: bool) -> tuple[str, str | None]:
    """Split a bank concept into the readable part and the boilerplate prefix.

    Statements bury the merchant behind the kind of movement and a masked card
    number. The prefix is returned separately so the caller can keep it in the
    description: nothing from the original line is thrown away.
    """
    concept = " ".join(raw.split())
    if not clean:
        return concept or "(Sin concepto)", None

    match = _CONCEPT_PREFIX.match(concept)
    if match is None:
        return concept or "(Sin concepto)", None

    rest = concept[match.end() :].strip()
    if not rest:
        # The whole concept was the prefix: better to keep it than to blank it.
        return concept, None
    return rest, match.group(0).strip()


def _rule_pattern(concept: str) -> str:
    """Suggest the text a categorization rule should look for.

    The first word is usually the brand ("MERCADONA GRAN VIA-VALENCIA"), which
    is what makes a rule reusable. Rules match by substring, so a short pattern
    keeps working when the branch or the city changes.
    """
    words = concept.split()
    if not words:
        return concept
    if len(words[0]) < 4 and len(words) > 1:
        return f"{words[0]} {words[1]}"
    return words[0]


def _rule_suggestions(transactions: list[Transaction]) -> list[UncategorizedConcept]:
    """Group the movements left without a category by concept, most frequent first."""
    grouped: dict[tuple[str, TransactionType], int] = Counter(
        (tx.concept, tx.type) for tx in transactions if tx.category_id is None
    )
    ranked = sorted(grouped.items(), key=lambda item: (-item[1], item[0][0]))
    return [
        UncategorizedConcept(
            concept=concept,
            type=tx_type,
            count=count,
            suggested_pattern=_rule_pattern(concept),
        )
        for (concept, tx_type), count in ranked[:_RULE_SUGGESTIONS]
    ]


def _signature(
    account_id: int, date: dt.date, tx_type: TransactionType, amount: Decimal, concept: str
) -> tuple[int, dt.date, TransactionType, Decimal, str]:
    """Identity of a movement, for spotting one that is already stored.

    The date must match exactly: a settled movement does not move, and a
    tolerance window would swallow genuine repeats such as a subscription
    charged on consecutive days.
    """
    return (account_id, date, tx_type, amount, " ".join(concept.lower().split()))


def _mark_duplicates(session: Session, parsed: list[_ParsedRow]) -> None:
    """Flag rows whose movement the database already holds.

    Occurrences are counted rather than matched one by one, so a statement that
    genuinely repeats a movement — two identical purchases the same day — keeps
    the second one when only the first is stored.
    """
    dates = [row.data.date for row in parsed if row.data is not None]
    if not dates:
        return

    stored = Counter(
        _signature(tx.account_id, tx.date, tx.type, tx.amount, tx.concept)
        for tx in transaction_repo.list_in_range(session, min(dates), max(dates))
    )
    for row in parsed:
        if row.data is None:
            continue
        key = _signature(
            row.data.account_id, row.data.date, row.data.type, row.data.amount, row.data.concept
        )
        if stored[key] > 0:
            stored[key] -= 1
            row.duplicate = True


def _category_label(
    category_id: int | None, subcategory_id: int | None, by_id: dict[int | None, Category]
) -> str | None:
    parent = by_id.get(category_id) if category_id is not None else None
    if parent is None:
        return None
    child = by_id.get(subcategory_id) if subcategory_id is not None else None
    return f"{parent.name} › {child.name}" if child is not None else parent.name


def _preview_row(
    session: Session, row: _ParsedRow, by_id: dict[int | None, Category]
) -> ImportPreviewRow:
    if row.data is None:
        return ImportPreviewRow(line=row.line, error=row.error)

    # Ask the same resolver the import uses, so the rules show up here too.
    category_id, subcategory_id = transaction_service.resolve_category(session, row.data)
    return ImportPreviewRow(
        line=row.line,
        date=row.data.date.isoformat(),
        type=row.data.type,
        concept=row.data.concept,
        amount=str(row.data.amount),
        category=_category_label(category_id, subcategory_id, by_id),
        duplicate=row.duplicate,
    )


def _resolve_category(
    cat_raw: str,
    cats_by_name: dict[str, Category],
    all_categories: list[Category],
) -> tuple[int | None, int | None]:
    """Resolve 'Parent:Child' or 'Name' to (category_id, subcategory_id).

    When *Name* matches a subcategory directly (e.g. 'Supermercado' instead of
    'Alimentación:Supermercado') the function detects it and returns the parent
    as ``category_id`` and the subcategory as ``subcategory_id``.

    Returns (None, None) when no match is found — caller treats as uncategorized.
    """
    if ":" in cat_raw:
        parent_name, child_name = (p.strip() for p in cat_raw.split(":", 1))
        parent = cats_by_name.get(parent_name.lower())
        if parent is None:
            return None, None
        child = next(
            (
                c
                for c in all_categories
                if c.parent_id == parent.id and c.name.lower() == child_name.lower()
            ),
            None,
        )
        return parent.id, (child.id if child else None)

    cat = cats_by_name.get(cat_raw.lower())
    if cat is None:
        return None, None
    if cat.parent_id is not None:
        return cat.parent_id, cat.id
    return cat.id, None
