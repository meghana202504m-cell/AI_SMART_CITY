"""Traffic prediction service for Smart City API."""
import os
import pickle

try:
    import numpy as np
except ImportError:
    np = None

MODEL_FILE_PATH = os.path.join(os.path.dirname(__file__), "traffic_model.pkl")


def load_model():
    if not os.path.exists(MODEL_FILE_PATH):
        raise FileNotFoundError("Traffic model not found. Run train_traffic_model.py first.")

    with open(MODEL_FILE_PATH, "rb") as f:
        model = pickle.load(f)
    return model


def predict_traffic(input_data):
    """Predict congestion using a trained model and map score to level."""
    time = input_data.get("time", {"hour": 12})
    weather = input_data.get("weather", {"condition": 1})
    day_of_week = input_data.get("day_of_week", 0)

    hour = float(time.get("hour", 12))
    weather_val = float(weather.get("condition", 1))
    day = float(day_of_week)

    if np is not None:
        X = np.array([[hour, weather_val, day]])
        try:
            model = load_model()
            pred = model.predict(X)[0]
        except Exception:
            # fallback formula when model not available or broken
            pred = 2.5 * hour + 10 * weather_val + 7 * day
    else:
        # numpy missing, fallback formula
        pred = 2.5 * hour + 10 * weather_val + 7 * day

    score = max(0.0, min(100.0, float(pred)))
    if score < 40:
        level = "Low"
    elif score < 70:
        level = "Moderate"
    else:
        level = "High"

    return {"congestion_score": round(score, 2), "level": level}
