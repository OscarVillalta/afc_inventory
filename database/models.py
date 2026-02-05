from enum import Enum
from typing import List, Optional
from datetime import datetime, timezone

from sqlalchemy.orm import Mapped, mapped_column, relationship, foreign
from sqlalchemy import ForeignKey, String, Integer, Boolean, Index, func, text
from sqlalchemy.inspection import inspect
from sqlalchemy.ext.hybrid import hybrid_property

from database import Base


# =====================================================
# 🔹 Enums (string value containers)
# =====================================================

class OrderType(str, Enum):
    OUTGOING = "outgoing"
    INCOMING = "incoming"


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
    ORDER = "ordered"
    RECEIVE = "receive"
    ADJUSTMENT = "adjustment"
    ROLLBACK = "rollback"
    ALLOCATION = "allocation"


# =====================================================
# 🔹 Base Serializer
# =====================================================

class SerializerMixin:
    def to_dict(self, include_relationships: bool = False):
        data = {}
        mapper = inspect(self).mapper

        for column in mapper.column_attrs:
            attr = column.key
            value = getattr(self, attr)

            if isinstance(value, Enum):
                value = value.value

            data[attr] = value

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
# 🔹 Categories
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
# 🔹 Catalog Items
# =====================================================

class AirFilter(Base, SerializerMixin):
    __tablename__ = "air_filters"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    part_number: Mapped[str] = mapped_column(unique=True, nullable=False)
    merv_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, default=0)
    width: Mapped[int] = mapped_column(Integer, default=0)
    depth: Mapped[int] = mapped_column(Integer, default=0)

    category_id: Mapped[int] = mapped_column(ForeignKey("air_filter_categories.id"), nullable=False)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), nullable=False)

    supplier: Mapped["Supplier"] = relationship(back_populates="air_filters")
    category: Mapped["AirFilterCategory"] = relationship(back_populates="air_filters")

    product: Mapped[Optional["Product"]] = relationship(
        "Product",
        primaryjoin=lambda: Product.reference_id == foreign(AirFilter.id),
        foreign_keys=lambda: [Product.reference_id],
        back_populates="air_filter",
        uselist=False,
        viewonly=True,
    )

    child_product: Mapped[Optional["ChildProduct"]] = relationship(
        "ChildProduct",
        primaryjoin=lambda: ChildProduct.reference_id == foreign(AirFilter.id),
        foreign_keys=lambda: [ChildProduct.reference_id],
        back_populates="air_filter",
        uselist=False,
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
        primaryjoin=lambda: Product.reference_id == foreign(MiscItem.id),
        foreign_keys=lambda: [Product.reference_id],
        back_populates="misc_item",
        uselist=False,
        viewonly=True,
    )

    child_product: Mapped[Optional["ChildProduct"]] = relationship(
        "ChildProduct",
        primaryjoin=lambda: ChildProduct.reference_id == foreign(MiscItem.id),
        foreign_keys=lambda: [ChildProduct.reference_id],
        back_populates="misc_item",
        uselist=False,
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

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    category: Mapped["ProductCategory"] = relationship("ProductCategory", back_populates="products")

    air_filter: Mapped[Optional["AirFilter"]] = relationship(
        "AirFilter",
        primaryjoin=lambda: Product.reference_id == foreign(AirFilter.id),
        foreign_keys=lambda: [Product.reference_id],
        back_populates="product",
        uselist=False,
    )

    misc_item: Mapped[Optional["MiscItem"]] = relationship(
        "MiscItem",
        primaryjoin=lambda: Product.reference_id == foreign(MiscItem.id),
        foreign_keys=lambda: [Product.reference_id],
        back_populates="product",
        uselist=False,
    )

    quantity: Mapped[Optional["Quantity"]] = relationship(
        "Quantity",
        back_populates="product",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    transactions: Mapped[List["Transaction"]] = relationship(
        "Transaction",
        back_populates="product",
        passive_deletes=True,
    )

    order_items: Mapped[List["OrderItem"]] = relationship(
        "OrderItem",
        back_populates="product",
        passive_deletes=True,
    )

    child_products: Mapped[List["ChildProduct"]] = relationship(
        "ChildProduct",
        back_populates="parent_product",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )



# =====================================================
# 🔹 ChildProduct (Uses Parent's Quantity)
# =====================================================

class ChildProduct(Base, SerializerMixin):
    __tablename__ = "child_products"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("product_categories.id"), nullable=False)
    reference_id: Mapped[int] = mapped_column(Integer, nullable=False)
    # CASCADE: Deleting the parent product will automatically delete all child products
    parent_product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    category: Mapped["ProductCategory"] = relationship("ProductCategory")
    parent_product: Mapped["Product"] = relationship("Product", back_populates="child_products", passive_deletes=True)

    air_filter: Mapped[Optional["AirFilter"]] = relationship(
        "AirFilter",
        primaryjoin=lambda: ChildProduct.reference_id == foreign(AirFilter.id),
        foreign_keys=lambda: [ChildProduct.reference_id],
        back_populates="child_product",
        uselist=False,
    )

    misc_item: Mapped[Optional["MiscItem"]] = relationship(
        "MiscItem",
        primaryjoin=lambda: ChildProduct.reference_id == foreign(MiscItem.id),
        foreign_keys=lambda: [ChildProduct.reference_id],
        back_populates="child_product",
        uselist=False,
    )

    transactions: Mapped[List["Transaction"]] = relationship(
        "Transaction",
        back_populates="child_product",
        passive_deletes=True,
    )

    order_items: Mapped[List["OrderItem"]] = relationship(
        "OrderItem",
        back_populates="child_product",
        passive_deletes=True,
    )

    @property
    def quantity(self) -> Optional["Quantity"]:
        """Returns the parent product's quantity"""
        return self.parent_product.quantity if self.parent_product else None


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

    @hybrid_property
    def available(self):
        return max(self.on_hand - self.reserved, 0)

    @available.expression
    def available(cls):
        return func.greatest(cls.on_hand - cls.reserved, 0)

    @hybrid_property
    def backordered(self):
        return abs(min(0, self.on_hand - self.reserved))

    @backordered.expression
    def backordered(cls):
        return func.greatest(cls.reserved - cls.on_hand, 0)


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
    order_number: Mapped[str] = mapped_column(unique=True, nullable=True)
    external_order_number: Mapped[Optional[str]] = mapped_column(nullable=True)

    type: Mapped[str] = mapped_column(String, nullable=False)  # OrderType values

    supplier_id: Mapped[Optional[int]] = mapped_column(ForeignKey("suppliers.id"))
    customer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("customers.id"))

    status: Mapped[str] = mapped_column(String, default=OrderStatus.PENDING.value, nullable=False)
    description: Mapped[Optional[str]] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(default=datetime.now(timezone.utc))
    completed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    eta: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    supplier: Mapped[Optional["Supplier"]] = relationship("Supplier", back_populates="orders")
    customer: Mapped[Optional["Customer"]] = relationship("Customer", back_populates="orders")

    items: Mapped[List["OrderItem"]] = relationship(
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan"
    )

    transactions: Mapped[List["Transaction"]] = relationship(
        "Transaction",
        back_populates="order",
        passive_deletes=True,
    )

    def update_status(self):
        if not self.items:
            self.status = OrderStatus.PENDING.value
            self.completed_at = None
            return

        # Filter out separator items for status calculation
        non_separator_items = [item for item in self.items if not item.is_separator]
        
        if not non_separator_items:
            self.status = OrderStatus.PENDING.value
            self.completed_at = None
            return

        total = len(non_separator_items)
        fully_complete = 0
        any_progress = False

        for item in non_separator_items:
            if item.quantity_fulfilled >= item.quantity_ordered and item.quantity_ordered > 0:
                fully_complete += 1
            if item.quantity_fulfilled > 0:
                any_progress = True

        if fully_complete == total:
            self.status = OrderStatus.COMPLETED.value
            self.completed_at = self.completed_at or datetime.now(timezone.utc)
        elif any_progress:
            self.status = OrderStatus.PARTIALLY_FULFILLED.value
            self.completed_at = None
        else:
            self.status = OrderStatus.PENDING.value
            self.completed_at = None

    def generate_order_number(db):
        last = db.execute(text("SELECT MAX(id) FROM orders")).scalar() or 0
        return f"AFC-{last + 1:06d}"


