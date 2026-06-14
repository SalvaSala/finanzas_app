"""Schemas for CSV preview and mapped import."""

from pydantic import BaseModel


class CsvPreviewResult(BaseModel):
    encoding: str
    separator: str
    headers: list[str]
    preview_rows: list[list[str]]


class ColumnMapping(BaseModel):
    date_col: str
    concept_col: str
    amount_col: str
    description_col: str | None = None
    category_col: str | None = None
    date_format: str = "auto"  # "auto" | "iso" | "mdy" | "dmy"
    decimal_sep: str = "auto"  # "auto" | "dot" | "comma"
    sign_convention: str = "signed"  # "signed": negative→expense, positive→income


class CsvImportMappedResult(BaseModel):
    imported: int
    skipped: int
    uncategorized: int
    errors: list[str]
