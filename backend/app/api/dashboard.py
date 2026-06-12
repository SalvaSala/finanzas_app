"""Dashboard / KPIs endpoints."""

import datetime as dt
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.core.db import get_session
from app.schemas import CategoryAmount, DashboardSummary, MonthlyStats
from app.schemas.dashboard import BalancePoint, DayAmount, SankeyData, TreemapData
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


@router.get("/treemap", response_model=TreemapData)
def get_treemap(
    year: int | None = Query(default=None),
    month: int | None = Query(default=None, ge=1, le=12),
    session: Session = Depends(get_session),
) -> TreemapData:
    resolved_year = year if year is not None else dt.date.today().year
    return dashboard_service.get_treemap(session, resolved_year, month)


@router.get("/calendar", response_model=list[DayAmount])
def get_calendar(
    year: int | None = Query(default=None),
    session: Session = Depends(get_session),
) -> list[DayAmount]:
    resolved_year = year if year is not None else dt.date.today().year
    return dashboard_service.get_calendar(session, resolved_year)


@router.get("/sankey", response_model=SankeyData)
def get_sankey(
    year: int | None = Query(default=None),
    month: int | None = Query(default=None, ge=1, le=12),
    session: Session = Depends(get_session),
) -> SankeyData:
    resolved_year = year if year is not None else dt.date.today().year
    return dashboard_service.get_sankey(session, resolved_year, month)


@router.get("/balance-history", response_model=list[BalancePoint])
def get_balance_history(
    period: Literal["1M", "3M", "1A", "5A"] = Query(default="1A"),
    session: Session = Depends(get_session),
) -> list[BalancePoint]:
    return dashboard_service.get_balance_history(session, period)


@router.get("/categories/{category_id}/breakdown", response_model=list[CategoryAmount])
def get_subcategory_breakdown(
    category_id: int,
    year: int | None = Query(default=None),
    month: int | None = Query(default=None, ge=1, le=12),
    session: Session = Depends(get_session),
) -> list[CategoryAmount]:
    resolved_year = year if year is not None else dt.date.today().year
    return dashboard_service.get_subcategory_breakdown(session, resolved_year, month, category_id)