# =====================================================
# 🔹 Order Items
# =====================================================

class OrderItem(Base, SerializerMixin):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[Optional[int]] = mapped_column(ForeignKey("products.id"), nullable=True)
    child_product_id: Mapped[Optional[int]] = mapped_column(ForeignKey("child_products.id"), nullable=True)

    is_separator: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    quantity_ordered: Mapped[int] = mapped_column(default=0, nullable=False)
    quantity_fulfilled: Mapped[int] = mapped_column(default=0)
    note: Mapped[Optional[str]] = mapped_column(nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    completion_date: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    order: Mapped["Order"] = relationship("Order", back_populates="items")
    product: Mapped[Optional["Product"]] = relationship("Product", back_populates="order_items")
    child_product: Mapped[Optional["ChildProduct"]] = relationship("ChildProduct", back_populates="order_items")

    transactions: Mapped[List["Transaction"]] = relationship(
        "Transaction",
        back_populates="order_item",
        passive_deletes=True,
    )

    @property
    def remaining(self) -> int:
        return max(self.quantity_ordered - self.quantity_fulfilled, 0)

    @property
    def status(self) -> str:
        if self.quantity_fulfilled == 0:
            return "Pending"
        if self.quantity_fulfilled < self.quantity_ordered:
            return "Partially Fulfilled"
        return "Completed"


# =====================================================
# 🔹 Transactions (Immutable Ledger)
# =====================================================

class Transaction(Base, SerializerMixin):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    product_id: Mapped[Optional[int]] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), nullable=True)
    # RESTRICT: Transactions prevent deletion of child products (must delete transaction first)
    child_product_id: Mapped[Optional[int]] = mapped_column(ForeignKey("child_products.id", ondelete="RESTRICT"), nullable=True)
    order_id: Mapped[Optional[int]] = mapped_column(ForeignKey("orders.id", ondelete="SET NULL"))
    order_item_id: Mapped[Optional[int]] = mapped_column(ForeignKey("order_items.id", ondelete="SET NULL"))

    quantity_delta: Mapped[int] = mapped_column(nullable=False)
    state: Mapped[str] = mapped_column(String, default=TransactionState.PENDING.value, nullable=False)
    reason: Mapped[str] = mapped_column(String, nullable=False)
    note: Mapped[Optional[str]] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(default=datetime.now(timezone.utc))

    order: Mapped[Optional["Order"]] = relationship("Order", back_populates="transactions", passive_deletes=True)
    order_item: Mapped[Optional["OrderItem"]] = relationship("OrderItem", back_populates="transactions", passive_deletes=True)
    product: Mapped[Optional["Product"]] = relationship("Product", back_populates="transactions", passive_deletes=True)
    child_product: Mapped[Optional["ChildProduct"]] = relationship("ChildProduct", back_populates="transactions", passive_deletes=True)

    # ================================
    #  Inventory Logic
    # ================================

    def _get_quantity_record(self) -> Optional["Quantity"]:
        """Helper to get the appropriate quantity record (parent's for child products)"""
        if self.child_product:
            return self.child_product.quantity
        elif self.product:
            return self.product.quantity
        return None

    def commit(self):
        if self.state != TransactionState.PENDING.value:
            return

        qty_record = self._get_quantity_record()
        if not qty_record:
            raise ValueError("Quantity record missing.")

        # Apply physical change
        qty_record.on_hand += self.quantity_delta

        # Remove pending planning effect
        if self.quantity_delta > 0:
            qty_record.ordered -= abs(self.quantity_delta)
        else:
            qty_record.reserved -= abs(self.quantity_delta)

        self.state = TransactionState.COMMITTED.value

        # Fulfillment progression
        if self.order_item:
            item = self.order_item
            item.quantity_fulfilled += abs(self.quantity_delta)
            item.quantity_fulfilled = max(0, min(item.quantity_fulfilled, item.quantity_ordered))

            # Update order status directly
            if item.order:
                item.order.update_status()

    def rollback(self, db, performed_by: Optional[str] = None):
        if self.state != TransactionState.COMMITTED.value:
            raise ValueError("Only committed transactions can be rolled back.")

        qty_record = self._get_quantity_record()
        if not qty_record:
            raise ValueError("Quantity record missing.")

        reversed_delta = -self.quantity_delta  # opposite sign
        rollback_requires_stock = reversed_delta < 0  # removing stock

        # ✅ NEW: Prevent negative on_hand when rollback would remove stock
        if rollback_requires_stock:
            required = abs(reversed_delta)
            if qty_record.on_hand < required:
                raise ValueError(
                    f"Cannot rollback transaction #{self.id}: "
                    f"rollback would remove {required} from on_hand, "
                    f"but only {qty_record.on_hand} is available."
                )

        reversed_txn = Transaction(
            product_id=self.product_id,
            child_product_id=self.child_product_id,
            order_id=self.order_id,
            order_item_id=self.order_item_id,
            quantity_delta=reversed_delta,
            reason=TransactionReason.ROLLBACK.value,
            state=TransactionState.COMMITTED.value,
            note=f"Reversal of transaction #{self.id}",
        )

        # Apply the reversal to physical inventory
        qty_record.on_hand += reversed_txn.quantity_delta

        if self.order_item:
            item = self.order_item
            item.quantity_fulfilled -= abs(self.quantity_delta)
            item.quantity_fulfilled = max(0, min(item.quantity_fulfilled, item.quantity_ordered))

            if item.order:
                item.order.update_status()

        self.state = TransactionState.ROLLED_BACK.value

        db.add(reversed_txn)
        return reversed_txn


    def cancel(self):
        if self.state == TransactionState.PENDING.value:

            qty_record = self._get_quantity_record()
            if qty_record:
                if self.quantity_delta > 0:
                    qty_record.ordered -= abs(self.quantity_delta)
                else:
                    qty_record.reserved -= abs(self.quantity_delta)

            self.state = TransactionState.CANCELLED.value
        else:
            raise ValueError("Only pending transactions can be cancelled.")


# =====================================================
# 🔹 Indexes
# =====================================================

Index("ix_transactions_order_id", Transaction.order_id)
Index("ix_transactions_order_item_id", Transaction.order_item_id)
Index("ix_transactions_product_id", Transaction.product_id)
Index("ix_transactions_child_product_id", Transaction.child_product_id)
Index("ix_transactions_state", Transaction.state)
Index("ix_transactions_created_at", Transaction.created_at)
