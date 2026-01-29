"""
使用者 API
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, DbSession
from app.models.user import User
from app.schemas.user import UserResponse, UserUpdate, UserListResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=UserListResponse)
async def list_users(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
):
    """
    列出使用者（僅 admin/engineer 可用）
    """
    # 權限檢查
    if current_user.role not in ["admin", "engineer"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="權限不足"
        )
    
    # 建立查詢
    query = select(User).where(User.tenant_id == current_user.tenant_id)
    count_query = select(func.count(User.id)).where(User.tenant_id == current_user.tenant_id)
    
    # 篩選條件
    if search:
        search_filter = f"%{search}%"
        query = query.where(
            (User.name.ilike(search_filter)) | (User.email.ilike(search_filter))
        )
        count_query = count_query.where(
            (User.name.ilike(search_filter)) | (User.email.ilike(search_filter))
        )
    
    if role:
        query = query.where(User.role == role)
        count_query = count_query.where(User.role == role)
    
    if is_active is not None:
        query = query.where(User.is_active == is_active)
        count_query = count_query.where(User.is_active == is_active)
    
    # 取得總數
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # 分頁
    offset = (page - 1) * page_size
    query = query.order_by(User.created_at.desc()).offset(offset).limit(page_size)
    
    result = await db.execute(query)
    users = result.scalars().all()
    
    return UserListResponse(
        data=[UserResponse.model_validate(u) for u in users],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user(current_user: CurrentUser):
    """
    取得當前使用者資訊
    """
    return UserResponse.model_validate(current_user)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    取得指定使用者資訊
    """
    # 只能查看同租戶的使用者
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.tenant_id == current_user.tenant_id
        )
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="使用者不存在"
        )
    
    return UserResponse.model_validate(user)


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    data: UserUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    更新當前使用者資訊
    """
    update_data = data.model_dump(exclude_unset=True)
    
    if not update_data:
        return UserResponse.model_validate(current_user)
    
    # 更新資料
    for key, value in update_data.items():
        setattr(current_user, key, value)
    
    await db.commit()
    await db.refresh(current_user)
    
    return UserResponse.model_validate(current_user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    data: UserUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    更新指定使用者資訊（僅 admin 可用）
    """
    # 權限檢查
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="權限不足"
        )
    
    # 取得使用者
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.tenant_id == current_user.tenant_id
        )
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="使用者不存在"
        )
    
    # 更新資料
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)
    
    await db.commit()
    await db.refresh(user)
    
    return UserResponse.model_validate(user)


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    刪除使用者（僅 admin 可用）
    """
    # 權限檢查
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="權限不足"
        )
    
    # 不能刪除自己
    if user_id == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="無法刪除自己的帳號"
        )
    
    # 取得使用者
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.tenant_id == current_user.tenant_id
        )
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="使用者不存在"
        )
    
    # 軟刪除（停用帳號）
    user.is_active = False
    await db.commit()
    
    return {"message": "使用者已停用"}


@router.post("/{user_id}/activate")
async def activate_user(
    user_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    啟用使用者（僅 admin 可用）
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="權限不足"
        )
    
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.tenant_id == current_user.tenant_id
        )
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="使用者不存在"
        )
    
    user.is_active = True
    await db.commit()
    
    return {"message": "使用者已啟用"}
