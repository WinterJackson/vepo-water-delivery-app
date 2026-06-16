"""Add KDPA encryption for PII

Revision ID: 5b06c684a724
Revises: 023aac9fada5
Create Date: 2026-06-14 14:35:47.417617

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5b06c684a724'
down_revision: Union[str, Sequence[str], None] = '023aac9fada5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


import os
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from sqlalchemy_utils.types.encrypted.encrypted_type import AesEngine

def upgrade() -> None:
    # Drop index on ID_number as it can't be indexed when encrypted
    op.drop_index(op.f('ix_Deliverers_ID_number'), table_name='Deliverers', if_exists=True)
    
    bind = op.get_bind()
    session = sa.orm.Session(bind=bind)
    
    load_dotenv()
    key = os.getenv("DB_ENCRYPTION_KEY")
    if not key:
        print("Warning: DB_ENCRYPTION_KEY not set. Cannot migrate data.")
        return
        
    engine = AesEngine()
    engine._update_key(key)
    
    # Migrate Deliverers
    deliverers = session.execute(sa.text("SELECT id, \"ID_number\" FROM \"Deliverers\"")).fetchall()
    for d in deliverers:
        if d.ID_number and not d.ID_number.startswith("=="): # rough check if not already encrypted
            try:
                encrypted = engine.encrypt(d.ID_number)
                session.execute(sa.text("UPDATE \"Deliverers\" SET \"ID_number\" = :val WHERE id = :id"), {"val": encrypted, "id": d.id})
            except Exception:
                pass
                
    # Migrate Payouts
    payouts = session.execute(sa.text("SELECT id, account_details FROM payouts")).fetchall()
    for p in payouts:
        if p.account_details:
            try:
                encrypted = engine.encrypt(p.account_details)
                session.execute(sa.text("UPDATE payouts SET account_details = :val WHERE id = :id"), {"val": encrypted, "id": p.id})
            except Exception:
                pass
                
    session.commit()

def downgrade() -> None:
    bind = op.get_bind()
    session = sa.orm.Session(bind=bind)
    
    load_dotenv()
    key = os.getenv("DB_ENCRYPTION_KEY")
    if not key:
        return
        
    engine = AesEngine()
    engine._update_key(key)
    
    deliverers = session.execute(sa.text("SELECT id, \"ID_number\" FROM \"Deliverers\"")).fetchall()
    for d in deliverers:
        if d.ID_number:
            try:
                decrypted = engine.decrypt(d.ID_number)
                session.execute(sa.text("UPDATE \"Deliverers\" SET \"ID_number\" = :val WHERE id = :id"), {"val": decrypted, "id": d.id})
            except Exception:
                pass
                
    payouts = session.execute(sa.text("SELECT id, account_details FROM payouts")).fetchall()
    for p in payouts:
        if p.account_details:
            try:
                decrypted = engine.decrypt(p.account_details)
                session.execute(sa.text("UPDATE payouts SET account_details = :val WHERE id = :id"), {"val": decrypted, "id": p.id})
            except Exception:
                pass
                
    session.commit()
    op.create_index(op.f('ix_Deliverers_ID_number'), 'Deliverers', ['ID_number'], unique=False)
