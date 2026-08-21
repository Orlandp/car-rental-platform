"""add mpesa stk push fields

Revision ID: a1c3f6e9d2b4
Revises: 40f357a378c6
Create Date: 2026-08-21 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1c3f6e9d2b4'
down_revision = '40f357a378c6'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('payments', schema=None) as batch_op:
        batch_op.add_column(sa.Column('merchant_request_id', sa.String(length=60), nullable=True))
        batch_op.add_column(sa.Column('checkout_request_id', sa.String(length=60), nullable=True))
        batch_op.add_column(sa.Column('result_desc', sa.String(length=255), nullable=True))
        batch_op.create_index(
            batch_op.f('ix_payments_checkout_request_id'), ['checkout_request_id'], unique=False
        )

    with op.batch_alter_table('receipts', schema=None) as batch_op:
        batch_op.alter_column('issued_by_id', existing_type=sa.Integer(), nullable=True)


def downgrade():
    with op.batch_alter_table('receipts', schema=None) as batch_op:
        batch_op.alter_column('issued_by_id', existing_type=sa.Integer(), nullable=False)

    with op.batch_alter_table('payments', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_payments_checkout_request_id'))
        batch_op.drop_column('result_desc')
        batch_op.drop_column('checkout_request_id')
        batch_op.drop_column('merchant_request_id')
