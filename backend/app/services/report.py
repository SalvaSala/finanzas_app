"""PDF report generation service."""

import datetime as dt
import math
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
MONTH_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

# Colores de reserva cuando una categoría no tiene color asignado
_FALLBACK_RGB: list[tuple[int, int, int]] = [
    (99, 102, 241),
    (249, 115, 22),
    (20, 184, 166),
    (244, 63, 94),
    (139, 92, 246),
    (234, 179, 8),
    (6, 182, 212),
    (132, 204, 16),
    (236, 72, 153),
    (100, 116, 139),
]


# ── Helpers ──────────────────────────────────────────────────────────────────


def _fmt_money(amount: Decimal) -> str:
    formatted = f"{abs(amount):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{formatted} €"


def _period_label(year: int, month: int | None) -> str:
    if month is None:
        return str(year)
    return f"{MONTH_NAMES[month]} {year}"


def _hex_to_rgb(
    hex_color: str | None,
    fallback: tuple[int, int, int],
) -> tuple[int, int, int]:
    """Convert a CSS hex color (#rrggbb) to an (r, g, b) tuple."""
    if hex_color and hex_color.startswith("#") and len(hex_color) == 7:
        try:
            return int(hex_color[1:3], 16), int(hex_color[3:5], 16), int(hex_color[5:7], 16)
        except ValueError:
            pass
    return fallback


# ── PDF class ─────────────────────────────────────────────────────────────────


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


# ── Section helpers ───────────────────────────────────────────────────────────


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


# ── Chart drawing ─────────────────────────────────────────────────────────────


def _draw_pie_chart(
    pdf: _FinAppPDF,
    items: list[tuple[str, Decimal, str | None]],
    total: Decimal,
) -> None:
    """Draw a pie chart with a legend to its right.

    ``items`` is a list of ``(name, amount, hex_color)`` tuples, already
    sorted by amount descending. ``total`` is the sum of all amounts.
    """
    if not items or total == 0:
        return

    # Geometry
    cx = pdf.l_margin + 42.0  # centre X of the pie
    top_y = pdf.get_y()
    cy = top_y + 40.0  # centre Y
    r = 36.0  # radius

    # Draw each slice as a polygon approximating the arc
    angle = -90.0  # start from the top
    for i, (_, amount, color_hex) in enumerate(items):
        rgb = _hex_to_rgb(color_hex, _FALLBACK_RGB[i % len(_FALLBACK_RGB)])
        pdf.set_fill_color(*rgb)
        sweep = 360.0 * float(amount) / float(total)
        steps = max(int(abs(sweep) / 2), 6)
        points: list[tuple[float, float]] = [(cx, cy)]
        for j in range(steps + 1):
            a = math.radians(angle + sweep * j / steps)
            points.append((cx + r * math.cos(a), cy + r * math.sin(a)))
        pdf.polygon(points, style="F")
        angle += sweep

    # Thin white separators between slices for visual clarity
    pdf.set_draw_color(255, 255, 255)
    pdf.set_line_width(0.4)
    angle = -90.0
    for _, amount, _ in items:
        sweep = 360.0 * float(amount) / float(total)
        steps = max(int(abs(sweep) / 2), 6)
        points = [(cx, cy)]
        for j in range(steps + 1):
            a = math.radians(angle + sweep * j / steps)
            points.append((cx + r * math.cos(a), cy + r * math.sin(a)))
        pdf.polygon(points, style="D")
        angle += sweep
    pdf.set_line_width(0.2)

    # Legend to the right of the pie
    legend_x = pdf.l_margin + 88.0
    legend_y = top_y + 4.0
    item_h = 7.5

    for i, (name, amount, color_hex) in enumerate(items):
        rgb = _hex_to_rgb(color_hex, _FALLBACK_RGB[i % len(_FALLBACK_RGB)])
        pdf.set_fill_color(*rgb)
        pdf.rect(legend_x, legend_y + i * item_h + 1.0, 4.0, 3.5, style="F")

        pct = round(float(amount / total * 100), 1) if total > 0 else 0.0
        short_name = (name[:21] + "…") if len(name) > 22 else name
        pdf.set_font("DejaVu", size=8)
        pdf.set_text_color(30, 30, 30)
        pdf.set_xy(legend_x + 6.5, legend_y + i * item_h)
        pdf.cell(100, item_h, f"{short_name}")
        pdf.set_xy(legend_x + 6.5 + 60, legend_y + i * item_h)
        pdf.set_text_color(80, 80, 80)
        pdf.cell(30, item_h, f"{pct}%", align="R")

    # Advance cursor below the chart
    pdf.set_y(cy + r + 8.0)
    pdf.set_draw_color(200, 200, 200)


