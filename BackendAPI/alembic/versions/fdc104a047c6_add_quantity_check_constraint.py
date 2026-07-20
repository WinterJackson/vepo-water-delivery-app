"""add_quantity_check_constraint

Revision ID: fdc104a047c6
Revises: 5f36cbc0c27a
Create Date: 2026-07-20 21:42:39.572767

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fdc104a047c6'
down_revision: Union[str, Sequence[str], None] = '5f36cbc0c27a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_check_constraint('ck_cart_items_quantity_positive', 'Cart_Items', 'quantity > 0')
    op.create_check_constraint('ck_order_items_quantity_positive', 'Order_Items', 'quantity > 0')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('ck_order_items_quantity_positive', 'Order_Items', type_='check')
    op.drop_constraint('ck_cart_items_quantity_positive', 'Cart_Items', type_='check')
