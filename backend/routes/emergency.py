from flask import Blueprint, request, jsonify
from services.emergency_service import get_shortest_route

emergency_bp = Blueprint("emergency_bp", __name__)

@emergency_bp.route("/emergency-route", methods=["POST"])
def emergency_route():
    payload = request.get_json() or {}
    # Support both 'source' and 'origin' for compatibility
    source = payload.get("source") or payload.get("origin")
    destination = payload.get("destination")

    if not source or not destination:
        return jsonify({"error": "origin/source and destination are required"}), 400

    try:
        route = get_shortest_route(source, destination)
        return jsonify(route)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