def _draw_monthly_bars(
    pdf: _FinAppPDF,
    monthly_data: list[tuple[int, float, float]],
) -> None:
    """Draw a grouped bar chart (income green / expense red) for each month.

    ``monthly_data`` is a list of ``(month_number, income_float, expense_float)``
    for months 1-12.
    """
    max_val = max((max(inc, exp) for _, inc, exp in monthly_data), default=0.0)
    if max_val == 0:
        return

    area_x = pdf.l_margin
    area_y = pdf.get_y()
    area_w = pdf.w - pdf.l_margin - pdf.r_margin
    area_h = 48.0

    slot_w = area_w / 12
    bar_w = slot_w * 0.34

    for i, (_, inc, exp) in enumerate(monthly_data):
        bx = area_x + i * slot_w

        # Income bar (green)
        if inc > 0:
            ih = area_h * inc / max_val
            pdf.set_fill_color(34, 197, 94)
            pdf.rect(bx + slot_w * 0.06, area_y + area_h - ih, bar_w, ih, style="F")

        # Expense bar (red)
        if exp > 0:
            eh = area_h * exp / max_val
            pdf.set_fill_color(239, 68, 68)
            pdf.rect(bx + slot_w * 0.52, area_y + area_h - eh, bar_w, eh, style="F")

        # Month label below the bars
        pdf.set_font("DejaVu", size=7)
        pdf.set_text_color(100, 100, 100)
        pdf.set_xy(bx, area_y + area_h + 1.5)
        pdf.cell(slot_w, 4, MONTH_SHORT[i], align="C")

    # Legend
    legend_y = area_y + area_h + 8.0
    pdf.set_fill_color(34, 197, 94)
    pdf.rect(area_x, legend_y, 4.0, 3.0, style="F")
    pdf.set_font("DejaVu", size=8)
    pdf.set_text_color(80, 80, 80)
    pdf.set_xy(area_x + 6.0, legend_y - 0.5)
    pdf.cell(25, 4.5, "Ingresos")

    pdf.set_fill_color(239, 68, 68)
    pdf.rect(area_x + 36.0, legend_y, 4.0, 3.0, style="F")
    pdf.set_xy(area_x + 42.0, legend_y - 0.5)
    pdf.cell(25, 4.5, "Gastos")

    pdf.set_y(legend_y + 10.0)
    pdf.set_draw_color(200, 200, 200)


# ── Public entry point ────────────────────────────────────────────────────────


def generate_pdf(session: Session, year: int, month: int | None) -> bytes:
    start, end = period_range(year, month)

    income = transaction_repo.total_by_type(session, TransactionType.income, start, end)
    expense = transaction_repo.total_by_type(session, TransactionType.expense, start, end)
    balance = income - expense

    categories = {c.id: c for c in category_repo.list_all(session)}
    expense_by_cat = transaction_repo.sum_by_category(session, TransactionType.expense, start, end)
    income_by_cat = transaction_repo.sum_by_category(session, TransactionType.income, start, end)

    # Monthly breakdown for bar chart (only needed in year view)
    monthly_data: list[tuple[int, float, float]] | None = None
    if month is None:
        monthly_data = []
        for m in range(1, 13):
            s, e = period_range(year, m)
            inc = transaction_repo.total_by_type(session, TransactionType.income, s, e)
            exp = transaction_repo.total_by_type(session, TransactionType.expense, s, e)
            monthly_data.append((m, float(inc), float(exp)))

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

    # ── Pie chart: distribución de gastos ────────────────────────────────────
    if expense_by_cat and expense > 0:
        _section_title(pdf, "Distribución de gastos")
        pie_items = [
            (
                categories[cid].name if cid in categories else "Sin categoría",
                total,
                categories[cid].color if cid in categories else None,
            )
            for cid, total in expense_by_cat[:8]  # top 8 for readability
        ]
        _draw_pie_chart(pdf, pie_items, expense)

    # ── Bar chart: evolución mensual (year view only) ─────────────────────────
    if monthly_data and any(inc > 0 or exp > 0 for _, inc, exp in monthly_data):
        _section_title(pdf, "Evolución mensual")
        _draw_monthly_bars(pdf, monthly_data)

    # ── Gastos por categoría (table) ─────────────────────────────────────────
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

    # ── Ingresos por categoría (table) ───────────────────────────────────────
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
            elif tx.type == TransactionType.income:
                amount_str = f"+{_fmt_money(tx.amount)}"
            else:
                amount_str = _fmt_money(tx.amount)
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
