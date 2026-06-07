"""Helpers to turn a (year, month) selector into an inclusive date range."""

import datetime as dt


def period_range(year: int, month: int | None) -> tuple[dt.date, dt.date]:
    """Return the inclusive ``(start, end)`` dates for a year or a single month.

    ``month=None`` covers the whole year; otherwise just that month.
    """
    if month is None:
        return dt.date(year, 1, 1), dt.date(year, 12, 31)

    start = dt.date(year, month, 1)
    if month == 12:
        end = dt.date(year, 12, 31)
    else:
        end = dt.date(year, month + 1, 1) - dt.timedelta(days=1)
    return start, end
