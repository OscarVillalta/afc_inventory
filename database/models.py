from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.orm.properties import RelationshipProperty
from sqlalchemy import ForeignKey
from sqlalchemy.inspection import inspect
from database import Base

class SerializerMixin:

    def to_dict(self, include_relationships=False):
        data = {}
        mapper = inspect(self).mapper

        # ✅ Handle RAW COLUMNS (simple fields)
        for column in mapper.column_attrs:
            attr = column.key
            data[attr] = getattr(self, attr)

        # ✅ Handle RELATIONSHIPS separately
        if include_relationships:
            for relation in mapper.relationships:
                attr = relation.key
                value = getattr(self, attr)
                if value is None:
                    data[attr] = None
                elif relation.uselist:  # one-to-many (list)
                    data[attr] = [item.to_dict(include_relationships=False) for item in value]
                else:  # one-to-one
                    data[attr] = value.to_dict(include_relationships=False)

        return data

    @classmethod
    def from_dict(cls, data: dict):
        """Create a new model instance from dictionary safely."""
        obj = cls()
        for key, value in data.items():
            if hasattr(cls, key):
                setattr(obj, key, value)
        return obj

class Supplier(Base, SerializerMixin):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(unique=True, nullable=False)

    filters: Mapped[List["Filter"]] = relationship(back_populates="supplier")

class Filter(Base, SerializerMixin):
    __tablename__ = "filters"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    part_number: Mapped[str] = mapped_column(unique=True, nullable=False)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), nullable=False)

    rating: Mapped[int] = mapped_column(default=0, nullable=False)
    height: Mapped[int] = mapped_column(default=0, nullable=False)
    width: Mapped[int] = mapped_column(default=0, nullable=False)
    depth: Mapped[int] = mapped_column(default=0, nullable=False)

    supplier: Mapped["Supplier"] = relationship(back_populates="filters")
    quantity: Mapped[Optional["Quantity"]] = relationship(
        back_populates="filter", uselist=False, cascade="all, delete-orphan"
    )

class Quantity(Base, SerializerMixin):
    __tablename__ = "quantities"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    filter_id: Mapped[int] = mapped_column(
        ForeignKey("filters.id"), nullable=False
    )
    on_hand: Mapped[int] = mapped_column(default=0, nullable=False)
    reserved: Mapped[int] = mapped_column(default=0, nullable=False)
    ordered: Mapped[int] = mapped_column(default=0, nullable=False)
    location: Mapped[str] = mapped_column(nullable=False)

    filter: Mapped["Filter"] = relationship(back_populates="quantity")

class Order(Base, SerializerMixin):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    qb_id: Mapped[Optional[str]] = mapped_column(nullable=True)
    order_number: Mapped[str] = mapped_column(nullable=False, unique=True)
    customer: Mapped[Optional[str]] = mapped_column(nullable=True)
    description: Mapped[Optional[str]] = mapped_column(nullable=True)

    type: Mapped[str] = mapped_column(nullable=False)   # qb_packing_slip / internal / adjustment
    status: Mapped[str] = mapped_column(nullable=False) # pending / completed / voided

    created_at: Mapped[datetime] = mapped_column(default=datetime.now(timezone.utc))

    # Relationships
    transactions: Mapped[List["Transaction"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )

class Transaction(Base, SerializerMixin):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    filter_id: Mapped[int] = mapped_column(
        ForeignKey("filters.id"), nullable=False
    )

    order_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("orders.id"), nullable=True
    )

    # signed inventory movement: +10 incoming, -5 outgoing
    quantity: Mapped[int] = mapped_column(nullable=False)

    reason: Mapped[str] = mapped_column(nullable=False)
    note: Mapped[Optional[str]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now(timezone.utc))

    # Relationships
    order: Mapped[Optional["Order"]] = relationship(back_populates="transactions")
    filter: Mapped["Filter"] = relationship()