"""rename gatepasses to vendor_remittances

Revision ID: f89b5f238dc6
Revises: 07f60582d826
Create Date: 2026-05-25 00:35:28.290947

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f89b5f238dc6'
down_revision: Union[str, Sequence[str], None] = '07f60582d826'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.rename_table('GatePasses', 'vendor_remittances')
    op.execute('ALTER SEQUENCE IF EXISTS "GatePasses_id_seq" RENAME TO vendor_remittances_id_seq')


def downgrade() -> None:
    """Downgrade schema."""
    op.rename_table('vendor_remittances', 'GatePasses')
    op.execute('ALTER SEQUENCE IF EXISTS vendor_remittances_id_seq RENAME TO "GatePasses_id_seq"')
