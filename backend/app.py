"""
Smart City AI Backend - Flask Application
Features: Geocoding, Traffic Prediction, Report Management, Image Analysis, Authentication, Alerts
"""

import logging
import os
import json
import uuid
import hashlib
import smtplib
import jwt
from datetime import datetime, timedelta
from functools import wraps
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import cv2
import numpy as np
import requests
import bcrypt
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from PIL import Image
from io import BytesIO
import sys

# Ensure local backend package paths are available for both script execution and package imports
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BACKEND_DIR, os.pardir))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

try:
    from backend.routes.predict import predict_bp
    from backend.routes.emergency import emergency_bp
    from backend.routes.directions import directions_bp
    from backend.routes.reports import reports_bp
except ImportError:
    from routes.predict import predict_bp
    from routes.emergency import emergency_bp
    from routes.directions import directions_bp
    from routes.reports import reports_bp

# ==================== INITIALIZATION ====================
load_dotenv()
logging.basicConfig(level=logging.INFO)
app = Flask(__name__)
app.logger.setLevel(logging.INFO)
CORS(
    app,
    resources={r"/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000"]}},
    supports_credentials=True,
    expose_headers=["Content-Type"],
)

def create_app():
    """Return the Flask application instance."""
    return app

@app.before_request
def log_request():
    app.logger.info("Incoming request: %s %s", request.method, request.path)

# Register reusable blueprints
app.register_blueprint(predict_bp, url_prefix="/api")
app.register_blueprint(emergency_bp, url_prefix="/api")
app.register_blueprint(directions_bp, url_prefix="/api")
app.register_blueprint(reports_bp, url_prefix="/api")

# API Keys
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "your_google_maps_key")
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "your_openweather_key")
JWT_SECRET = os.getenv("JWT_SECRET", "smart_city_secret_2024")
JWT_ALGORITHM = "HS256"

# Email Configuration
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "smartcity@gmail.com")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD", "your_app_password")

# MongoDB Configuration (will fallback to JSON if not available)
try:
    from flask_pymongo import PyMongo
    mongo = PyMongo(app)
    app.config["MONGO_URI"] = os.getenv(
        "MONGO_URI",
        "mongodb://localhost:27017/smart_city"
    )
    if hasattr(mongo, 'db'):
        app.config['DB'] = mongo.db
    HAS_MONGODB = True
except:
    HAS_MONGODB = False

# File paths
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
REPORTS_FILE = os.path.join(DATA_DIR, "reports_store.json")
UPLOADS_DIR = os.path.join(DATA_DIR, "uploads")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)

# Initialize reports storage
if not os.path.exists(REPORTS_FILE):
    with open(REPORTS_FILE, "w") as f:
        json.dump([], f)

# ==================== AUTHENTICATION HELPERS ====================
def hash_password(password):
    """Hash password using bcrypt"""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(password, hashed):
    """Verify password against hash"""
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))

def create_jwt_token(user_id, expires_in=7):
    """Create JWT token with expiry"""
    payload = {
        "user_id": str(user_id),
        "exp": datetime.utcnow() + timedelta(days=expires_in),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_jwt_token(token):
    """Verify JWT token and return user_id"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("user_id")
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def token_required(f):
    """Decorator to protect routes with JWT"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if "Authorization" in request.headers:
            auth_header = request.headers["Authorization"]
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({"success": False, "error": "Invalid token format"}), 401

        if not token:
            return jsonify({"success": False, "error": "Missing authentication token"}), 401

        user_id = verify_jwt_token(token)
        if not user_id:
            return jsonify({"success": False, "error": "Token expired or invalid"}), 401

        request.user_id = user_id
        return f(*args, **kwargs)
    return decorated

# ==================== WASTE CLASSIFICATION ====================
def classify_waste_image(image_path):
    """
    Basic waste classification using image analysis.
    Returns: {type, severity, confidence, is_waste}
    """
    try:
        # Read image
        img = cv2.imread(image_path)
        if img is None:
            return {"type": "unknown", "severity": "low", "confidence": 0.0, "is_waste": False}

        # Convert to HSV for color analysis
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

        # Count color distributions
        h_hist = cv2.calcHist([hsv], [0], None, [180], [0, 180])
        s_hist = cv2.calcHist([hsv], [1], None, [256], [0, 256])

        # Simple heuristic rules
        brown_green_ratio = (h_hist[20:40].sum() + h_hist[60:90].sum()) / max(h_hist.sum(), 1)
        gray_ratio = np.mean(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)) / 255

        waste_score = 0.0
        waste_type = "other"

        # Organic waste (greenish/brownish, low saturation)
        if brown_green_ratio > 0.3 and s_hist[:100].sum() > s_hist[100:].sum():
            waste_type = "organic"
            waste_score = min(brown_green_ratio * 1.2, 1.0)

        # Metal/plastic waste (high saturation, metallic gray)
        elif s_hist[100:].sum() > s_hist[:100].sum():
            waste_type = "metal_plastic"
            waste_score = 0.7

        # Paper waste (light colors)
        elif gray_ratio > 0.6:
            waste_type = "paper"
            waste_score = 0.6

        # Determine severity
        if waste_score > 0.7:
            severity = "high"
        elif waste_score > 0.4:
            severity = "medium"
        else:
            severity = "low"

        return {
            "type": waste_type,
            "severity": severity,
            "confidence": float(waste_score),
            "is_waste": waste_score > 0.3
        }
    except Exception as e:
        print(f"Waste classification error: {e}")
        return {"type": "unknown", "severity": "low", "confidence": 0.0, "is_waste": False}

