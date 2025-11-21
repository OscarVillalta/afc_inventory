from enum import Enum
from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Mapped, mapped_column, relationship, foreign
from sqlalchemy import ForeignKey, String, Integer, Float, Numeric, Boolean
from sqlalchemy.inspection import inspect
from database import Base

# =====================================================
# 🔹 Enums
# =====================================================

class OrderType(str, Enum):
    SUPPLIER = "supplier"
    CUSTOMER = "customer"

class OrderStatus(str, Enum):
    PENDING = "Pending"
    PARTIALLY_FULFILLED = "Partially Fulfilled"
    COMPLETED = "Completed"

class TransactionState(str, Enum):
    PENDING = "pending"
    COMMITTED = "committed"
    CANCELLED = "cancelled"
    ROLLED_BACK = "rolled_back"

class TransactionReason(str, Enum):
    SHIPMENT = "shipment"
    RECEIVE = "receive"
    ADJUSTMENT = "adjustment"
    ROLLBACK = "rollback"


# =====================================================
# 🔹 Base Serializer
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
    orders: Mapped[List["Order"]] = relationship(back_populates="supplier")


# =====================================================
# 🔹 Air Filter Category / Product Category
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
# 🔹 Catalog Items: AirFilter / MiscItem
# =====================================================

class AirFilter(Base, SerializerMixin):
    __tablename__ = "air_filters"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    part_number: Mapped[str] = mapped_column(unique=True, nullable=False)
    merv_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, default=0)
    width: Mapped[int] = mapped_column(Integer, default=0)
    depth: Mapped[int] = mapped_column(Integer, default=0)
    initial_resistance: Mapped[Optional[float]] = mapped_column(Numeric(4,3))
    final_resistance: Mapped[Optional[float]] = mapped_column(Numeric(4,3))
    test_airflow_value: Mapped[Optional[float]] = mapped_column(Numeric(8,2))
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
# 🔹 Product (Catalog Root w/ Soft Delete)
# =====================================================

class Product(Base, SerializerMixin):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("product_categories.id"), nullable=False)
    reference_id: Mapped[int] = mapped_column(Integer, nullable=False)

    # SOFT DELETE FLAG — Only here!
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    category: Mapped["ProductCategory"] = relationship("ProductCategory", back_populates="products")

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

    # SAFE CASCADE — Quantity can be deleted only with Product
    quantity: Mapped[Optional["Quantity"]] = relationship(
        "Quantity",
        back_populates="product",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True
    )

    # REMOVE delete-orphan (unsafe!)
    transactions: Mapped[List["Transaction"]] = relationship(
        "Transaction",
        back_populates="product",
        passive_deletes=True
    )

    order_items: Mapped[List["OrderItem"]] = relationship(
        "OrderItem",
        back_populates="product",
        passive_deletes=True
    )


# =====================================================
# 🔹 Quantity
# =====================================================

class Quantity(Base, SerializerMixin):
    __tablename__ = "quantities"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), nullable=False)

    on_hand: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reserved: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ordered: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    location: Mapped[int] = mapped_column()

    product: Mapped["Product"] = relationship(back_populates="quantity", passive_deletes=True)


# =====================================================
# 🔹 Customer
# =====================================================

class Customer(Base, SerializerMixin):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(unique=True, nullable=False)

    orders: Mapped[List["Order"]] = relationship(back_populates="customer")


# =====================================================
# 🔹 Orders
# =====================================================

class Order(Base, SerializerMixin):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_number: Mapped[str] = mapped_column(unique=True, nullable=False)

    type: Mapped[str] = mapped_column(String, nullable=False)  # OrderType enum externally validated

    supplier_id: Mapped[Optional[int]] = mapped_column(ForeignKey("suppliers.id"))
    customer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("customers.id"))

    status: Mapped[str] = mapped_column(default=OrderStatus.PENDING.value)
    description: Mapped[Optional[str]] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(default=datetime.now(timezone.utc))

    supplier: Mapped[Optional["Supplier"]] = relationship("Supplier")
    customer: Mapped[Optional["Customer"]] = relationship("Customer")

    # REMOVE delete-orphan (unsafe for transaction history)
    items: Mapped[List["OrderItem"]] = relationship(
        "OrderItem",
        back_populates="order",
        passive_deletes=True
    )

    transactions: Mapped[List["Transaction"]] = relationship(
        "Transaction",
        back_populates="order",
        passive_deletes=True
    )

    def update_status(self):
        if not self.items:
            self.status = OrderStatus.PENDING.value
            return

        total_items = len(self.items)
        complete = sum(1 for i in self.items if i.quantity_fulfilled >= i.quantity_ordered)
        partial = sum(1 for i in self.items if 0 < i.quantity_fulfilled < i.quantity_ordered)

        if complete == total_items:
            self.status = OrderStatus.COMPLETED.value
        elif partial > 0:
            self.status = OrderStatus.PARTIALLY_FULFILLED.value
        else:
            self.status = OrderStatus.PENDING.value


