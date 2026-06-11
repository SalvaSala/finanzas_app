"""Business logic for categorization rules."""

from sqlmodel import Session

from app.models.categorization_rule import CategorizationRule
from app.repositories import categorization_rule as rule_repo
from app.repositories import category as category_repo
from app.schemas.categorization_rule import (
    CategorizationRuleCreate,
    CategorizationRuleRead,
    CategorizationRuleUpdate,
    SuggestResponse,
)
from app.services.exceptions import NotFoundError, ValidationError


def _validate_categories(session: Session, category_id: int, subcategory_id: int | None) -> None:
    cat = category_repo.get(session, category_id)
    if cat is None:
        raise NotFoundError("La categoría indicada no existe.")
    if cat.parent_id is not None:
        raise ValidationError("category_id debe ser una categoría principal.")

    if subcategory_id is not None:
        sub = category_repo.get(session, subcategory_id)
        if sub is None:
            raise NotFoundError("La subcategoría indicada no existe.")
        if sub.parent_id is None:
            raise ValidationError("subcategory_id debe ser una subcategoría.")
        if sub.parent_id != category_id:
            raise ValidationError("La subcategoría no pertenece a la categoría indicada.")


def _to_read(rule: CategorizationRule) -> CategorizationRuleRead:
    assert rule.id is not None
    return CategorizationRuleRead(
        id=rule.id,
        pattern=rule.pattern,
        category_id=rule.category_id,
        subcategory_id=rule.subcategory_id,
        priority=rule.priority,
        enabled=rule.enabled,
    )


def create_rule(session: Session, data: CategorizationRuleCreate) -> CategorizationRuleRead:
    _validate_categories(session, data.category_id, data.subcategory_id)
    rule = CategorizationRule(**data.model_dump())
    return _to_read(rule_repo.create(session, rule))


def get_rule(session: Session, rule_id: int) -> CategorizationRuleRead:
    rule = rule_repo.get(session, rule_id)
    if rule is None:
        raise NotFoundError("La regla indicada no existe.")
    return _to_read(rule)


def list_rules(session: Session) -> list[CategorizationRuleRead]:
    return [_to_read(r) for r in rule_repo.list_all(session)]


def update_rule(
    session: Session, rule_id: int, data: CategorizationRuleUpdate
) -> CategorizationRuleRead:
    rule = rule_repo.get(session, rule_id)
    if rule is None:
        raise NotFoundError("La regla indicada no existe.")

    changes = data.model_dump(exclude_unset=True)
    new_category_id = changes.get("category_id", rule.category_id)
    new_subcategory_id = changes.get("subcategory_id", rule.subcategory_id)
    if "category_id" in changes or "subcategory_id" in changes:
        _validate_categories(session, new_category_id, new_subcategory_id)

    for field, value in changes.items():
        setattr(rule, field, value)
    return _to_read(rule_repo.update(session, rule))


def delete_rule(session: Session, rule_id: int) -> None:
    rule = rule_repo.get(session, rule_id)
    if rule is None:
        raise NotFoundError("La regla indicada no existe.")
    rule_repo.delete(session, rule)


def suggest(session: Session, concept: str) -> SuggestResponse | None:
    """Return category suggestion for a concept, or None if no rule matches."""
    rule = rule_repo.find_match(session, concept)
    if rule is None:
        return None
    assert rule.id is not None
    return SuggestResponse(
        rule_id=rule.id,
        category_id=rule.category_id,
        subcategory_id=rule.subcategory_id,
    )
