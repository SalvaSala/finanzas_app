"""Tests for the savings goal service (CRUD + contribute)."""

import datetime as dt
from decimal import Decimal

import pytest
from sqlmodel import Session

from app.schemas.savings_goal import (
    SavingsGoalContribute,
    SavingsGoalCreate,
    SavingsGoalUpdate,
)
from app.services import savings_goal as service
from app.services.exceptions import NotFoundError


def test_create_and_list(session: Session) -> None:
    service.create_goal(
        session, SavingsGoalCreate(name="Vacaciones", target_amount=Decimal("2000"))
    )
    service.create_goal(session, SavingsGoalCreate(name="Coche", target_amount=Decimal("10000")))
    goals = service.list_goals(session)
    assert len(goals) == 2


def test_create_with_initial_amount(session: Session) -> None:
    goal = service.create_goal(
        session,
        SavingsGoalCreate(
            name="Vacaciones",
            target_amount=Decimal("1000"),
            current_amount=Decimal("250"),
        ),
    )
    assert goal.current_amount == Decimal("250")
    assert goal.progress_pct == 25.0
    assert not goal.is_completed


def test_progress_pct_completed(session: Session) -> None:
    goal = service.create_goal(
        session,
        SavingsGoalCreate(
            name="Fondo",
            target_amount=Decimal("500"),
            current_amount=Decimal("500"),
        ),
    )
    assert goal.progress_pct == 100.0
    assert goal.is_completed


def test_days_remaining(session: Session) -> None:
    future = dt.date.today() + dt.timedelta(days=30)
    goal = service.create_goal(
        session,
        SavingsGoalCreate(name="Viaje", target_amount=Decimal("800"), deadline=future),
    )
    assert goal.days_remaining is not None
    assert 29 <= goal.days_remaining <= 30


def test_days_remaining_none_when_no_deadline(session: Session) -> None:
    goal = service.create_goal(
        session,
        SavingsGoalCreate(name="Sin fecha", target_amount=Decimal("500")),
    )
    assert goal.days_remaining is None


def test_contribute(session: Session) -> None:
    goal = service.create_goal(
        session,
        SavingsGoalCreate(name="Meta", target_amount=Decimal("1000")),
    )
    updated = service.contribute(session, goal.id, SavingsGoalContribute(amount=Decimal("300")))
    assert updated.current_amount == Decimal("300")
    assert updated.progress_pct == 30.0

    updated = service.contribute(session, goal.id, SavingsGoalContribute(amount=Decimal("700")))
    assert updated.current_amount == Decimal("1000")
    assert updated.is_completed


def test_update_goal(session: Session) -> None:
    goal = service.create_goal(
        session,
        SavingsGoalCreate(name="Original", target_amount=Decimal("500")),
    )
    updated = service.update_goal(
        session, goal.id, SavingsGoalUpdate(name="Actualizado", color="#3b82f6")
    )
    assert updated.name == "Actualizado"
    assert updated.color == "#3b82f6"
    assert updated.target_amount == Decimal("500")


def test_delete_goal(session: Session) -> None:
    goal = service.create_goal(
        session,
        SavingsGoalCreate(name="Borrar", target_amount=Decimal("100")),
    )
    service.delete_goal(session, goal.id)
    with pytest.raises(NotFoundError):
        service.get_goal(session, goal.id)


def test_get_unknown_raises(session: Session) -> None:
    with pytest.raises(NotFoundError):
        service.get_goal(session, 9999)


def test_contribute_unknown_raises(session: Session) -> None:
    with pytest.raises(NotFoundError):
        service.contribute(session, 9999, SavingsGoalContribute(amount=Decimal("100")))