# =====================================================
# 🔹 Order Items
# =====================================================

class OrderItem(Base, SerializerMixin):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)

    quantity_ordered: Mapped[int] = mapped_column(nullable=False)
    quantity_fulfilled: Mapped[int] = mapped_column(default=0)
    note: Mapped[Optional[str]] = mapped_column(nullable=True)

    product: Mapped["Product"] = relationship("Product", back_populates="order_items")
    order: Mapped["Order"] = relationship("Order", back_populates="items")
    transactions: Mapped[List["Transaction"]] = relationship(
        "Transaction",
        back_populates="order_item",
        passive_deletes=True
    )

    @property
    def remaining(self) -> int:
        return max(self.quantity_ordered - self.quantity_fulfilled, 0)


# =====================================================
# 🔹 Transactions (Immutable Ledger)
# =====================================================

class Transaction(Base, SerializerMixin):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    order_id: Mapped[Optional[int]] = mapped_column(ForeignKey("orders.id", ondelete="SET NULL"))
    order_item_id: Mapped[Optional[int]] = mapped_column(ForeignKey("order_items.id", ondelete="SET NULL"))

    quantity_delta: Mapped[int] = mapped_column(nullable=False)
    reason: Mapped[str] = mapped_column(nullable=False)
    state: Mapped[str] = mapped_column(default=TransactionState.PENDING.value)
    note: Mapped[Optional[str]] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(default=datetime.now(timezone.utc))

    order: Mapped[Optional["Order"]] = relationship("Order", back_populates="transactions", passive_deletes=True)
    order_item: Mapped[Optional["OrderItem"]] = relationship("OrderItem", back_populates="transactions", passive_deletes=True)
    product: Mapped["Product"] = relationship("Product", back_populates="transactions", passive_deletes=True)

    # ================================
    #  Inventory Logic
    # ================================

    def commit(self):
        if self.state != TransactionState.PENDING.value:
            return

        if not self.product or not self.product.quantity:
            raise ValueError("Product or quantity record missing.")

        qty_record = self.product.quantity
        qty_record.on_hand += self.quantity_delta
        self.state = TransactionState.COMMITTED.value

        if self.order_item:
            item = self.order_item
            item.quantity_fulfilled += self.quantity_delta
            item.quantity_fulfilled = max(0, min(item.quantity_fulfilled, item.quantity_ordered))
            if item.order:
                item.order.update_status()

    def rollback(self, db, performed_by: Optional[str] = None):
        if self.state != TransactionState.COMMITTED.value:
            raise ValueError("Only committed transactions can be rolled back.")

        reversed_txn = Transaction(
            product_id=self.product_id,
            order_id=self.order_id,
            order_item_id=self.order_item_id,
            quantity_delta=-self.quantity_delta,
            reason=TransactionReason.ROLLBACK.value,
            state=TransactionState.COMMITTED.value,
            note=f"Reversal of transaction #{self.id}",
        )

        qty_record = self.product.quantity
        qty_record.on_hand += reversed_txn.quantity_delta

        if self.order_item:
            item = self.order_item
            item.quantity_fulfilled += reversed_txn.quantity_delta
            item.quantity_fulfilled = max(0, min(item.quantity_fulfilled, item.quantity_ordered))
            if item.order:
                item.order.update_status()

        self.state = TransactionState.ROLLED_BACK.value
        db.add(reversed_txn)
        return reversed_txn

    def cancel(self):
        if self.state == TransactionState.PENDING.value:
            self.state = TransactionState.CANCELLED.value
