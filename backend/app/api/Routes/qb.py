import os
import requests
from flask import Blueprint, request, jsonify, g
from marshmallow import ValidationError, Schema, fields, EXCLUDE
from app.api.Schemas.qb_schema import QBJobResultSchema, QBJobSchema
from app.api.dependencies import enforce_agent_api_key
from database.models import Order, OUTGOING_TYPES

QB_AGENT_URL = os.getenv("QB_AGENT_URL", "http://127.0.0.1:5055")

def qb_agent_post(job: dict, timeout=60) -> dict:
    r = requests.post(f"{QB_AGENT_URL}/jobs", json=job, timeout=timeout)
    r.raise_for_status()
    return r.json()

qb_bp = Blueprint("qb", __name__)

job_schema = QBJobSchema()
job_result_schema = QBJobResultSchema()


class QBJobResultInboundSchema(Schema):
    """Schema for results posted by the polling agent."""
    class Meta:
        unknown = EXCLUDE

    jobId = fields.Str(required=True)
    success = fields.Bool(required=True)
    qbxmlRequest = fields.Str(required=False, allow_none=True)
    qbxmlResponse = fields.Str(required=False, allow_none=True)
    errorCode = fields.Str(required=False, allow_none=True)
    errorMessage = fields.Str(required=False, allow_none=True)


job_result_inbound_schema = QBJobResultInboundSchema()


@qb_bp.before_request
def authenticate_agent():
    """Enforce API key authentication for all /api/qb/ routes."""
    return enforce_agent_api_key()


# ---------------------------------------------------------------------------
# Existing push-based endpoint (kept for backward compatibility)
# ---------------------------------------------------------------------------

@qb_bp.post("/qb/job")
def run_qb_job():
    try:
        job = job_schema.load(request.get_json(force=True))
    except ValidationError as err:
        return jsonify({
            "success": False,
            "error": "Invalid job payload",
            "details": err.messages
        }), 400

    r = requests.post(
        f"{QB_AGENT_URL}/jobs",
        json=job,
        timeout=60
    )
    r.raise_for_status()

    result = job_result_schema.load(r.json())
    return jsonify(result)


# ---------------------------------------------------------------------------
# New polling endpoints
# ---------------------------------------------------------------------------

@qb_bp.get("/qb/jobs")
def get_qb_jobs():
    """Return pending QuickBooks synchronization tasks.

    Queries the database for outgoing orders that have not yet been invoiced
    in QuickBooks and returns them as a list of job descriptors in the
    ``JobDto`` format understood by the C# polling agent.

    Returns:
        200 with a JSON list when there are pending jobs.
        204 No Content when there are no pending jobs.
    """
    db = g.db
    pending_orders = (
        db.query(Order)
        .filter(
            Order.is_invoiced.is_(False),
            Order.type.in_(OUTGOING_TYPES),
        )
        .all()
    )

    if not pending_orders:
        return "", 204

    jobs = [
        {
            "jobId": f"ord_{order.id}",
            "op": "query",
            "entity": "invoice",
            "params": {
                "refnumber": order.order_number or str(order.id),
            },
        }
        for order in pending_orders
    ]

    return jsonify(jobs)


@qb_bp.post("/qb/results")
def receive_qb_result():
    """Accept a QB job result from the polling agent and update the order.

    Parses the ``jobId`` field (format ``ord_<order_id>``) to identify the
    target order, marks it as invoiced on success, and optionally stores the
    QB transaction ID extracted from the QBXML response into
    ``external_order_number`` when that field is not already populated.

    Returns:
        200 with ``{"ok": true, "order_id": <id>}`` on success.
        400 for malformed payloads.
        404 when the referenced order does not exist.
    """
    try:
        data = job_result_inbound_schema.load(request.get_json(force=True) or {})
    except ValidationError as err:
        return jsonify({"error": "Invalid result payload", "details": err.messages}), 400

    job_id: str = data.get("jobId", "")
    if not job_id.startswith("ord_"):
        return jsonify({"error": f"Unknown jobId format: {job_id!r}"}), 400

    try:
        order_id = int(job_id[4:])
    except ValueError:
        return jsonify({"error": f"Cannot parse order id from jobId: {job_id!r}"}), 400

    db = g.db
    order = db.query(Order).filter(Order.id == order_id).first()
    if order is None:
        return jsonify({"error": f"Order {order_id} not found"}), 404

    if data.get("success"):
        order.is_invoiced = True

        # Persist the QB TxnID into external_order_number when not already set.
        qbxml_response = data.get("qbxmlResponse") or ""
        if qbxml_response and not order.external_order_number:
            txn_id = _extract_txn_id(qbxml_response)
            if txn_id:
                order.external_order_number = txn_id

        db.commit()

    return jsonify({"ok": True, "order_id": order_id})


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_txn_id(qbxml_response: str) -> str | None:
    """Extract the first ``<TxnID>`` value from a QBXML response string."""
    import defusedxml.ElementTree as ET

    try:
        root = ET.fromstring(qbxml_response)
    except ET.ParseError:
        return None

    elem = root.find(".//TxnID")
    if elem is not None and elem.text:
        return elem.text.strip()
    return None