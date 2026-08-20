"""add features to vehicles

Revision ID: ec2a9d1ce207
Revises: 11da9ebd70f7
Create Date: 2026-08-20 18:23:26.385096

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ec2a9d1ce207'
down_revision = '11da9ebd70f7'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('vehicles', schema=None) as batch_op:
        batch_op.add_column(sa.Column('features', sa.JSON(), nullable=False, server_default='[]'))


def downgrade():
    with op.batch_alter_table('vehicles', schema=None) as batch_op:
        batch_op.drop_column('features')
