import asyncio
import asyncpg

async def create_db():
    conn = await asyncpg.connect(
        user='corphia',
        password='corphia123',
        host='localhost',
        port=5433,
        database='postgres',
    )
    try:
        await conn.execute('CREATE DATABASE corphia_test')
        print("Database created")
    except asyncpg.exceptions.DuplicateDatabaseError:
        print("Database already exists")
    finally:
        await conn.close()

asyncio.run(create_db())
