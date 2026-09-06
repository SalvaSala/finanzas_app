"""Schemas for CSV preview and mapped import."""

from pydantic import BaseModel, Field


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


class CsvImportMappedResult(BaseModel):
    imported: int
    skipped: int
    uncategorized: int
    errors: list[str]
