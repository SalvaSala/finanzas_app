"""Dashboard / KPIs endpoints."""

import datetime as dt

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.core.db import get_session
from app.schemas import DashboardSummary, MonthlyStats
from app.services import dashboard as dashboard_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def get_summary(
    year: int | None = Query(default=None),
    month: int | None = Query(default=None, ge=1, le=12),
    session: Session = Depends(get_session),
) -> DashboardSummary:
    resolved_year = year if year is not None else dt.date.today().year
    return dashboard_service.get_summary(session, resolved_year, month)


@router.get("/monthly", response_model=list[MonthlyStats])
def get_monthly(
    year: int | None = Query(default=None),
    session: Session = Depends(get_session),
) -> list[MonthlyStats]:
    resolved_year = year if year is not None else dt.date.today().year
    return dashboard_service.get_monthly_breakdown(session, resolved_year)
