"""Schemas for CSV preview and mapped import."""

from pydantic import BaseModel, Field

from app.models.enums import TransactionType


class SuggestedMapping(BaseModel):
    """Best guess for each app field, produced by the auto-detection.

    Every field is optional: the detection fills in what it recognises and
    leaves the rest for the user to choose in the wizard.
    """

    date_col: str | None = None
    concept_col: str | None = None
    amount_col: str | None = None
    description_col: str | None = None
    category_col: str | None = None
    type_col: str | None = None


class CsvPreviewResult(BaseModel):
    encoding: str
    separator: str
    headers: list[str]
    preview_rows: list[list[str]]
    # False when the file starts straight into data (e.g. the Sabadell .txt
    # export); *headers* then holds generated names ("Columna 1", "Columna 2"…).
    has_header: bool = True
    # True when the file is a CSV exported by FinApp itself, which carries its
    # own type/account/category columns and is imported without mapping.
    is_native: bool = False
    suggested: SuggestedMapping = Field(default_factory=SuggestedMapping)


class ColumnMapping(BaseModel):
    date_col: str
    concept_col: str
    amount_col: str
    description_col: str | None = None
    category_col: str | None = None
    # Column holding the movement type (ingreso/gasto, Debe/Haber, cargo/abono…).
    # When mapped it wins over the sign of the amount.
    type_col: str | None = None
    date_format: str = "auto"  # "auto" | "iso" | "mdy" | "dmy"
    decimal_sep: str = "auto"  # "auto" | "dot" | "comma"
    sign_convention: str = "signed"  # "signed": negative→expense, positive→income
    has_header: bool | None = None  # None: detect it the same way the preview did
    # Leave out rows already stored. Bank exports go by date range and users
    # overlap them, so re-importing must not duplicate what is already there.
    skip_duplicates: bool = True
    # Trim the boilerplate banks put before the merchant ("COMPRA TARJ. <card>")
    # and keep it in the description instead.
    clean_concepts: bool = True


class UncategorizedConcept(BaseModel):
    """A concept that came in without a category, and a rule that would fix it."""

    concept: str
    type: TransactionType
    count: int
    suggested_pattern: str


class CsvImportMappedResult(BaseModel):
    imported: int
    skipped: int
    uncategorized: int
    errors: list[str]
    # Rows left out because the movement was already stored.
    duplicates: int = 0
    # Rows an existing rule categorized on the way in.
    auto_categorized: int = 0
    # The concepts behind `uncategorized`, so the user can turn them into rules.
    uncategorized_concepts: list[UncategorizedConcept] = Field(default_factory=list)


class ImportPreviewRow(BaseModel):
    """One CSV line as it would be stored, before anything is written."""

    line: int  # line number in the file, so errors can be traced back
    date: str | None = None
    type: TransactionType | None = None
    concept: str = ""
    amount: str | None = None  # Decimal as string: never a float for money
    category: str | None = None  # "Padre › Hijo", including what a rule assigns
    duplicate: bool = False
    error: str | None = None


class CsvImportPreview(BaseModel):
    """Dry run of an import: what would happen, without touching the database."""

    rows: list[ImportPreviewRow]  # capped sample, see `total` for the real count
    total: int
    ready: int
    duplicates: int
    errors: int
