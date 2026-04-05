import logging
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
import os

reports_bp = Blueprint('reports', __name__)

# Configure logging
logging.basicConfig(level=logging.INFO)

# Dummy AI function (replace with real model, e.g., using TensorFlow or OpenCV)
def analyze_image(image_path):
    # Placeholder: Simulate analysis
    import random
    issue_types = ['pothole', 'garbage', 'traffic_light', 'other']
    severities = ['low', 'medium', 'high']
    return {
        'issue_type': random.choice(issue_types),
        'severity': random.choice(severities)
    }

@reports_bp.route('/submit', methods=['POST'])
def submit_report():
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400
        
        # Save image temporarily (adjust path as needed)
        filename = secure_filename(file.filename)
        upload_folder = os.path.join(os.getcwd(), 'uploads')
        os.makedirs(upload_folder, exist_ok=True)
        file_path = os.path.join(upload_folder, filename)
        file.save(file_path)
        
        # AI analysis
        analysis = analyze_image(file_path)
        
        # Save to DB (example)
        db = current_app.config.get('DB')
        if db:
            db.reports.insert_one({
                'image_path': file_path,
                'issue_type': analysis['issue_type'],
                'severity': analysis['severity']
            })
        
        # Clean up (optional)
        os.remove(file_path)
        
        logging.info(f'Report submitted: {analysis}')
        return jsonify(analysis), 200
    
    except Exception as e:
        logging.error(f'Error in submit_report: {str(e)}')
        return jsonify({'error': 'Internal server error'}), 500

@reports_bp.route('/all', methods=['GET'])
def get_all_reports():
    try:
        db = current_app.config.get('DB')
        if db:
            reports = list(db.reports.find({}, {'_id': 1, 'latitude': 1, 'longitude': 1, 'issue_type': 1, 'severity': 1}))
            # Convert ObjectId to string for JSON serialization
            for report in reports:
                report['_id'] = str(report['_id'])
            return jsonify(reports), 200
        else:
            return jsonify({'error': 'Database not available'}), 500
    except Exception as e:
        logging.error(f'Error fetching reports: {str(e)}')
        return jsonify({'error': 'Internal server error'}), 500
