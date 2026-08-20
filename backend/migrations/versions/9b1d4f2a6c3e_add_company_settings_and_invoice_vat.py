"""add company settings and invoice vat rate

Revision ID: 9b1d4f2a6c3e
Revises: 7ca37752a501
Create Date: 2026-08-18 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9b1d4f2a6c3e'
down_revision = '7ca37752a501'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'company_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('kra_pin', sa.String(length=30), nullable=False),
        sa.Column('address', sa.String(length=255), nullable=False),
        sa.Column('city', sa.String(length=100), nullable=False),
        sa.Column('phone', sa.String(length=40), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('vat_rate', sa.Numeric(precision=5, scale=2), nullable=False, server_default='16.00'),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    with op.batch_alter_table('invoices', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                'vat_rate',
                sa.Numeric(precision=5, scale=2),
                nullable=False,
                server_default='16.00',
            )
        )


def downgrade():
    with op.batch_alter_table('invoices', schema=None) as batch_op:
        batch_op.drop_column('vat_rate')

    op.drop_table('company_settings')