# ==================== ALERT SYSTEM ====================
def send_alert_to_municipality(report):
    """
    Send alert email to municipal authority for high-priority waste.
    """
    try:
        # Get municipality contact (simplified - in production, lookup by area/pincode)
        municipalities = {
            "default": "municipal.authority@city.gov.in",
            "pickup": "waste.pickup@city.gov.in"
        }
        recipient = municipalities.get("default")

        subject = f"Alert - Waste Issue at {report.get('location_name', 'Unknown Location')}"
        severity = report.get("analysis", {}).get("severity", "medium").upper()
        waste_type = report.get("analysis", {}).get("type", "unknown").title()

        html_body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
                    <h2 style="color: #c41e3a;">Waste Management Alert</h2>
                    <hr style="border: none; border-top: 1px solid #ddd;">
                    
                    <p><strong>Severity Level:</strong> <span style="color: #c41e3a; font-size: 16px;">{severity}</span></p>
                    <p><strong>Waste Type:</strong> {waste_type}</p>
                    <p><strong>Location:</strong> {report.get('location_name', 'N/A')}</p>
                    <p><strong>Coordinates:</strong> {report.get('latitude', 'N/A')}, {report.get('longitude', 'N/A')}</p>
                    <p><strong>Description:</strong> {report.get('description', 'N/A')}</p>
                    <p><strong>Reported by:</strong> {report.get('reporter', 'Anonymous')} (ID: {report.get('userId', 'N/A')})</p>
                    <p><strong>Time:</strong> {report.get('created_at', 'N/A')}</p>
                    
                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p><strong>AI Analysis:</strong></p>
                        <ul>
                            <li>Confidence: {report.get('analysis', {}).get('confidence', 0) * 100:.1f}%</li>
                            <li>Is Waste: {'Yes' if report.get('analysis', {}).get('is_waste') else 'No'}</li>
                        </ul>
                    </div>
                    
                    <p style="background-color: #fffacd; padding: 10px; border-radius: 5px;">
                        Action Required: Please dispatch cleanup crew within 24 hours.
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #ddd;">
                    <p style="font-size: 12px; color: #888;">This is an automated message from Smart City AI System.</p>
                </div>
            </body>
        </html>
        """

        try:
            server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)

            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = SENDER_EMAIL
            msg["To"] = recipient

            msg.attach(MIMEText(html_body, "html"))
            server.send_message(msg)
            server.quit()

            return {"success": True, "message": f"Alert sent to {recipient}"}
        except Exception as e:
            print(f"Email error: {e}")
            return {"success": False, "message": str(e)}

    except Exception as e:
        print(f"Alert system error: {e}")
        return {"success": False, "message": str(e)}

# ==================== GEOCODING & PLACES ====================
def geocode_address(address):
    """Geocode address using Google Maps API"""
    try:
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {"address": address, "key": GOOGLE_MAPS_API_KEY}
        response = requests.get(url, params=params, timeout=5)
        data = response.json()

        if data["results"]:
            result = data["results"][0]
            return {
                "formatted_address": result["formatted_address"],
                "lat": result["geometry"]["location"]["lat"],
                "lng": result["geometry"]["location"]["lng"],
                "place_id": result.get("place_id", ""),
            }
        return None
    except Exception as e:
        print(f"Geocoding error: {e}")
        return None

def autocomplete_places(query):
    """Autocomplete place suggestions using Google Places API"""
    try:
        url = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
        params = {"input": query, "key": GOOGLE_MAPS_API_KEY}
        response = requests.get(url, params=params, timeout=5)
        data = response.json()

        predictions = [
            {
                "description": p["description"],
                "place_id": p["place_id"],
            }
            for p in data.get("predictions", [])
        ]
        return predictions
    except Exception as e:
        print(f"Autocomplete error: {e}")
        return []

def get_place_details(place_id):
    """Get place coordinates from place_id"""
    try:
        url = "https://maps.googleapis.com/maps/api/place/details/json"
        params = {"place_id": place_id, "fields": "geometry,formatted_address", "key": GOOGLE_MAPS_API_KEY}
        response = requests.get(url, params=params, timeout=5)
        data = response.json()

        if data.get("result"):
            result = data["result"]
            return {
                "lat": result["geometry"]["location"]["lat"],
                "lng": result["geometry"]["location"]["lng"],
                "formatted_address": result.get("formatted_address", ""),
            }
        return None
    except Exception as e:
        print(f"Place details error: {e}")
        return None

def get_emergency_route(origin, destination):
    """Get route using Google Directions API"""
    try:
        url = "https://maps.googleapis.com/maps/api/directions/json"
        params = {
            "origin": f"{origin['lat']},{origin['lng']}",
            "destination": f"{destination['lat']},{destination['lng']}",
            "key": GOOGLE_MAPS_API_KEY,
        }
        response = requests.get(url, params=params, timeout=5)
        data = response.json()

        if data["routes"]:
            route = data["routes"][0]
            leg = route["legs"][0]
            points = []

            for step in leg["steps"]:
                polyline = step["polyline"]["points"]
                decoded = _decode_polyline(polyline)
                points.extend(decoded)

            return {"success": True, "route": points}
        return {"success": False, "error": "No route found"}
    except Exception as e:
        print(f"Directions error: {e}")
        return {"success": False, "error": str(e)}

def _decode_polyline(polyline_str):
    """Decode Google polyline to lat/lng points"""
    index, lat, lng = 0, 0, 0
    coordinates = []
    changes = {"latitude": 0, "longitude": 0}

    while index < len(polyline_str):
        for unit in ["latitude", "longitude"]:
            shift, result = 0, 0
            while True:
                byte = ord(polyline_str[index]) - 63
                index += 1
                result |= (byte & 0x1f) << shift
                shift += 5
                if not byte >= 0x20:
                    break
            if result & 1:
                changes[unit] = ~(result >> 1)
            else:
                changes[unit] = result >> 1

        lat += changes["latitude"]
        lng += changes["longitude"]
        coordinates.append((lat / 1e5, lng / 1e5))

    return coordinates

# ==================== WEATHER ====================
def fetch_weather(city, lat, lon):
    """Fetch weather data from OpenWeatherMap"""
    try:
        url = "https://api.openweathermap.org/data/2.5/weather"
        params = {"lat": lat, "lon": lon, "appid": OPENWEATHER_API_KEY, "units": "metric"}
        response = requests.get(url, params=params, timeout=5)
        data = response.json()

        if response.status_code == 200:
            return {
                "description": data["weather"][0]["main"],
                "main": data["weather"][0]["main"],
                "temperature": data["main"]["temp"],
                "city": city or data.get("name", "Unknown"),
            }
        return {"description": "Unknown", "main": "Clear", "temperature": 25, "city": city}
    except Exception as e:
        print(f"Weather error: {e}")
        return {"description": "Unknown", "main": "Clear", "temperature": 25, "city": city}

# ==================== TRAFFIC PREDICTION ====================
def score_congestion(hour, day_of_week, weather_label):
    """Score traffic congestion (0-100) based on heuristics"""
    score = 40  # Base score

    # Peak hours boost
    if 7 <= hour <= 9 or 17 <= hour <= 19:
        score += 25
    elif 10 <= hour <= 16:
        score += 10

    # Weekday vs weekend
    if day_of_week < 5:  # Weekday
        score += 15
    else:  # Weekend
        score -= 10

    # Weather impact
    weather_boost = {
        "Clear": 0,
        "Clouds": 5,
        "Rain": 25,
        "Thunderstorm": 30,
        "Snow": 20,
    }
    score += weather_boost.get(weather_label, 0)

    return min(max(score, 0), 100)

def get_congestion_level(score):
    """Convert congestion score to level"""
    if score < 30:
        return "Low"
    elif score < 60:
        return "Moderate"
    elif score < 80:
        return "High"
    else:
        return "Severe"

# ==================== REPORT MANAGEMENT ====================
def load_reports():
    """Load reports from JSON file"""
    try:
        with open(REPORTS_FILE, "r") as f:
            return json.load(f)
    except:
        return []

def save_reports(reports):
    """Save reports to JSON file"""
    try:
        with open(REPORTS_FILE, "w") as f:
            json.dump(reports, f, indent=2, default=str)
    except Exception as e:
        print(f"Save reports error: {e}")

def generate_id():
    """Generate unique ID"""
    return str(uuid.uuid4())

def make_timestamp():
    """Get current timestamp"""
    return datetime.utcnow().isoformat() + "Z"

# ==================== ROUTES: AUTHENTICATION ====================
@app.route("/api/auth/register", methods=["POST"])
def register():
    """Register new user"""
    try:
        data = request.json
        name = data.get("name", "").strip()
        email = data.get("email", "").strip()
        password = data.get("password", "").strip()
        locality = data.get("locality", "").strip()
        age = data.get("age", 0)

        # Validation
        if not name or not email or not password or len(password) < 6:
            return jsonify({"success": False, "error": "Invalid input"}), 400

        # Check if user exists (using JSON fallback for now)
        try:
            users_file = os.path.join(DATA_DIR, "users.json")
            if os.path.exists(users_file):
                with open(users_file, "r") as f:
                    users = json.load(f)
                    if any(u["email"] == email for u in users):
                        return jsonify({"success": False, "error": "Email already registered"}), 400
            else:
                users = []
        except:
            users = []

        # Create user
        user = {
            "_id": generate_id(),
            "name": name,
            "email": email,
            "password": hash_password(password),
            "locality": locality,
            "age": age,
            "created_at": make_timestamp(),
        }

        # Save user
        users.append(user)
        users_file = os.path.join(DATA_DIR, "users.json")
        with open(users_file, "w") as f:
            json.dump(users, f, indent=2, default=str)

        # Create JWT token
        token = create_jwt_token(user["_id"])

        return jsonify({
            "success": True,
            "message": "Registration successful",
            "token": token,
            "user": {
                "id": user["_id"],
                "name": name,
                "email": email,
                "locality": locality,
            }
        }), 201

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/auth/login", methods=["POST"])
def login():
    """Login user"""
    try:
        data = request.json
        print("Login request received:", data)  # Debug log
        email = data.get("email", "").strip()
        password = data.get("password", "").strip()

        if not email or not password:
            print("Login failed: Missing email or password")
            return jsonify({"success": False, "error": "Email and password required"}), 400

        # Find user
        try:
            users_file = os.path.join(DATA_DIR, "users.json")
            if not os.path.exists(users_file):
                print("Login failed: Users file not found")
                return jsonify({"success": False, "error": "Invalid credentials"}), 401

            with open(users_file, "r") as f:
                users = json.load(f)
                user = next((u for u in users if u["email"] == email), None)

            if not user:
                print(f"Login failed: User not found for email {email}")
                return jsonify({"success": False, "error": "Invalid credentials"}), 401

            if not verify_password(password, user["password"]):
                print(f"Login failed: Invalid password for user {email}")
                return jsonify({"success": False, "error": "Invalid credentials"}), 401

        except Exception as e:
            print(f"Login error reading users file: {e}")
            return jsonify({"success": False, "error": "Invalid credentials"}), 401

        # Create JWT token
        token = create_jwt_token(user["_id"])
        print(f"Login successful for user: {email}")

        return jsonify({
            "success": True,
            "message": "Login successful",
            "token": token,
            "user": {
                "id": user["_id"],
                "name": user["name"],
                "email": user["email"],
                "locality": user["locality"],
            }
        }), 200

    except Exception as e:
        print(f"Login unexpected error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/auth/verify", methods=["GET"])
@token_required
def verify_token():
    """Verify JWT token"""
    try:
        try:
            users_file = os.path.join(DATA_DIR, "users.json")
            with open(users_file, "r") as f:
                users = json.load(f)
                user = next((u for u in users if u["_id"] == request.user_id), None)

            if not user:
                return jsonify({"success": False, "error": "User not found"}), 404

            return jsonify({
                "success": True,
                "user": {
                    "id": user["_id"],
                    "name": user["name"],
                    "email": user["email"],
                    "locality": user["locality"],
                }
            }), 200
        except:
            return jsonify({"success": False, "error": "User not found"}), 404

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ==================== ROUTES: GEOCODING ====================
@app.route("/api/autocomplete", methods=["GET"])
def autocomplete():
    """Autocomplete place suggestions"""
    try:
        query = request.args.get("query", "")
        if not query or len(query) < 2:
            return jsonify({"success": False, "error": "Query too short"}), 400

        predictions = autocomplete_places(query)
        return jsonify({"success": True, "data": predictions}), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/geocode", methods=["GET"])
def geocode():
    """Geocode address to coordinates"""
    try:
        address = request.args.get("address", "")
        if not address:
            return jsonify({"success": False, "error": "Address required"}), 400

        result = geocode_address(address)
        if not result:
            return jsonify({"success": False, "error": "Address not found"}), 404

        return jsonify({"success": True, "data": result}), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/place-details", methods=["GET"])
def place_details():
    """Get place details from place_id"""
    try:
        place_id = request.args.get("place_id", "")
        if not place_id:
            return jsonify({"success": False, "error": "Place ID required"}), 400

        details = get_place_details(place_id)
        if not details:
            return jsonify({"success": False, "error": "Place not found"}), 404

        return jsonify({"success": True, "data": details}), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ==================== ROUTES: TRAFFIC ====================
@app.route("/api/traffic/predict", methods=["POST"])
def predict_traffic():
    """Predict traffic congestion"""
    try:
        data = request.json
        place = data.get("place")
        lat = data.get("lat")
        lng = data.get("lng")
        hour = data.get("hour")
        day_of_week = data.get("day_of_week")
        weather = data.get("weather", "Clear")

        if not place or lat is None or lng is None:
            return jsonify({"success": False, "error": "Missing required fields"}), 400

        # Get weather if not provided
        if hour is None or day_of_week is None:
            now = datetime.utcnow()
            hour = now.hour
            day_of_week = now.weekday()

        # Score congestion
        score = score_congestion(hour, day_of_week, weather)
        level = get_congestion_level(score)

        return jsonify({
            "success": True,
            "data": {
                "congestion_score": score,
                "level": level,
                "location": place,
                "weather": weather,
                "hour": hour,
                "day_of_week": day_of_week,
            }
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ==================== ROUTES: EMERGENCY ====================
@app.route("/api/emergency/route", methods=["POST"])
def emergency_route():
    """Get emergency route"""
    try:
        data = request.json
        origin = data.get("origin")
        destination = data.get("destination")

        if not origin or not destination:
            return jsonify({"success": False, "error": "Origin and destination required"}), 400

        return get_emergency_route(origin, destination), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ==================== ROUTES: WASTE MANAGEMENT ====================
@app.route("/api/upload-waste", methods=["POST"])
@token_required
def upload_waste():
    """Upload waste image and analyze"""
    try:
        if "image" not in request.files:
            return jsonify({"success": False, "error": "Image required"}), 400

        file = request.files["image"]
        description = request.form.get("description", "")
        location_name = request.form.get("location_name", "")
        latitude = request.form.get("latitude", 0)
        longitude = request.form.get("longitude", 0)

        if file.filename == "":
            return jsonify({"success": False, "error": "No file selected"}), 400

        # Validate file type
        allowed_ext = {"png", "jpg", "jpeg", "gif"}
        if not ("." in file.filename and file.filename.rsplit(".", 1)[1].lower() in allowed_ext):
            return jsonify({"success": False, "error": "Invalid file type"}), 400

        # Save image
        image_id = generate_id()
        filename = f"{image_id}.jpg"
        filepath = os.path.join(UPLOADS_DIR, filename)

        # Validate image
        try:
            img = Image.open(file.stream)
            if img.size[0] * img.size[1] > 10000000:  # 10 MP limit
                return jsonify({"success": False, "error": "Image too large"}), 400
            img.save(filepath, "JPEG")
        except Exception as e:
            return jsonify({"success": False, "error": f"Invalid image: {str(e)}"}), 400

        # Classify waste
        analysis = classify_waste_image(filepath)

        # Create report
        report = {
            "_id": generate_id(),
            "userId": request.user_id,
            "issue_type": "waste",
            "description": description,
            "reporter": "Authenticated User",
            "location_name": location_name,
            "latitude": float(latitude),
            "longitude": float(longitude),
            "image_id": image_id,
            "image_url": f"/api/image/{image_id}",
            "analysis": analysis,
            "status": "open",
            "created_at": make_timestamp(),
        }

        # Store in JSON file
        reports = load_reports()
        reports.append(report)
        save_reports(reports)

        # Send alert if high severity
        if analysis.get("severity") == "high":
            send_alert_to_municipality(report)

        return jsonify({
            "success": True,
            "message": "Waste report submitted successfully",
            "report_id": report["_id"],
            "analysis": analysis
        }), 201

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/image/<image_id>", methods=["GET"])
def get_image(image_id):
    """Retrieve waste image"""
    try:
        filepath = os.path.join(UPLOADS_DIR, f"{image_id}.jpg")
        if not os.path.exists(filepath):
            return jsonify({"success": False, "error": "Image not found"}), 404

        with open(filepath, "rb") as f:
            return f.read(), 200, {"Content-Type": "image/jpeg"}

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ==================== ROUTES: REPORTS ====================
@app.route("/api/report", methods=["POST"])
def submit_report():
    """Submit civic report"""
    try:
        # Handle both JSON and FormData
        if request.content_type and 'application/json' in request.content_type:
            data = request.json
            description = data.get("description", "")
            latitude = data.get("latitude")
            longitude = data.get("longitude")
            issue_type = data.get("issue_type", "other")
            reporter = data.get("reporter", "Anonymous")
            location_name = data.get("locationName", "")
            user_id = data.get("userId", generate_id())
        else:
            # Handle FormData
            description = request.form.get("text", "")
            location_name = request.form.get("location", "")
            # For now, use default coordinates if not provided
            latitude = request.form.get("latitude", 12.9716)  # Default Bangalore coordinates
            longitude = request.form.get("longitude", 77.5946)
            issue_type = request.form.get("issue_type", "other")
            reporter = request.form.get("reporter", "Anonymous")
            user_id = request.form.get("userId", generate_id())

        if not description:
            return jsonify({"success": False, "error": "Description is required"}), 400

        if latitude is None or longitude is None:
            return jsonify({"success": False, "error": "Location coordinates are required"}), 400

        # Convert to float if they are strings
        try:
            latitude = float(latitude)
            longitude = float(longitude)
        except (ValueError, TypeError):
            return jsonify({"success": False, "error": "Invalid latitude or longitude"}), 400

        # Create report
        report = {
            "_id": generate_id(),
            "userId": user_id,
            "issue_type": issue_type,
            "description": description,
            "reporter": reporter,
            "location_name": location_name,
            "latitude": latitude,
            "longitude": longitude,
            "status": "open",
            "created_at": make_timestamp(),
        }

        # Store report
        if HAS_MONGODB and 'DB' in app.config:
            try:
                db = app.config['DB']
                result = db.reports.insert_one(report)
                app.logger.info(f"Report stored in MongoDB with ID: {result.inserted_id}")
            except Exception as e:
                app.logger.error(f"MongoDB insertion failed: {e}")
                return jsonify({"success": False, "error": "Database error"}), 500
        else:
            # Fallback to JSON file storage
            reports = load_reports()
            reports.append(report)
            save_reports(reports)
            app.logger.info("Report stored in JSON file (MongoDB not available)")

        return jsonify({
            "success": True,
            "message": "Report submitted successfully",
            "report_id": report["_id"]
        }), 201

    except Exception as e:
        app.logger.error(f"Error submitting report: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/report-issue", methods=["POST"])
@app.route("/reportIssue", methods=["POST"])
def report_issue_alias():
    """Legacy alias for report submission."""
    return submit_report()

@app.route("/api/reports", methods=["GET"])
def get_reports():
    """Get reports with optional filtering"""
    try:
        user_id = request.args.get("userId")
        locality = request.args.get("locality")
        reports = []

        if HAS_MONGODB and "DB" in app.config:
            db = app.config["DB"]
            query = {}
            if user_id:
                query["userId"] = user_id

            cursor = db.reports.find(query).sort("_id", -1).limit(100)
            reports = list(cursor)
            for report in reports:
                report["_id"] = str(report["_id"])
        else:
            reports = load_reports()

            if user_id:
                reports = [r for r in reports if r.get("userId") == user_id]
            if locality:
                try:
                    users_file = os.path.join(DATA_DIR, "users.json")
                    if os.path.exists(users_file):
                        with open(users_file, "r") as f:
                            users = json.load(f)
                            user_localities = {u["_id"]: u.get("locality") for u in users}
                            reports = [r for r in reports if user_localities.get(r.get("userId")) == locality]
                except:
                    pass

            reports.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            reports = reports[:100]

        print("Fetched reports:", reports)
        app.logger.info("Fetched %d reports", len(reports))

        return jsonify({"success": True, "reports": reports, "data": reports}), 200

    except Exception as e:
        app.logger.error("Error fetching reports: %s", e)
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/get-reports", methods=["GET"])
def get_reports_alias():
    """Legacy alias for retrieving reports."""
    return get_reports()

@app.route("/api/reports/<report_id>", methods=["GET"])
def get_report(report_id):
    """Get specific report"""
    try:
        reports = load_reports()
        for report in reports:
            if report.get("_id") == report_id:
                return jsonify({"success": True, "data": report}), 200

        return jsonify({"success": False, "error": "Report not found"}), 404

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/reports/<report_id>", methods=["PUT"])
def update_report(report_id):
    """Update report status"""
    try:
        data = request.json
        status = data.get("status", "open")

        reports = load_reports()
        for report in reports:
            if report.get("_id") == report_id:
                report["status"] = status
                report["updated_at"] = make_timestamp()
                save_reports(reports)
                return jsonify({"success": True, "message": "Report updated"}), 200

        return jsonify({"success": False, "error": "Report not found"}), 404

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ==================== ROUTES: DASHBOARD ====================
@app.route("/api/dashboard/stats", methods=["GET"])
def dashboard_stats():
    """Get dashboard statistics"""
    try:
        locality = request.args.get("locality")

        reports = load_reports()
        
        if locality:
            # Filter by locality
            try:
                users_file = os.path.join(DATA_DIR, "users.json")
                if os.path.exists(users_file):
                    with open(users_file, "r") as f:
                        users = json.load(f)
                        user_localities = {u["_id"]: u.get("locality") for u in users}
                        reports = [r for r in reports if user_localities.get(r.get("userId")) == locality]
            except:
                pass

        total = len(reports)
        open_count = len([r for r in reports if r.get("status") == "open"])

        return jsonify({
            "success": True,
            "data": {
                "total_reports": total,
                "open_reports": open_count,
                "high_priority": len([r for r in reports if r.get("analysis", {}).get("severity") == "high"]),
                "resolved_rate": 100 - (open_count / max(total, 1) * 100)
            }
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ==================== HEALTH CHECK ====================
@app.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint"""
    return jsonify({
        "success": True,
        "message": "Smart City API is running",
        "timestamp": make_timestamp()
    }), 200

