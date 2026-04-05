from flask import Blueprint, request, jsonify
from services.traffic_service import predict_traffic as predict_traffic_service

predict_bp = Blueprint("predict_bp", __name__)

@predict_bp.route("/predict-traffic", methods=["POST"])
def predict_traffic():
    payload = request.get_json() or {}
    result = predict_traffic_service(payload)
    return jsonify(result)
