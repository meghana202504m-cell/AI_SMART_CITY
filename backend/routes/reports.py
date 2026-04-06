import logging
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
import os
import sys
from datetime import datetime

# Import workflow service
try:
    from backend.services.report_workflow_service import (
        enrich_report,
        prepare_response,
        convert_objectid_to_string,
        update_report_status,
        apply_authority_routing
    )
except ImportError:
    from services.report_workflow_service import (
        enrich_report,
        prepare_response,
        convert_objectid_to_string,
        update_report_status,
        apply_authority_routing
    )

reports_bp = Blueprint('reports', __name__)

# Configure logging
logging.basicConfig(level=logging.INFO)


# ==================== HELPERS ====================

def serialize_response(obj):
    """Convert datetime objects to ISO format strings for JSON serialization."""
    if isinstance(obj, dict):
        return {k: serialize_response(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [serialize_response(item) for item in obj]
    elif isinstance(obj, datetime):
        return obj.isoformat()
    return obj




# Dummy AI function (replace with real model, e.g., using TensorFlow or OpenCV)
def analyze_image(image_path):
    """Legacy image analysis function - preserved for backward compatibility."""
    import random
    issue_types = ['pothole', 'garbage', 'traffic_light', 'other']
    severities = ['low', 'medium', 'high']
    return {
        'issue_type': random.choice(issue_types),
        'severity': random.choice(severities)
    }


@reports_bp.route('/submit', methods=['POST'])
def submit_report():
    """
    Submit a report with image.
    Flow: Image → Analyze → Enrich with Workflow → Store → Return
    """
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400
        
        # Save image temporarily
        filename = secure_filename(file.filename)
        upload_folder = os.path.join(os.getcwd(), 'data/uploads')
        os.makedirs(upload_folder, exist_ok=True)
        file_path = os.path.join(upload_folder, filename)
        file.save(file_path)
        
        # AI analysis (legacy function - preserved)
        analysis = analyze_image(file_path)
        
        # Build the report dict to be enriched
        report_data = {
            'image_path': file_path,
            'issue_type': analysis['issue_type'],
            'severity': analysis['severity'],
            'description': request.form.get('description', f"Image-based report: {analysis['issue_type']}"),
            'location': {
                'lat': float(request.form.get('latitude', 0.0)),
                'lng': float(request.form.get('longitude', 0.0))
            },
            'reporter': request.form.get('reporter', 'anonymous'),
            'type': analysis['issue_type']  # For compatibility with service
        }
        
        # ✅ ENRICH REPORT WITH WORKFLOW (AI + Routing + Status Tracking)
        enriched_report = enrich_report(report_data)
        
        # ✅ APPLY AUTHORITY ROUTING BEFORE SAVING (Assign to nearest office)
        enriched_report = apply_authority_routing(enriched_report)
        
        # Save enriched report to DB
        db = current_app.config.get('DB')
        if db:
            result = db.reports.insert_one(enriched_report)
            enriched_report['_id'] = result.inserted_id
        else:
            logging.warning("Database not available - report not saved")
        
        # Clean up image
        try:
            os.remove(file_path)
        except:
            pass
        
        # Prepare response (backward compatible)
        response_data = prepare_response(enriched_report)
        
        logging.info(f'Report submitted and enriched: {response_data["ai_category"]} - {response_data["priority"]}')
        return jsonify(serialize_response(response_data)), 200
    
    except Exception as e:
        logging.error(f'Error in submit_report: {str(e)}')
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500



@reports_bp.route('/all', methods=['GET'])
def get_all_reports():
    """
    Get all reports with enriched data (AI category, priority, status, department).
    Returns backward-compatible format plus new fields.
    """
    try:
        db = current_app.config.get('DB')
        if db:
            # Fetch all reports
            reports_cursor = db.reports.find({})
            reports = []
            
            for report in reports_cursor:
                # Convert ObjectId to string
                report = convert_objectid_to_string(report)
                # Prepare response with both old and new fields
                reports.append(prepare_response(report))
            
            logging.info(f'Retrieved {len(reports)} reports with enriched data')
            return jsonify(serialize_response(reports)), 200
        else:
            return jsonify({'error': 'Database not available'}), 500
    except Exception as e:
        logging.error(f'Error fetching reports: {str(e)}')
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


@reports_bp.route('/report-issue', methods=['POST'])
def report_issue():
    """
    Submit a report via JSON (text-based).
    Flow: JSON → Build Report → Enrich with Workflow → Store → Return
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        # Extract or provide default values
        report_data = {
            'type': data.get('type') or data.get('issue_type', 'general'),
            'description': data.get('description', ''),
            'location': data.get('location', {'lat': 0.0, 'lng': 0.0}),
            'reporter': data.get('reporter', 'anonymous'),
            'issue_type': data.get('issue_type') or data.get('type', 'general'),
            'sentiment': data.get('sentiment', 'general'),
        }
        
        # ✅ ENRICH REPORT WITH WORKFLOW (AI Classification + Priority + Routing + Status)
        enriched_report = enrich_report(report_data)
        
        # Save enriched report to DB
        db = current_app.config.get('DB')
        if db:
            result = db.reports.insert_one(enriched_report)
            enriched_report['_id'] = result.inserted_id
            
            # ✅ APPLY AUTHORITY ROUTING (Assign to nearest office)
            enriched_report = apply_authority_routing(enriched_report)
            
            logging.info(f'Report stored: {result.inserted_id}')
        else:
            logging.warning("Database not available - report not saved to persistent storage")
        
        # Prepare response
        response_data = prepare_response(enriched_report)
        
        logging.info(f'Report submitted: {response_data["ai_category"]} - Priority: {response_data["priority"]}')
        return jsonify(serialize_response(response_data)), 201
    
    except Exception as e:
        logging.error(f'Error in report_issue: {str(e)}')
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


@reports_bp.route('/status/<report_id>', methods=['PUT'])
def update_status(report_id):
    """
    Update report status and track status history.
    Body: {"status": "in_progress"} or {"status": "resolved"}
    """
    try:
        from bson.objectid import ObjectId
        
        data = request.get_json()
        if not data or 'status' not in data:
            return jsonify({'error': 'Status field required'}), 400
        
        new_status = data['status']
        
        db = current_app.config.get('DB')
        if not db:
            return jsonify({'error': 'Database not available'}), 500
        
        # Find and update report
        try:
            report_oid = ObjectId(report_id)
        except:
            return jsonify({'error': 'Invalid report ID'}), 400
        
        report = db.reports.find_one({'_id': report_oid})
        if not report:
            return jsonify({'error': 'Report not found'}), 404
        
        # Update status with history
        report = update_report_status(report, new_status)
        
        # Save updated report
        db.reports.update_one({'_id': report_oid}, {'$set': report})
        
        # Prepare and return response
        response_data = prepare_response(report)
        
        logging.info(f'Report {report_id} status updated to {new_status}')
        return jsonify(serialize_response(response_data)), 200
    
    except Exception as e:
        logging.error(f'Error updating report status: {str(e)}')
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

