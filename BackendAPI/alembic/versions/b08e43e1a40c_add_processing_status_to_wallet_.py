"""add processing status to wallet transactions

Revision ID: b08e43e1a40c
Revises: 6c4a64c43cb7
Create Date: 2026-07-21 00:31:44.922753

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b08e43e1a40c'
down_revision: Union[str, Sequence[str], None] = '6c4a64c43cb7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE wallet_transaction_status ADD VALUE IF NOT EXISTS 'processing'")

def downgrade() -> None:
    """Downgrade schema."""
    pass
