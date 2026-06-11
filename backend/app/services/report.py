"""PDF report generation service."""

import datetime as dt
from decimal import Decimal
from io import BytesIO
from pathlib import Path

from fpdf import FPDF
from sqlmodel import Session

from app.models.enums import TransactionType
from app.repositories import category as category_repo
from app.repositories import transaction as transaction_repo
from app.services.periods import period_range

_FONTS_DIR = Path(__file__).parent.parent / "resources" / "fonts"

MONTH_NAMES = [
    "",
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
]


def _fmt_money(amount: Decimal) -> str:
    formatted = f"{abs(amount):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{formatted} EUR"


def _period_label(year: int, month: int | None) -> str:
    if month is None:
        return str(year)
    return f"{MONTH_NAMES[month]} {year}"


class _FinAppPDF(FPDF):
    def __init__(self, period_label: str) -> None:
        super().__init__()
        self._period_label = period_label
        self.add_font("DejaVu", fname=str(_FONTS_DIR / "DejaVuSans.ttf"))
        self.add_font("DejaVu", style="B", fname=str(_FONTS_DIR / "DejaVuSans-Bold.ttf"))

    def header(self) -> None:
        self.set_font("DejaVu", style="B", size=16)
        self.set_text_color(30, 30, 30)
        self.cell(0, 10, "FinApp — Informe Financiero", align="C", new_x="LMARGIN", new_y="NEXT")
        self.set_font("DejaVu", size=10)
        self.set_text_color(100, 100, 100)
        self.cell(0, 6, self._period_label, align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(4)
        self.set_draw_color(200, 200, 200)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(6)

    def footer(self) -> None:
        self.set_y(-15)
        self.set_font("DejaVu", size=8)
        self.set_text_color(150, 150, 150)
        generated = dt.datetime.now().strftime("%d/%m/%Y %H:%M")
        self.cell(0, 10, f"Generado el {generated}  ·  Pág. {self.page_no()}", align="C")


def _section_title(pdf: _FinAppPDF, title: str) -> None:
    pdf.set_font("DejaVu", style="B", size=12)
    pdf.set_text_color(30, 30, 30)
    pdf.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(200, 200, 200)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(4)


def _kpi_row(pdf: _FinAppPDF, label: str, amount: Decimal, *, positive_green: bool = True) -> None:
    pdf.set_font("DejaVu", size=10)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(60, 8, label)
    pdf.set_font("DejaVu", style="B", size=10)
    is_positive = amount >= 0
    if positive_green:
        pdf.set_text_color(34, 197, 94) if is_positive else pdf.set_text_color(239, 68, 68)
    else:
        pdf.set_text_color(30, 30, 30)
    sign = "+" if amount > 0 else ""
    pdf.cell(0, 8, f"{sign}{_fmt_money(amount)}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(30, 30, 30)


def generate_pdf(session: Session, year: int, month: int | None) -> bytes:
    start, end = period_range(year, month)

    income = transaction_repo.total_by_type(session, TransactionType.income, start, end)
    expense = transaction_repo.total_by_type(session, TransactionType.expense, start, end)
    balance = income - expense

    categories = {c.id: c for c in category_repo.list_all(session)}
    expense_by_cat = transaction_repo.sum_by_category(session, TransactionType.expense, start, end)
    income_by_cat = transaction_repo.sum_by_category(session, TransactionType.income, start, end)

    transactions = transaction_repo.list_(session, start, end)
    transactions_sorted = sorted(transactions, key=lambda t: t.date)

    period_label = _period_label(year, month)
    pdf = _FinAppPDF(period_label)
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # ── KPIs ─────────────────────────────────────────────────────────────────
    _section_title(pdf, "Resumen del periodo")
    _kpi_row(pdf, "Ingresos", income, positive_green=False)
    _kpi_row(pdf, "Gastos", -expense, positive_green=True)
    _kpi_row(pdf, "Balance", balance, positive_green=True)
    pdf.ln(6)

    # ── Gastos por categoría ─────────────────────────────────────────────────
    if expense_by_cat:
        _section_title(pdf, "Gastos por categoría")
        col_w = [90, 40, 40]
        headers = ["Categoría", "Importe", "% del total"]
        pdf.set_font("DejaVu", style="B", size=9)
        pdf.set_fill_color(245, 245, 245)
        pdf.set_text_color(60, 60, 60)
        for header, w in zip(headers, col_w, strict=True):
            pdf.cell(w, 7, header, border="B", fill=True)
        pdf.ln()
        pdf.set_font("DejaVu", size=9)
        pdf.set_text_color(30, 30, 30)
        for category_id, total in expense_by_cat:
            name = categories[category_id].name if category_id in categories else "Sin categoría"
            pct = round(float(total / expense * 100), 1) if expense > 0 else 0.0
            pdf.cell(col_w[0], 6, name)
            pdf.cell(col_w[1], 6, _fmt_money(total))
            pdf.cell(col_w[2], 6, f"{pct}%", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(6)

    # ── Ingresos por categoría ───────────────────────────────────────────────
    if income_by_cat:
        _section_title(pdf, "Ingresos por categoría")
        col_w = [90, 40, 40]
        headers = ["Categoría", "Importe", "% del total"]
        pdf.set_font("DejaVu", style="B", size=9)
        pdf.set_fill_color(245, 245, 245)
        pdf.set_text_color(60, 60, 60)
        for header, w in zip(headers, col_w, strict=True):
            pdf.cell(w, 7, header, border="B", fill=True)
        pdf.ln()
        pdf.set_font("DejaVu", size=9)
        pdf.set_text_color(30, 30, 30)
        for category_id, total in income_by_cat:
            name = categories[category_id].name if category_id in categories else "Sin categoría"
            pct = round(float(total / income * 100), 1) if income > 0 else 0.0
            pdf.cell(col_w[0], 6, name)
            pdf.cell(col_w[1], 6, _fmt_money(total))
            pdf.cell(col_w[2], 6, f"{pct}%", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(6)

    # ── Lista de movimientos ─────────────────────────────────────────────────
    if transactions_sorted:
        _section_title(pdf, "Movimientos del periodo")
        col_w = [22, 64, 50, 40]
        headers = ["Fecha", "Concepto", "Categoría", "Importe"]
        pdf.set_font("DejaVu", style="B", size=9)
        pdf.set_fill_color(245, 245, 245)
        pdf.set_text_color(60, 60, 60)
        for header, w in zip(headers, col_w, strict=True):
            pdf.cell(w, 7, header, border="B", fill=True)
        pdf.ln()
        pdf.set_font("DejaVu", size=8)
        for tx in transactions_sorted:
            cat_name = ""
            if tx.category_id and tx.category_id in categories:
                cat_name = categories[tx.category_id].name
            concept = tx.concept[:34] + "…" if len(tx.concept) > 35 else tx.concept
            date_str = tx.date.strftime("%d/%m/%y")
            if tx.type == TransactionType.expense:
                amount_str = f"-{_fmt_money(tx.amount)}"
                pdf.set_text_color(239, 68, 68)
            elif tx.type == TransactionType.income:
                amount_str = f"+{_fmt_money(tx.amount)}"
                pdf.set_text_color(34, 197, 94)
            else:
                amount_str = _fmt_money(tx.amount)
                pdf.set_text_color(80, 80, 80)
            pdf.set_text_color(30, 30, 30)
            pdf.cell(col_w[0], 5.5, date_str)
            pdf.cell(col_w[1], 5.5, concept)
            pdf.cell(col_w[2], 5.5, cat_name)
            if tx.type == TransactionType.expense:
                pdf.set_text_color(239, 68, 68)
            elif tx.type == TransactionType.income:
                pdf.set_text_color(34, 197, 94)
            pdf.cell(col_w[3], 5.5, amount_str, new_x="LMARGIN", new_y="NEXT")
            pdf.set_text_color(30, 30, 30)

    buf = BytesIO()
    pdf.output(buf)
    return buf.getvalue()
