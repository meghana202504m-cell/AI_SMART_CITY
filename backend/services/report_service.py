"""Service layer for report handling."""
from models.report import Report


def classify_issue(text):
    text_lower = (text or "").lower()
    if any(k in text_lower for k in ["pothole", "road", "crack", "defect"]):
        return "road_defect"
    if any(k in text_lower for k in ["garbage", "waste", "bin", "trash"]):
        return "waste_management"
    if any(k in text_lower for k in ["traffic", "jam", "accident"]):
        return "traffic_issue"
    return "general"


def build_report(payload):
    issue_type = payload.get("type", "general")
    description = payload.get("description", "")
    location = payload.get("location", {})
    reporter = payload.get("reporter", "anonymous")

    sentiment = classify_issue(description)

    report = Report(
        issue_type=issue_type,
        description=description,
        location=location,
        reporter=reporter,
        sentiment=sentiment,
        status="new",
    )
    return report
from flask import Blueprint, request, jsonify, current_app
from services.report_service import build_report

reports_bp = Blueprint("reports", __name__)

@reports_bp.route("/report-issue", methods=["POST"])
def report_issue():
    data = request.json

    report = build_report(data)

    db = current_app.config["DB"]

    # ✅ SAVE TO DATABASE
    db.reports.insert_one(report.__dict__)

    return jsonify({"message": "Report stored successfully"})