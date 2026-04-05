"""Route optimization using Google Maps Directions API."""
import os
import requests

GOOGLE_MAPS_KEY = os.getenv("GOOGLE_MAPS_API_KEY")


def get_shortest_route(source, destination):
    if not GOOGLE_MAPS_KEY:
        # fallback to mocked route if no key is available
        return {
            "source": source,
            "destination": destination,
            "distance_km": 5.6,
            "duration_minutes": 12,
            "summary": "Mock route - set GOOGLE_MAPS_API_KEY to enable real API",
            "steps": [
                {"instruction": "Take Main St", "distance_m": 1100, "duration_min": 3},
            ],
        }

    url = "https://maps.googleapis.com/maps/api/directions/json"
    params = {
        "origin": f"{source['lat']},{source['lng']}",
        "destination": f"{destination['lat']},{destination['lng']}",
        "key": GOOGLE_MAPS_KEY,
        "mode": "driving",
        "traffic_model": "best_guess",
        "departure_time": "now",
    }

    r = requests.get(url, params=params, timeout=10)
    if r.status_code != 200:
        raise RuntimeError("Google Maps API error: %s" % r.text)

    data = r.json()
    if data.get("status") != "OK" or not data.get("routes"):
        raise RuntimeError("Google Maps API no route: %s" % data.get("status"))

    route = data["routes"][0]
    leg = route["legs"][0]

    steps = []
    for s in leg.get("steps", []):
        steps.append({
            "instruction": s.get("html_instructions"),
            "distance_m": s["distance"]["value"],
            "duration_min": round(s["duration"]["value"] / 60, 2),
        })

    return {
        "source": source,
        "destination": destination,
        "distance_km": round(leg["distance"]["value"] / 1000.0, 2),
        "duration_minutes": round(leg["duration"]["value"] / 60.0, 2),
        "summary": route.get("summary"),
        "steps": steps,
    }
