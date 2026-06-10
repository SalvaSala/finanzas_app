"""REST endpoints for savings goals."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.core.db import get_session
from app.schemas.savings_goal import (
    SavingsGoalContribute,
    SavingsGoalCreate,
    SavingsGoalRead,
    SavingsGoalUpdate,
)
from app.services import savings_goal as service
from app.services.exceptions import NotFoundError

router = APIRouter(prefix="/savings-goals", tags=["savings-goals"])


def _not_found(e: NotFoundError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("", response_model=list[SavingsGoalRead])
def list_goals(session: Session = Depends(get_session)) -> list[SavingsGoalRead]:
    return service.list_goals(session)


@router.post("", response_model=SavingsGoalRead, status_code=status.HTTP_201_CREATED)
def create_goal(
    data: SavingsGoalCreate, session: Session = Depends(get_session)
) -> SavingsGoalRead:
    return service.create_goal(session, data)


@router.post("/{goal_id}/contribute", response_model=SavingsGoalRead)
def contribute(
    goal_id: int,
    data: SavingsGoalContribute,
    session: Session = Depends(get_session),
) -> SavingsGoalRead:
    try:
        return service.contribute(session, goal_id, data)
    except NotFoundError as e:
        raise _not_found(e) from e


@router.get("/{goal_id}", response_model=SavingsGoalRead)
def get_goal(goal_id: int, session: Session = Depends(get_session)) -> SavingsGoalRead:
    try:
        return service.get_goal(session, goal_id)
    except NotFoundError as e:
        raise _not_found(e) from e


@router.patch("/{goal_id}", response_model=SavingsGoalRead)
def update_goal(
    goal_id: int, data: SavingsGoalUpdate, session: Session = Depends(get_session)
) -> SavingsGoalRead:
    try:
        return service.update_goal(session, goal_id, data)
    except NotFoundError as e:
        raise _not_found(e) from e


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(goal_id: int, session: Session = Depends(get_session)) -> None:
    try:
        service.delete_goal(session, goal_id)
    except NotFoundError as e:
        raise _not_found(e) from e
