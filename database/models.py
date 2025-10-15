from typing import List
from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import ForeignKey
from database import Base

class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(unique=True, nullable=False)

    filters: Mapped[List["Filter"]] = relationship(back_populates="supplier")


class Filter(Base):
    __tablename__ = "filters"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    part_number: Mapped[str] = mapped_column(unique=True, nullable=False)
    supplier_id: Mapped[int] = mapped_column(
        ForeignKey("suppliers.id"),
        nullable=False
    )

    # Merv 1-16, 17 will be hepa, and 18 indicates custom handled by frontend
    rating: Mapped[int] = mapped_column(default=0, nullable=False)
    height: Mapped[int] = mapped_column(default=0, nullable=False)
    width: Mapped[int] = mapped_column(default=0, nullable=False)
    depth: Mapped[int] = mapped_column(default=0, nullable=False)


    supplier: Mapped["Supplier"] = relationship(back_populates="filters")
    quantity: Mapped[Optional["Quantity"]] = relationship(
        back_populates="filter", uselist=False, cascade="all, delete-orphan"
    )

class Quantity(Base):
    __tablename__ = "quantities"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    filter_id: Mapped[int] = mapped_column(
        ForeignKey("filters.id"), 
        unique=True, 
        nullable=False
    )
    on_hand: Mapped[int] = mapped_column(default=0, nullable=False)
    reserved: Mapped[int] = mapped_column(default=0, nullable=False)
    ordered: Mapped[int] = mapped_column(default=0, nullable=False)
    
    filter: Mapped["Filter"] = relationship(back_populates="quantities")
