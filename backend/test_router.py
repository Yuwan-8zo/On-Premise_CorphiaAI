from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

def test_login():
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "engineer@gmail.com", "password": "Engineer123"}
    )
    print("STATUS:", response.status_code)
    print("BODY:", response.json())

if __name__ == "__main__":
    test_login()
