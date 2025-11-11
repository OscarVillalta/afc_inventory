from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Mapped, mapped_column, relationship, foreign
from sqlalchemy import ForeignKey, String, Integer, Float, Numeric
from sqlalchemy.inspection import inspect
from database import Base

# =====================================================
# 🔹 Base Mixin for Serialization
# =====================================================

class SerializerMixin:
    def to_dict(self, include_relationships=False):
        data = {}
        mapper = inspect(self).mapper

        for column in mapper.column_attrs:
            attr = column.key
            data[attr] = getattr(self, attr)

        if include_relationships:
            for relation in mapper.relationships:
                attr = relation.key
                value = getattr(self, attr)
                if value is None:
                    data[attr] = None
                elif relation.uselist:
                    data[attr] = [item.to_dict(include_relationships=False) for item in value]
                else:
                    data[attr] = value.to_dict(include_relationships=False)
        return data

    @classmethod
    def from_dict(cls, data: dict):
        obj = cls()
        for key, value in data.items():
            if hasattr(cls, key):
                setattr(obj, key, value)
        return obj


# =====================================================
# 🔹 Supplier
# =====================================================

class Supplier(Base, SerializerMixin):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(unique=True, nullable=False)

    air_filters: Mapped[List["AirFilter"]] = relationship(back_populates="supplier")
    misc_items: Mapped[List["MiscItem"]] = relationship(back_populates="supplier")


# =====================================================
# 🔹 Product Category / Air Filter Catory
# =====================================================

class ProductCategory(Base, SerializerMixin):
    __tablename__ = "product_categories"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(unique=True, nullable=False)

    products: Mapped[List["Product"]] = relationship("Product", back_populates="category")

class AirFilterCategory(Base, SerializerMixin):
    __tablename__ = "air_filter_categories"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(unique=True, nullable=False)

    air_filters: Mapped[List["AirFilter"]] = relationship("AirFilter", back_populates="category")


# =====================================================
# 🔹 Air / Fluid / Misc Product Tables
# =====================================================

class AirFilter(Base, SerializerMixin):
    __tablename__ = "air_filters"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    part_number: Mapped[str] = mapped_column(unique=True, nullable=False)
    merv_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, default=0)
    width: Mapped[int] = mapped_column(Integer, default=0)
    depth: Mapped[int] = mapped_column(Integer, default=0)
    initial_resistance: Mapped[Optional[float]] = mapped_column(Numeric(4, 3), nullable=True)
    final_resistance: Mapped[Optional[float]] = mapped_column(Numeric(4, 3), nullable=True)
    test_airflow_value: Mapped[Optional[float]] = mapped_column(Numeric(8, 2), nullable=True)
    test_airflow_unit: Mapped[Optional[str]] = mapped_column(String(10), default="FPM")
    category_id: Mapped[int] = mapped_column(ForeignKey("air_filter_categories.id"), nullable=False)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), nullable=False)

    supplier: Mapped["Supplier"] = relationship(back_populates="air_filters")
    category: Mapped["AirFilterCategory"] = relationship(back_populates="air_filters")
    product: Mapped[Optional["Product"]] = relationship(
        "Product",
        back_populates="air_filter",
        uselist=False,
        primaryjoin=lambda: Product.reference_id == foreign(AirFilter.id),
        viewonly=True, 
    )

class MiscItem(Base, SerializerMixin):
    __tablename__ = "misc_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255))
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), nullable=False)

    supplier: Mapped["Supplier"] = relationship(back_populates="misc_items")
    product: Mapped[Optional["Product"]] = relationship(
        "Product",
        back_populates="misc_item",
        uselist=False,
        primaryjoin=lambda: Product.reference_id == foreign(MiscItem.id),
        viewonly=True,
    )
        


# =====================================================
# 🔹 Product (Universal Bridge)
# =====================================================

class Product(Base, SerializerMixin):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("product_categories.id"), nullable=False)
    reference_id: Mapped[int] = mapped_column(Integer, nullable=False)

    category: Mapped["ProductCategory"] = relationship("ProductCategory", back_populates="products")
    quantity: Mapped[Optional["Quantity"]] = relationship("Quantity", back_populates="product", uselist=False)
    transactions: Mapped[List["Transaction"]] = relationship("Transaction", back_populates="product")

    air_filter: Mapped[Optional["AirFilter"]] = relationship(
        "AirFilter",
        back_populates="product",
        uselist=False,
        primaryjoin="Product.reference_id == foreign(AirFilter.id)"
    )
    misc_item: Mapped[Optional["MiscItem"]] = relationship(
        "MiscItem",
        back_populates="product",
        uselist=False,
        primaryjoin="Product.reference_id == foreign(MiscItem.id)"
    )


# =====================================================
# 🔹 Quantity (Stock Tracking)
# =====================================================

class Quantity(Base, SerializerMixin):
    __tablename__ = "quantities"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    on_hand: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reserved: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ordered: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    location: Mapped[int] = mapped_column()

    product: Mapped["Product"] = relationship(back_populates="quantity")


# =====================================================
# 🔹 Order / Customer / Transaction
# =====================================================

class Customer(Base, SerializerMixin):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(unique=True, nullable=False)

    orders: Mapped[List["Order"]] = relationship(back_populates="customer")


class Order(Base, SerializerMixin):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    qb_id: Mapped[Optional[str]] = mapped_column(nullable=True)
    order_number: Mapped[str] = mapped_column(nullable=False, unique=True)
    customer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("customers.id"), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(nullable=True)
    type: Mapped[str] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now(timezone.utc))

    customer: Mapped[Optional["Customer"]] = relationship(back_populates="orders")
    transactions: Mapped[List["Transaction"]] = relationship(back_populates="order", cascade="all, delete-orphan")


class Transaction(Base, SerializerMixin):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    order_id: Mapped[Optional[int]] = mapped_column(ForeignKey("orders.id"), nullable=True)
    quantity: Mapped[int] = mapped_column(nullable=False)
    reason: Mapped[str] = mapped_column(nullable=False)
    note: Mapped[Optional[str]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now(timezone.utc))

    order: Mapped[Optional["Order"]] = relationship(back_populates="transactions")
    product: Mapped["Product"] = relationship(back_populates="transactions")
