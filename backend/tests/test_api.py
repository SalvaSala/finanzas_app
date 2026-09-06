"""Endpoint tests using the TestClient with an in-memory database."""

import json
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


# ── Importación CSV ───────────────────────────────────────────────────────────

# Extracto tipo Banco Sabadell: barras verticales, sin cabecera, con el saldo
# corriente junto al importe y una segunda fecha de valor.
SABADELL_TXT = (
    b"07/09/2026|PAGO BIZUM ANA L.|06/09/2026|-33.00|1846.26||111111111111\n"
    b"07/09/2026|COMPRA TARJ. 5555XXXXXXXX1234 TIENDA UNO|08/09/2026|-45.89|1879.26||5555__1234\n"
    b"04/09/2026|COMPRA TARJ. 5555XXXXXXXX1234 TIENDA DOS|07/09/2026|-27.90|1925.15||5555__1234\n"
    b"03/09/2026|COMPRA TARJ. 5555XXXXXXXX1234 TIENDA TRES|06/09/2026|-7.55|1953.05||5555__1234\n"
    b"01/09/2026|TRANSFERENCIA RECIBIDA|01/09/2026|450.00|1960.60|333333333|\n"
)


def test_csv_preview_endpoint_detects_a_bank_export(client: TestClient) -> None:
    response = client.post(
        "/api/transactions/csv-preview",
        files={"file": ("extracto.txt", SABADELL_TXT, "text/plain")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["separator"] == "|"
    assert body["has_header"] is False
    assert body["is_native"] is False
    assert body["suggested"]["date_col"] == "Columna 1"
    assert body["suggested"]["amount_col"] == "Columna 4"


def test_csv_preview_endpoint_accepts_a_header_override(client: TestClient) -> None:
    response = client.post(
        "/api/transactions/csv-preview",
        files={"file": ("extracto.txt", SABADELL_TXT, "text/plain")},
        data={"has_header": "true"},
    )

    assert response.json()["has_header"] is True


def test_csv_import_mapped_endpoint(client: TestClient, session: Session) -> None:
    account, _ = _seed(session)
    mapping = {
        "date_col": "Columna 1",
        "concept_col": "Columna 2",
        "amount_col": "Columna 4",
        "has_header": False,
    }

    response = client.post(
        "/api/transactions/csv-import-mapped",
        files={"file": ("extracto.txt", SABADELL_TXT, "text/plain")},
        data={"account_id": str(account.id), "mapping": json.dumps(mapping)},
    )

    assert response.status_code == 200
    assert response.json()["imported"] == 5

    movements = client.get("/api/transactions").json()
    assert sum(1 for m in movements if m["type"] == "expense") == 4
    assert sum(1 for m in movements if m["type"] == "income") == 1
