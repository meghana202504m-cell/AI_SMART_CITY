import { useEffect, useState, useRef } from "react";
import { getEmergencyRoute, autocompletePlaces, geocodeAddress, getReports } from "../services/api";
import { FiMapPin, FiNavigation, FiAlertCircle, FiCheck, FiSearch, FiCrosshair } from "react-icons/fi";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

function MapView() {
  const [map, setMap] = useState(null);
  const [mapContainer, setMapContainer] = useState(null);
  const [currentLocation, setCurrentLocation] = useState({ lat: 40.7128, lng: -74.0060 });
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [route, setRoute] = useState(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const [reportMarkers, setReportMarkers] = useState([]);
  const userMarkerRef = useRef(null);
  const routeLayerRef = useRef(null);

  const getMarkerColor = (severity) => {
    switch (severity) {
      case 'high':
        return '#ef4444'; // red
      case 'medium':
        return '#f59e0b'; // amber
      case 'low':
        return '#10b981'; // emerald
      default:
        return '#6b7280'; // gray
    }
  };

  useEffect(() => {
    if (!mapContainer) return;

    const mapInstance = L.map(mapContainer).setView([currentLocation.lat, currentLocation.lng], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(mapInstance);

    const marker = L.marker([currentLocation.lat, currentLocation.lng])
      .bindPopup("📍 Your current location")
      .addTo(mapInstance);
    userMarkerRef.current = marker;
    setMap(mapInstance);

    return () => {
      mapInstance.remove();
    };
  }, [mapContainer]);

  // Fetch reports
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const result = await getReports();
        if (result.success) {
          setReports(result.data);
        } else {
          console.error("Failed to fetch reports:", result.error);
        }
      } catch (err) {
        console.error("Error fetching reports:", err);
      }
    };
    fetchReports();
  }, []);

  // Add report markers to map
  useEffect(() => {
    if (!map || !reports.length) return;

    // Clear existing markers
    reportMarkers.forEach(marker => map.removeLayer(marker));
    setReportMarkers([]);

    const markers = reports
      .filter(report => report.latitude && report.longitude)
      .map(report => {
        const icon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="background-color: ${getMarkerColor(report.severity)}; border-radius: 50%; width: 20px; height: 20px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        const marker = L.marker([report.latitude, report.longitude], { icon })
          .bindPopup(`
            <div style="max-width: 200px;">
              <h3 style="font-weight: bold; margin-bottom: 5px;">${report.issue_type || 'Report'}</h3>
              <p style="margin: 0; font-size: 14px;">${report.description}</p>
              <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">
                Status: ${report.status || 'Open'} | Severity: ${report.severity || 'Unknown'}
              </p>
            </div>
          `)
          .addTo(map);

        return marker;
      });

    setReportMarkers(markers);
  }, [map, reports]);

  useEffect(() => {
    if (!map) return;
    map.setView([currentLocation.lat, currentLocation.lng], 12, { animate: true });
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([currentLocation.lat, currentLocation.lng]);
    } else {
      userMarkerRef.current = L.marker([currentLocation.lat, currentLocation.lng])
        .bindPopup("📍 Your current location")
        .addTo(map);
    }
  }, [map, currentLocation]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const result = await autocompletePlaces(searchQuery);
        if (result.success) {
          setSuggestions(result.data.slice(0, 5));
        } else {
          setSuggestions([]);
        }
      } catch (err) {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!map || !selectedPlace) return;

    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    const marker = L.marker([selectedPlace.lat, selectedPlace.lng])
      .bindPopup(`📍 ${selectedPlace.name}`)
      .addTo(map);
    marker.openPopup();

    map.setView([selectedPlace.lat, selectedPlace.lng], 12, { animate: true });
  }, [map, selectedPlace]);

  const handleSuggestionSelect = async (item) => {
    setSearchQuery(item.description);
    setSuggestions([]);
    setError("");
    setInfo("Finding location...");

    try {
      const response = await geocodeAddress(item.description);
      if (response.success && response.data) {
        setSelectedPlace({ name: response.data.formatted_address || item.description, lat: response.data.lat, lng: response.data.lng });
        setInfo(`Centering map on ${item.description}`);
      } else {
        setError("Unable to geocode the selected place.");
        setSelectedPlace(null);
      }
    } catch (err) {
      console.error("Geocode failed:", err);
      setError("Failed to resolve place. Try another search.");
      setSelectedPlace(null);
    } finally {
      setInfo("");
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not available in your browser.");
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setSelectedPlace({ name: "My location", lat: position.coords.latitude, lng: position.coords.longitude });
        setError("");
        setLoading(false);
      },
      (err) => {
        console.error("Geolocation error:", err);
        setError("Unable to get your location. Please allow location access.");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleGetRoute = async () => {
    if (!currentLocation || !selectedPlace) {
      setError("Select a destination and make sure your location is available.");
      return;
    }

    setLoading(true);
    setError("");
    setInfo("Calculating route...");

    try {
      const result = await getEmergencyRoute({ origin: currentLocation, destination: { lat: selectedPlace.lat, lng: selectedPlace.lng } });
      if (result.success) {
        const routePoints = result.data.route || [];
        if (!routePoints.length) {
          setError("Route data was empty.");
          return;
        }
        setRoute(routePoints);
        if (routeLayerRef.current) {
          routeLayerRef.current.remove();
        }
        routeLayerRef.current = L.polyline(routePoints, { color: "#ff4d4f", weight: 4, opacity: 0.8 }).addTo(map);
        map.fitBounds(routePoints, { padding: [40, 40] });
        setInfo("Route loaded successfully.");
      } else {
        setError(result.error?.message || "Failed to fetch route.");
      }
    } catch (err) {
      console.error("Route fetch failed:", err);
      setError("Failed to fetch emergency route.");
    } finally {
      setLoading(false);
      setInfo("");
    }
  };

  return (
    <div className="pb-8 space-y-6">
      <style>
        {`
          .custom-marker {
            background: transparent !important;
            border: none !important;
          }
        `}
      </style>
      <div className="bg-gradient-to-r from-red-500 via-orange-500 to-pink-600 rounded-lg shadow-lg p-8 text-white">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Emergency Map & Live Location</h1>
            <p className="text-lg opacity-90">Use your current location and place search for fast route guidance.</p>
          </div>
          <div className="text-6xl opacity-20">🗺️</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 bg-white rounded-xl shadow-md p-6 space-y-5">
          <div className="flex items-center gap-3">
            <FiSearch className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold">Location Search</h2>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type city or place name"
              className="w-full rounded-3xl border border-slate-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            {suggestions.length > 0 && (
              <div className="rounded-3xl bg-slate-50 border border-slate-200 p-2 space-y-2">
                {suggestions.map((item) => (
                  <button
                    key={item.place_id}
                    type="button"
                    onClick={() => handleSuggestionSelect(item)}
                    className="w-full text-left rounded-2xl px-3 py-2 hover:bg-blue-50"
                  >
                    {item.description}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={handleUseMyLocation}
              disabled={loading}
              className="w-full rounded-3xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 text-white font-semibold shadow-md hover:from-blue-700 hover:to-purple-700 disabled:opacity-60"
            >
              <span className="inline-flex items-center gap-2"> <FiCrosshair /> Use My Location</span>
            </button>

            <button
              onClick={handleGetRoute}
              disabled={loading || !selectedPlace}
              className="w-full rounded-3xl bg-slate-900 px-4 py-3 text-white font-semibold shadow-md hover:bg-slate-800 disabled:opacity-60"
            >
              <span className="inline-flex items-center gap-2"> <FiNavigation /> Get Route</span>
            </button>

            {info && <div className="rounded-3xl bg-blue-50 p-4 text-blue-700">{info}</div>}
            {error && <div className="rounded-3xl bg-red-50 p-4 text-red-700">{error}</div>}
          </div>

          <div className="rounded-3xl bg-slate-50 border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-2 text-slate-800">
              <FiMapPin />
              <span className="text-sm font-semibold">Current location</span>
            </div>
            <p className="text-sm text-slate-600">{selectedPlace?.name || "No location selected"}</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
              <span>Lat: {currentLocation.lat.toFixed(4)}</span>
              <span>Lng: {currentLocation.lng.toFixed(4)}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <FiAlertCircle className="w-5 h-5 text-orange-600" />
              <h2 className="text-xl font-bold">Reports on Map</h2>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-2">
              {reports.length === 0 ? (
                <p className="text-sm text-slate-500">No reports found</p>
              ) : (
                reports.slice(0, 10).map((report) => (
                  <div key={report._id} className="rounded-lg bg-slate-100 p-3 text-xs">
                    <p className="font-semibold">{report.issue_type || 'Report'}</p>
                    <p className="text-slate-600 truncate">{report.description}</p>
                    <p className="text-slate-500">Status: {report.status || 'Open'}</p>
                    {report.assigned_office && (
                      <div className="mt-2 rounded bg-blue-50 border border-blue-200 p-2">
                        <p className="text-blue-700 font-medium text-xs">🏛️ {report.assigned_office}</p>
                        {report.distance_to_office_km && (
                          <p className="text-blue-600 text-xs">{report.distance_to_office_km} km away</p>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 bg-white rounded-xl shadow-md overflow-hidden">
          <div ref={setMapContainer} className="w-full" style={{ minHeight: "620px", background: "#e5e7eb" }} />
        </div>
      </div>
    </div>
  );
}

export default MapView;
