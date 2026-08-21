"""add logo_path to company_settings

Revision ID: 40f357a378c6
Revises: ec2a9d1ce207
Create Date: 2026-08-20 19:01:42.213848

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '40f357a378c6'
down_revision = 'ec2a9d1ce207'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('company_settings', schema=None) as batch_op:
        batch_op.add_column(sa.Column('logo_path', sa.String(length=255), nullable=True))


def downgrade():
    with op.batch_alter_table('company_settings', schema=None) as batch_op:
        batch_op.drop_column('logo_path')