# ==================== TEST ROUTE ====================
@app.route("/test", methods=["GET"])
def test():
    """Test route to verify API is working"""
    return jsonify({
        "success": True,
        "message": "API is working correctly",
        "timestamp": make_timestamp()
    }), 200

@app.route("/")
def home():
    return {
        "success": True,
        "message": "Welcome to Synora Smart City API 🚀"
    }
# ==================== ERROR HANDLERS ====================
@app.errorhandler(404)
def not_found(error):
    app.logger.warning("404 not found: %s %s", request.method, request.path)
    return jsonify({"success": False, "error": "Endpoint not found", "path": request.path}), 404

@app.errorhandler(500)
def server_error(error):
    app.logger.error("500 internal server error: %s %s", request.method, request.path)
    return jsonify({"success": False, "error": "Internal server error"}), 500


def log_registered_routes():
    app.logger.info("\n=== REGISTERED ROUTES ===")
    for rule in app.url_map.iter_rules():
        methods = ','.join(sorted(rule.methods))
        app.logger.info("%s %s", methods, rule.rule)
    app.logger.info("========================\n")

log_registered_routes()

# ==================== MAIN ====================
if __name__ == "__main__":
    print("Running updated backend version")
    print("\n=== REGISTERED ROUTES ===")
    for rule in app.url_map.iter_rules():
        methods = ','.join(rule.methods)
        print(f"{methods:20} {rule.rule}")
    print("========================\n")

    app.run(debug=True, host="0.0.0.0", port=5000)
