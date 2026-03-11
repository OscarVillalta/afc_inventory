"""
Security dependencies for the AFC Inventory API.

Provides authentication helpers for routes that are accessed by the QB agent.
"""
import os
from flask import request, jsonify


def enforce_agent_api_key():
    """Validate the Authorization: Bearer token for QB agent routes.

    Reads QB_AGENT_API_KEY from the environment. If the variable is not set
    or empty the check is skipped (to ease development setup). When it is
    set, the request must include an ``Authorization: Bearer <key>`` header
    that matches the configured value exactly.

    Returns:
        None if the request is allowed to proceed, or a Flask JSON error
        response (401) when authentication fails.
    """
    api_key = os.getenv("QB_AGENT_API_KEY", "").strip()
    if not api_key:
        # No key configured – authentication not enforced in this environment.
        return None

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return jsonify({"error": "Unauthorized. Authorization: Bearer <token> header required."}), 401

    token = auth_header[len("Bearer "):]
    if token != api_key:
        return jsonify({"error": "Unauthorized. Invalid API key."}), 401

    return None
