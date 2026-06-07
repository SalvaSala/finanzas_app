"""Endpoint tests using the TestClient with an in-memory database."""

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import Account, AccountType, Category, CategoryType


def _seed(session: Session) -> tuple[Account, Category]:
    account = Account(name="Banco", type=AccountType.bank)
    food = Category(name="Alimentación", type=CategoryType.expense)
    session.add_all([account, food])
    session.commit()
    session.refresh(account)
    session.refresh(food)
    return account, food


def test_health(client: TestClient) -> None:
    assert client.get("/api/health").json() == {"status": "ok"}


def test_list_accounts(client: TestClient, session: Session) -> None:
    _seed(session)
    response = client.get("/api/accounts")
    assert response.status_code == 200
    assert any(account["name"] == "Banco" for account in response.json())


def test_create_and_list_transaction(client: TestClient, session: Session) -> None:
    account, food = _seed(session)
    payload = {
        "date": "2026-06-01",
        "type": "expense",
        "concept": "Compra",
        "amount": "20.00",
        "account_id": account.id,
        "category_id": food.id,
    }
    created = client.post("/api/transactions", json=payload)
    assert created.status_code == 201, created.text
    assert created.json()["concept"] == "Compra"

    listed = client.get("/api/transactions")
    assert listed.status_code == 200
    assert len(listed.json()) == 1


def test_create_transaction_unknown_account_returns_404(
    client: TestClient, session: Session
) -> None:
    _seed(session)
    payload = {
        "date": "2026-06-01",
        "type": "expense",
        "concept": "X",
        "amount": "1.00",
        "account_id": 999,
    }
    response = client.post("/api/transactions", json=payload)
    assert response.status_code == 404


def test_dashboard_summary_endpoint(client: TestClient, session: Session) -> None:
    account, food = _seed(session)
    client.post(
        "/api/transactions",
        json={
            "date": "2026-06-01",
            "type": "expense",
            "concept": "X",
            "amount": "50.00",
            "account_id": account.id,
            "category_id": food.id,
        },
    )
    response = client.get("/api/dashboard/summary?year=2026&month=6")
    assert response.status_code == 200
    data = response.json()
    assert Decimal(str(data["expense"])) == Decimal("50.00")
    assert Decimal(str(data["balance"])) == Decimal("-50.00")
