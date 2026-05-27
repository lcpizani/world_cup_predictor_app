from typing import Dict

from app.models.user import User


def register_user(client, email: str, username: str, password: str) -> dict:
    response = client.post(
        "/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    assert response.status_code == 201
    return response.json()


def login_user(client, email: str, password: str) -> str:
    response = client.post(
        "/auth/login",
        data={"username": email, "password": password},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["token_type"] == "bearer"
    return payload["access_token"]


def auth_headers(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def grant_admin(db, email: str) -> None:
    """Promote a user to admin directly in the DB — for use in tests only."""
    db.query(User).filter(User.email == email).update({"is_admin": True})
    db.commit()
