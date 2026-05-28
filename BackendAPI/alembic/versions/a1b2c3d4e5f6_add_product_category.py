"""add product_category column and enum

Revision ID: a1b2c3d4e5f6
Revises: 409d30504073
Create Date: 2026-04-28 14:10:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '312b7bf2eb8c'
branch_labels = None
depends_on = None

# Kenyan water delivery market product categories
PRODUCT_CATEGORY_VALUES = [
    'dispenser_refill',
    'bottled_water',
    'mineral_spring',
    'purified_water',
    'alkaline_specialty',
    'jerrycan',
    'bulk_wholesale',
    'dispensers_coolers',
    'accessories',
    'ice_cold',
]


def upgrade() -> None:
    # Create the enum type first
    product_category_enum = sa.Enum(
        *PRODUCT_CATEGORY_VALUES,
        name='product_category'
    )
    product_category_enum.create(op.get_bind(), checkfirst=True)

    # Add the column to Products table
    op.add_column('Products', sa.Column(
        'category',
        sa.Enum(*PRODUCT_CATEGORY_VALUES, name='product_category', create_type=False),
        nullable=True,
        comment='Kenya market water product category'
    ))
    op.create_index('ix_products_category', 'Products', ['category'])


def downgrade() -> None:
    op.drop_index('ix_products_category', table_name='Products')
    op.drop_column('Products', 'category')

    # Drop the enum type
    product_category_enum = sa.Enum(name='product_category')
    product_category_enum.drop(op.get_bind(), checkfirst=True)
