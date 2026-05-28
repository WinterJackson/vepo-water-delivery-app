"""add_search_vectors

Revision ID: 7645438dc804
Revises: 3f40437790a9
Create Date: 2026-05-09 21:56:42.806641

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7645438dc804'
down_revision: Union[str, Sequence[str], None] = '3f40437790a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Backfill existing search vectors
    op.execute("""
        UPDATE "Products" 
        SET search_vector = to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''));
    """)
    op.execute("""
        UPDATE "Vendors" 
        SET search_vector = to_tsvector('english', coalesce(business_name, '') || ' ' || coalesce(location_address, ''));
    """)

    # 2. Create GIN Indexes
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_products_search_vector ON "Products" USING GIN (search_vector);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_vendors_search_vector ON "Vendors" USING GIN (search_vector);
    """)

    # 3. Create triggers to auto-update the search vector
    op.execute("""
        CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
        BEGIN
            NEW.search_vector := to_tsvector('english', coalesce(NEW.name, '') || ' ' || coalesce(NEW.description, ''));
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER tsvectorupdate_products BEFORE INSERT OR UPDATE
        ON "Products" FOR EACH ROW EXECUTE FUNCTION products_search_vector_update();
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION vendors_search_vector_update() RETURNS trigger AS $$
        BEGIN
            NEW.search_vector := to_tsvector('english', coalesce(NEW.business_name, '') || ' ' || coalesce(NEW.location_address, ''));
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER tsvectorupdate_vendors BEFORE INSERT OR UPDATE
        ON "Vendors" FOR EACH ROW EXECUTE FUNCTION vendors_search_vector_update();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS tsvectorupdate_vendors ON \"Vendors\";")
    op.execute("DROP FUNCTION IF EXISTS vendors_search_vector_update();")
    op.execute("DROP INDEX IF EXISTS idx_vendors_search_vector;")
    
    op.execute("DROP TRIGGER IF EXISTS tsvectorupdate_products ON \"Products\";")
    op.execute("DROP FUNCTION IF EXISTS products_search_vector_update();")
    op.execute("DROP INDEX IF EXISTS idx_products_search_vector;")
