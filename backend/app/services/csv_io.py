"""CSV import and export for transactions."""

import csv
import datetime as dt
import io
from decimal import Decimal, InvalidOperation

from sqlmodel import Session

from app.models import Category, Transaction
from app.models.enums import TransactionType
from app.repositories import account as account_repo
from app.repositories import category as category_repo
from app.schemas.csv import ColumnMapping, CsvImportMappedResult, CsvPreviewResult
from app.schemas.transaction import TransactionCreate
from app.services.transaction import create_transaction

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


# ── Legacy import (app-native CSV) ────────────────────────────────────────────


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
    missing = [h for h in _HEADERS[:6] if h not in fieldnames_lower]
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
            create_transaction(session, data)
            result.imported += 1

        except Exception as exc:
            result.skipped += 1
            result.errors.append(f"Fila {line_num}: {exc}")

    return result


# ── CSV detection (for external CSVs) ─────────────────────────────────────────


def detect_csv(file_bytes: bytes) -> CsvPreviewResult:
    """Auto-detect encoding, separator and return headers + first 5 rows."""
    content = _decode(file_bytes)
    sep = _detect_separator(content)

    reader = csv.reader(io.StringIO(content), delimiter=sep)
    rows = list(reader)
    if not rows:
        return CsvPreviewResult(encoding="utf-8", separator=sep, headers=[], preview_rows=[])

    headers = [h.strip() for h in rows[0]]
    preview_rows = [[cell.strip() for cell in row] for row in rows[1:6]]

    encoding = "utf-8"
    for enc in ("utf-8", "utf-8-sig"):
        try:
            file_bytes.decode(enc)
            encoding = enc
            break
        except UnicodeDecodeError:
            encoding = "latin-1"

    return CsvPreviewResult(
        encoding=encoding,
        separator=sep,
        headers=headers,
        preview_rows=preview_rows,
    )


# ── Mapped import (for external CSVs with custom column mapping) ───────────────


def import_csv_mapped(
    session: Session,
    file_bytes: bytes,
    account_id: int,
    mapping: ColumnMapping,
) -> CsvImportMappedResult:
    """Import an external CSV using the provided column mapping."""
    content = _decode(file_bytes)
    sep = _detect_separator(content)

    account = account_repo.get(session, account_id)
    if account is None:
        return CsvImportMappedResult(
            imported=0, skipped=0, uncategorized=0, errors=["Cuenta no encontrada."]
        )

    all_categories = category_repo.list_all(session)
    cats_by_name: dict[str, Category] = {c.name.lower(): c for c in all_categories}

    result = CsvImportMappedResult(imported=0, skipped=0, uncategorized=0, errors=[])

    reader = csv.DictReader(io.StringIO(content), delimiter=sep)
    if reader.fieldnames is None:
        result.errors.append("El archivo CSV está vacío o no tiene cabecera.")
        return result

    for line_num, raw_row in enumerate(reader, start=2):
        row = {k.strip(): (v.strip() if v else "") for k, v in raw_row.items()}

        try:
            date_val = row.get(mapping.date_col, "")
            if not date_val:
                raise ValueError("La columna de fecha está vacía.")
            date = _parse_date(date_val, mapping.date_format)

            amount_val = row.get(mapping.amount_col, "")
            if not amount_val:
                raise ValueError("La columna de importe está vacía.")
            amount, tx_type = _parse_amount(
                amount_val, mapping.decimal_sep, mapping.sign_convention
            )

            concept = row.get(mapping.concept_col, "").strip() or "(Sin concepto)"

            description: str | None = None
            if mapping.description_col:
                description = row.get(mapping.description_col) or None

            category_id: int | None = None
            subcategory_id: int | None = None
            had_category_col = bool(mapping.category_col)
            if had_category_col:
                cat_raw = row.get(mapping.category_col or "", "").strip()
                if cat_raw:
                    category_id, subcategory_id = _resolve_category(
                        cat_raw, cats_by_name, all_categories
                    )

            data = TransactionCreate(
                date=date,
                type=tx_type,
                concept=concept,
                description=description,
                amount=amount,
                account_id=account.id,
                category_id=category_id,
                subcategory_id=subcategory_id,
            )
            create_transaction(session, data)
            result.imported += 1
            if had_category_col and category_id is None:
                result.uncategorized += 1

        except Exception as exc:
            result.skipped += 1
            result.errors.append(f"Fila {line_num}: {exc}")

    return result


# ── Private helpers ────────────────────────────────────────────────────────────


def _decode(file_bytes: bytes) -> str:
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return file_bytes.decode(enc)
        except UnicodeDecodeError:
            continue
    return file_bytes.decode("latin-1", errors="replace")


def _detect_separator(content: str) -> str:
    sample = "\n".join(content.splitlines()[:5])
    return ";" if sample.count(";") >= sample.count(",") else ","


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


def _parse_amount(
    val: str, decimal_sep: str, sign_convention: str
) -> tuple[Decimal, TransactionType]:
    """Return (absolute_amount, transaction_type) from a raw CSV amount string."""
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
        amount = Decimal(v)
    except InvalidOperation:
        raise ValueError(f"Importe inválido: '{val}'.") from None

    if sign_convention == "signed":
        if amount < 0:
            return abs(amount), TransactionType.expense
        return amount, TransactionType.income

    # Fallback: treat as income with positive amount
    if amount <= 0:
        raise ValueError(f"Importe debe ser positivo: '{val}'.")
    return amount, TransactionType.income


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
