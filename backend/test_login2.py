import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.api.auth import login
from app.schemas.auth import LoginRequest
from app.core.config import settings

class FakeRequest:
    client = type('obj', (object,), {'host': '127.0.0.1'})
    headers = {'user-agent': 'python-test'}

async def main():
    engine = create_async_engine(settings.database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        try:
            req = LoginRequest(email="engineer@gmail.com", password="Engineer123")
            response = await login(request_body=req, request=FakeRequest(), db=session)
            print("Response:", response)
        except Exception as e:
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
