"""add identity verification fields to users

Revision ID: 11da9ebd70f7
Revises: b6e0dd64c4ed
Create Date: 2026-08-20 17:34:58.319525

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '11da9ebd70f7'
down_revision = 'b6e0dd64c4ed'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('driver_license_number', sa.String(length=40), nullable=True))
        batch_op.add_column(sa.Column('national_id_number', sa.String(length=40), nullable=True))
        batch_op.add_column(sa.Column('driver_license_image_path', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('national_id_image_path', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('verification_status', sa.String(length=20), nullable=False, server_default='unverified'))
        batch_op.add_column(sa.Column('verification_notes', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('verification_submitted_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('verified_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('verified_by_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_users_verified_by_id_users', 'users', ['verified_by_id'], ['id'])


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_constraint('fk_users_verified_by_id_users', type_='foreignkey')
        batch_op.drop_column('verified_by_id')
        batch_op.drop_column('verified_at')
        batch_op.drop_column('verification_submitted_at')
        batch_op.drop_column('verification_notes')
        batch_op.drop_column('verification_status')
        batch_op.drop_column('national_id_image_path')
        batch_op.drop_column('driver_license_image_path')
        batch_op.drop_column('national_id_number')
        batch_op.drop_column('driver_license_number')
