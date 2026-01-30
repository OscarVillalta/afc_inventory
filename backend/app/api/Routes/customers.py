from flask import g, jsonify, request, Blueprint
from sqlalchemy import select
from marshmallow import ValidationError
from database.models import Customer
from app.api.Schemas.customer_schema import CustomerSchema

customer_bp = Blueprint("customers", __name__)
customer_schema = CustomerSchema()
customer_list_schema = CustomerSchema(many=True)

# =====================================================
# 🔹 GET all customers
# =====================================================
@customer_bp.route("/customers", methods=["GET"])
def get_customers():
    db = g.db
    customers = db.execute(select(Customer)).scalars().all()
    return jsonify(customer_list_schema.dump(customers)), 200


# =====================================================
# 🔹 GET single customer
# =====================================================
@customer_bp.route("/customers/<int:id>", methods=["GET"])
def get_customer(id):
    db = g.db
    customer = db.execute(select(Customer).where(Customer.id == id)).scalars().first()
    if not customer:
        return jsonify({"error": "Customer not found"}), 404
    return jsonify(customer_schema.dump(customer)), 200


# =====================================================
# 🔹 POST new customer
# =====================================================
@customer_bp.route("/customers", methods=["POST"])
def create_customer():
    db = g.db
    try:
        data = customer_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    # Ensure name is unique
    existing = db.execute(
        select(Customer).where(Customer.name == data["name"])
    ).scalar_one_or_none()
    if existing:
        return jsonify({"error": "Customer with this name already exists"}), 400

    new_customer = Customer.from_dict(data)
    db.add(new_customer)
    db.commit()
    return jsonify(customer_schema.dump(new_customer)), 201


# =====================================================
# 🔹 PATCH customer (partial update)
# =====================================================
@customer_bp.route("/customers/<int:id>", methods=["PATCH"])
def update_customer(id):
    db = g.db
    customer = db.execute(select(Customer).where(Customer.id == id)).scalars().first()
    if not customer:
        return jsonify({"error": "Customer not found"}), 404

    try:
        data = customer_schema.load(request.get_json(), partial=True)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    for key, value in data.items():
        setattr(customer, key, value)

    db.commit()
    return jsonify(customer_schema.dump(customer)), 200


# =====================================================
# 🔹 DELETE customer
# =====================================================
@customer_bp.route("/customers/<int:id>", methods=["DELETE"])
def delete_customer(id):
    db = g.db
    customer = db.execute(select(Customer).where(Customer.id == id)).scalars().first()
    if not customer:
        return jsonify({"error": "Customer not found"}), 404

    db.delete(customer)
    db.commit()
    return jsonify({"message": "Customer deleted successfully"}), 200
