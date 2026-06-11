"""Data access for categorization rules."""

from sqlmodel import Session, col, select

from app.models.categorization_rule import CategorizationRule


def create(session: Session, rule: CategorizationRule) -> CategorizationRule:
    session.add(rule)
    session.commit()
    session.refresh(rule)
    return rule


def get(session: Session, rule_id: int) -> CategorizationRule | None:
    return session.get(CategorizationRule, rule_id)


def list_all(session: Session, *, enabled_only: bool = False) -> list[CategorizationRule]:
    q = select(CategorizationRule).order_by(
        col(CategorizationRule.priority), col(CategorizationRule.id)
    )
    if enabled_only:
        q = q.where(CategorizationRule.enabled == True)  # noqa: E712
    return list(session.exec(q).all())


def update(session: Session, rule: CategorizationRule) -> CategorizationRule:
    session.add(rule)
    session.commit()
    session.refresh(rule)
    return rule


def delete(session: Session, rule: CategorizationRule) -> None:
    session.delete(rule)
    session.commit()


def find_match(session: Session, concept: str) -> CategorizationRule | None:
    """Return the highest-priority enabled rule whose pattern matches *concept*."""
    rules = list_all(session, enabled_only=True)
    concept_lower = concept.lower()
    for rule in rules:
        if rule.pattern.lower() in concept_lower:
            return rule
    return None
