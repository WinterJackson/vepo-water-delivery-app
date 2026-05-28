"""add_vehicle_class_to_orders

Revision ID: 37733966129c
Revises: e875588ba923
Create Date: 2026-04-26 22:22:36.841882

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '37733966129c'
down_revision: Union[str, Sequence[str], None] = 'e875588ba923'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add vehicle_class column to Orders for V6 dispatch engine."""
    op.add_column('Orders', sa.Column('vehicle_class', sa.String(length=20), nullable=True, server_default='motorbike'))


def downgrade() -> None:
    """Remove vehicle_class column from Orders."""
    op.drop_column('Orders', 'vehicle_class')
