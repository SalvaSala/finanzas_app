"""CSV import and export for transactions."""

import csv
import io
from decimal import Decimal, InvalidOperation

from sqlmodel import Session

from app.models import Transaction
from app.models.enums import TransactionType
from app.repositories import account as account_repo
from app.repositories import category as category_repo
from app.schemas.transaction import TransactionCreate
from app.services.transaction import create_transaction

# ── Column names in the CSV (Spanish, user-facing) ────────────────────────

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


# ── Export ─────────────────────────────────────────────────────────────────


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


# ── Import ─────────────────────────────────────────────────────────────────


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
    """Parse CSV content and import valid rows as transactions."""
    result = ImportResult()

    accounts_by_name = {a.name.lower(): a for a in account_repo.list_all(session)}
    categories_by_name = {c.name.lower(): c for c in category_repo.list_all(session)}

    reader = csv.DictReader(io.StringIO(content))

    if reader.fieldnames is None:
        result.errors.append("El archivo CSV está vacío o no tiene cabecera.")
        return result

    # Normalize header names
    fieldnames_lower = [f.strip().lower() for f in reader.fieldnames]
    missing = [h for h in _HEADERS[:6] if h not in fieldnames_lower]  # first 6 required
    if missing:
        result.errors.append(f"Columnas obligatorias no encontradas: {', '.join(missing)}")
        return result

    for line_num, raw_row in enumerate(reader, start=2):
        row = {k.strip().lower(): (v.strip() if v else "") for k, v in raw_row.items()}

        try:
            # --- date ---
            date_str = row.get("fecha", "")
            if not date_str:
                raise ValueError("La columna 'fecha' está vacía.")
            import datetime as dt

            try:
                date = dt.date.fromisoformat(date_str)
            except ValueError:
                raise ValueError(  # noqa: B904
                    f"Fecha inválida: '{date_str}'. Usa el formato YYYY-MM-DD."
                )

            # --- type ---
            tipo_str = row.get("tipo", "").lower()
            tx_type = _LABEL_TYPE.get(tipo_str)
            if tx_type is None:
                raise ValueError(
                    f"Tipo '{tipo_str}' desconocido. Usa: ingreso, gasto, transferencia."
                )

            # --- concept ---
            concept = row.get("concepto", "")
            if not concept:
                raise ValueError("La columna 'concepto' está vacía.")

            # --- amount ---
            amount_str = row.get("importe", "").replace(",", ".")
            try:
                amount = Decimal(amount_str)
                if amount <= 0:
                    raise ValueError
            except (InvalidOperation, ValueError):
                raise ValueError(f"Importe inválido: '{row.get('importe', '')}'.")  # noqa: B904

            # --- account ---
            account_name = row.get("cuenta", "").lower()
            account = accounts_by_name.get(account_name)
            if account is None:
                raise ValueError(f"Cuenta '{row.get('cuenta', '')}' no encontrada.")

            # --- transfer_account ---
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

            # --- category ---
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
