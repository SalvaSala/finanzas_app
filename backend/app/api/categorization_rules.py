"""REST endpoints for categorization rules."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.core.db import get_session
from app.schemas.categorization_rule import (
    CategorizationRuleCreate,
    CategorizationRuleRead,
    CategorizationRuleUpdate,
    SuggestResponse,
)
from app.services import categorization_rule as svc
from app.services.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/categorization-rules", tags=["categorization-rules"])


def _not_found(e: Exception) -> HTTPException:
    return HTTPException(status_code=404, detail=str(e))


def _bad_request(e: Exception) -> HTTPException:
    return HTTPException(status_code=422, detail=str(e))


@router.get("", response_model=list[CategorizationRuleRead])
def list_rules(session: Session = Depends(get_session)) -> list[CategorizationRuleRead]:
    return svc.list_rules(session)


@router.post("", response_model=CategorizationRuleRead, status_code=201)
def create_rule(
    data: CategorizationRuleCreate,
    session: Session = Depends(get_session),
) -> CategorizationRuleRead:
    try:
        return svc.create_rule(session, data)
    except NotFoundError as e:
        raise _not_found(e) from e
    except ValidationError as e:
        raise _bad_request(e) from e


@router.get("/suggest", response_model=SuggestResponse | None)
def suggest(
    concept: str = Query(min_length=1),
    session: Session = Depends(get_session),
) -> SuggestResponse | None:
    return svc.suggest(session, concept)


@router.get("/{rule_id}", response_model=CategorizationRuleRead)
def get_rule(rule_id: int, session: Session = Depends(get_session)) -> CategorizationRuleRead:
    try:
        return svc.get_rule(session, rule_id)
    except NotFoundError as e:
        raise _not_found(e) from e


@router.patch("/{rule_id}", response_model=CategorizationRuleRead)
def update_rule(
    rule_id: int,
    data: CategorizationRuleUpdate,
    session: Session = Depends(get_session),
) -> CategorizationRuleRead:
    try:
        return svc.update_rule(session, rule_id, data)
    except NotFoundError as e:
        raise _not_found(e) from e
    except ValidationError as e:
        raise _bad_request(e) from e


@router.delete("/{rule_id}", status_code=204)
def delete_rule(rule_id: int, session: Session = Depends(get_session)) -> None:
    try:
        svc.delete_rule(session, rule_id)
    except NotFoundError as e:
        raise _not_found(e) from e
