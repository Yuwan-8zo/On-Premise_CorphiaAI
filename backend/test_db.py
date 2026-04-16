import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.user import User
from app.core.config import settings

async def main():
    engine = create_async_engine(settings.database_url, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        try:
            result = await session.execute(select(User).where(User.email == "engineer@gmail.com"))
            user = result.scalar_one_or_none()
            print("User:", user)
        except Exception as e:
            print("DB Exception:", e)

if __name__ == "__main__":
    asyncio.run(main())
