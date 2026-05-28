"""Merge multiple heads

Revision ID: 3f40437790a9
Revises: 412f43743aad, f9a3b7c2d1e0
Create Date: 2026-05-09 11:15:04.787860

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3f40437790a9'
down_revision: Union[str, Sequence[str], None] = ('412f43743aad', 'f9a3b7c2d1e0')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
