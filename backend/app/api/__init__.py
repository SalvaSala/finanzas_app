"""REST API routers. Everything is mounted under the ``/api`` prefix."""

from __future__ import annotations

from fastapi import APIRouter

from app.api import (
    accounts,
    budgets,
    categories,
    categorization_rules,
    dashboard,
    health,
    recurring,
    savings_goals,
    tags,
    transactions,
)

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(accounts.router)
api_router.include_router(categories.router)
api_router.include_router(transactions.router)
api_router.include_router(dashboard.router)
api_router.include_router(budgets.router)
api_router.include_router(recurring.router)
api_router.include_router(tags.router)
api_router.include_router(savings_goals.router)
api_router.include_router(categorization_rules.router)
