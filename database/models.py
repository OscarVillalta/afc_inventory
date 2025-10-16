from typing import List, Optional
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
        ForeignKey("filters.id"), unique=True, nullable=False
    )
    on_hand: Mapped[int] = mapped_column(default=0, nullable=False)
    reserved: Mapped[int] = mapped_column(default=0, nullable=False)
    ordered: Mapped[int] = mapped_column(default=0, nullable=False)

    filter: Mapped["Filter"] = relationship(back_populates="quantity")  # ✅ Corrected
