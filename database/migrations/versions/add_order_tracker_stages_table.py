"""Add order_tracker_stages table for per-stage completion state

Revision ID: add_order_tracker_stages
Revises: add_order_tracker_tables
Create Date: 2026-03-04 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_order_tracker_stages'
down_revision = '616f14360892'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'order_tracker_stages',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('stage_index', sa.Integer(), nullable=False),
        sa.Column('is_completed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('completed_by', sa.String(), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('order_id', 'stage_index', name='uq_order_tracker_stage'),
    )


def downgrade() -> None:
    op.drop_table('order_tracker_stages')
