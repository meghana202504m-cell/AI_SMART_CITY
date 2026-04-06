import { useEffect, useState } from "react";
import { predictTraffic, getReports, autocompletePlaces, geocodeAddress } from "../services/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { FiAlertCircle, FiCheckCircle, FiMapPin, FiActivity, FiRefreshCw } from "react-icons/fi";

// Stat Card Component
function StatCard({ icon, title, value, trend, bgGradient }) {
  return (
    <div className={`bg-gradient-to-br ${bgGradient} rounded-lg shadow-lg p-6 text-white hover:shadow-xl transition transform hover:scale-105`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm opacity-90 font-medium">{title}</p>
          <p className="text-4xl font-bold mt-2">{value}</p>
          <p className="text-xs opacity-75 mt-2">{trend} from last week</p>
        </div>
        <div className="opacity-30 text-4xl">{icon}</div>
      </div>
    </div>
  );
}

function Dashboard() {
  const [reports, setReports] = useState([]);
  const [traffic, setTraffic] = useState(null);
  const [locationText, setLocationText] = useState("Bangalore");
  const [selectedLocation, setSelectedLocation] = useState({ name: "Bangalore", lat: null, lng: null });
  const [suggestions, setSuggestions] = useState([]);
  const [weatherLabel, setWeatherLabel] = useState("");
  const [loadingReports, setLoadingReports] = useState(true);
  const [loadingTraffic, setLoadingTraffic] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [errorReports, setErrorReports] = useState("");
  const [errorTraffic, setErrorTraffic] = useState("");
  const [errorLocation, setErrorLocation] = useState("");
  const [userId, setUserId] = useState("");

  const hour = new Date().getHours();
  const dayOfWeek = new Date().getDay();
  const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayOfWeek];
  const openWeatherKey = process.env.REACT_APP_OPENWEATHER_API_KEY;

  useEffect(() => {
    const storedUserId = window.localStorage.getItem("smartCityUserId");
    if (storedUserId) {
      setUserId(storedUserId);
    } else {
      const newUserId = window.crypto?.randomUUID?.() || `user-${Date.now()}`;
      window.localStorage.setItem("smartCityUserId", newUserId);
      setUserId(newUserId);
    }
  }, []);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoadingReports(true);
        setErrorReports("");
        const result = await getReports();
        if (result.success) {
          const reportList = Array.isArray(result.data) ? result.data : [];
          setReports(reportList);
        } else {
          setReports([]);
          setErrorReports(result.error?.message || "Failed to load reports. Please try again.");
        }
      } catch (err) {
        setReports([]);
        setErrorReports("Failed to load reports. Please try again.");
      } finally {
        setLoadingReports(false);
      }
    };

    fetchReports();
    const interval = setInterval(fetchReports, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (locationText.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const result = await autocompletePlaces(locationText);
        if (result.success) {
          setSuggestions(result.data.slice(0, 5));
        } else {
          setSuggestions([]);
        }
      } catch (err) {
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [locationText]);

  useEffect(() => {
    if (!selectedLocation.name) return;
    const fetchWeather = async () => {
      if (!openWeatherKey) {
        setWeatherLabel("It's sunny today");
        return;
      }
      try {
        const params = new URLSearchParams({ appid: openWeatherKey, units: "metric" });
        if (selectedLocation.lat && selectedLocation.lng) {
          params.set("lat", selectedLocation.lat);
          params.set("lon", selectedLocation.lng);
        } else {
          params.set("q", selectedLocation.name);
        }
        const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?${params.toString()}`);
        const data = await response.json();
        if (data?.weather?.[0]?.main) {
          setWeatherLabel(data.weather[0].main);
        } else {
          setWeatherLabel("Unknown");
        }
      } catch (error) {
        console.error("Weather fetch failed:", error);
        setWeatherLabel("Unknown");
      }
    };

    fetchWeather();
  }, [selectedLocation, openWeatherKey]);

  const handleLocationSelect = async (item) => {
    setLocationText(item.description);
    setSuggestions([]);
    setErrorLocation("");
    try {
      const response = await geocodeAddress(item.description);
      if (response.success && response.data) {
        setSelectedLocation({
          name: response.data.formatted_address || item.description,
          lat: response.data.lat,
          lng: response.data.lng,
        });
      } else {
        setSelectedLocation({ name: item.description, lat: null, lng: null });
      }
    } catch (err) {
      console.error("Geocode failed:", err);
      setSelectedLocation({ name: item.description, lat: null, lng: null });
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setErrorLocation("Geolocation is not available in your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setSelectedLocation({ name: "Current location", lat: latitude, lng: longitude });
        setLocationText("Current location");
        setSuggestions([]);
        setErrorLocation("");
      },
      (error) => {
        console.error("Geolocation error:", error);
        setErrorLocation("Unable to access your location. Please allow location access.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const updatePrediction = async () => {
    if (!locationText.trim()) {
      setErrorTraffic("Enter a city or location before prediction.");
      return;
    }
    try {
      setLoadingTraffic(true);
      setErrorTraffic("");
      const payload = {
        place: selectedLocation.name || locationText,
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
        hour,
        day_of_week: dayOfWeek,
        weather: weatherLabel,
      };
      const result = await predictTraffic(payload);
      if (result.success) {
        setTraffic(result.data);
      } else {
        setTraffic(null);
        setErrorTraffic(result.error?.message || "Failed to predict traffic.");
      }
    } catch (error) {
      console.error("Error predicting traffic:", error);
      setErrorTraffic("Failed to predict traffic. Please try again.");
      setTraffic(null);
    } finally {
      setLoadingTraffic(false);
    }
  };

  const safeReports = Array.isArray(reports) ? reports : [];
  const reportStats = {
    total: safeReports.length,
    roadDefects: safeReports.filter((r) => r.issue_type === "road_defect").length,
    waste: safeReports.filter((r) => r.issue_type === "waste").length,
    resolved: safeReports.filter((r) => r.status === "resolved").length,
  };

  const congestionData = [
    { time: "6 AM", congestion: 20, avg: 25 },
    { time: "9 AM", congestion: 65, avg: 60 },
    { time: "12 PM", congestion: 45, avg: 50 },
    { time: "3 PM", congestion: 55, avg: 52 },
    { time: "6 PM", congestion: 85, avg: 80 },
    { time: "9 PM", congestion: 40, avg: 45 },
    { time: "12 AM", congestion: 15, avg: 18 },
  ];

  return (
    <div className="space-y-6 pb-8">
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-lg shadow-lg p-8 text-white">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Synora AI Dashboard</h1>
            <p className="text-lg opacity-90">Search locations, get live traffic forecasts, and review your reports.</p>
          </div>
          <div className="text-6xl opacity-20">🏙️</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={<FiMapPin className="w-6 h-6" />}
          title="My Reports"
          value={reportStats.total}
          trend="+12%"
          bgGradient="from-blue-400 to-blue-600"
        />
        <StatCard
          icon={<FiAlertCircle className="w-6 h-6" />}
          title="Road Defects"
          value={reportStats.roadDefects}
          trend="+8%"
          bgGradient="from-orange-400 to-orange-600"
        />
        <StatCard
          icon={<FiActivity className="w-6 h-6" />}
          title="Waste Issues"
          value={reportStats.waste}
          trend="+5%"
          bgGradient="from-purple-400 to-purple-600"
        />
        <StatCard
          icon={<FiCheckCircle className="w-6 h-6" />}
          title="Resolved"
          value={reportStats.resolved}
          trend="+15%"
          bgGradient="from-green-400 to-green-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">🚗 Traffic Prediction</h2>
              <p className="text-sm text-slate-500">Uses your current time, location and weather automatically.</p>
            </div>
            <FiRefreshCw className="text-slate-400" />
          </div>

          <div className="space-y-5 rounded-3xl bg-slate-50 p-6 border border-slate-200">
            <div>
              <label className="text-sm font-semibold text-slate-700">Search location</label>
              <input
                type="text"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="Mysore, Bangalore or your neighborhood"
                className="mt-3 w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            {suggestions.length > 0 && (
              <div className="rounded-3xl bg-white p-3 shadow-sm border border-slate-200">
                {suggestions.map((item) => (
                  <button
                    key={item.place_id}
                    type="button"
                    onClick={() => handleLocationSelect(item)}
                    className="w-full rounded-2xl px-3 py-3 text-left text-slate-800 transition hover:bg-blue-50"
                  >
                    {item.description}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-3xl bg-white p-5 border border-slate-200">
                <p className="text-xs uppercase tracking-wide text-slate-500">Current time</p>
                <p className="mt-3 text-3xl font-bold text-slate-900">{hour}:00</p>
              </div>
              <div className="rounded-3xl bg-white p-5 border border-slate-200">
                <p className="text-xs uppercase tracking-wide text-slate-500">Day</p>
                <p className="mt-3 text-3xl font-bold text-slate-900">{dayName}</p>
              </div>
              <div className="rounded-3xl bg-white p-5 border border-slate-200">
                <p className="text-xs uppercase tracking-wide text-slate-500">Weather</p>
                <p className="mt-3 text-3xl font-bold text-slate-900">{weatherLabel || "Loading..."}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={handleUseMyLocation}
                className="rounded-3xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 text-white font-semibold shadow-md hover:from-blue-700 hover:to-purple-700 transition"
              >
                Use My Location
              </button>
              <button
                onClick={updatePrediction}
                disabled={loadingTraffic || !locationText.trim()}
                className="rounded-3xl bg-slate-900 px-5 py-3 text-white font-semibold shadow-md hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed transition"
              >
                {loadingTraffic ? "Predicting..." : "Predict Traffic"}
              </button>
            </div>

            {errorLocation && <p className="text-sm text-red-600">{errorLocation}</p>}
          </div>

          {errorTraffic && (
            <div className="mt-6 rounded-3xl bg-red-50 p-5 text-red-700 border border-red-200">{errorTraffic}</div>
          )}

          {traffic && (
            <div className="mt-6 rounded-3xl bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-100 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Prediction result</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-3xl bg-white p-5 shadow-sm">
                  <p className="text-sm uppercase tracking-wide text-slate-500">Congestion</p>
                  <p className="mt-3 text-4xl font-bold text-orange-600">{traffic.congestion_score}</p>
                </div>
                <div className="rounded-3xl bg-white p-5 shadow-sm">
                  <p className="text-sm uppercase tracking-wide text-slate-500">Level</p>
                  <p className={`mt-3 text-4xl font-bold ${traffic.level === "High" ? "text-red-600" : traffic.level === "Moderate" ? "text-amber-600" : "text-emerald-600"}`}>
                    {traffic.level}
                  </p>
                </div>
                <div className="rounded-3xl bg-white p-5 shadow-sm">
                  <p className="text-sm uppercase tracking-wide text-slate-500">Location</p>
                  <p className="mt-3 text-lg font-semibold text-slate-900">{traffic.location?.query || locationText}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 bg-slate-50 rounded-3xl p-6 border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Traffic trend</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={congestionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #cbd5e1", borderRadius: "8px" }} />
                <Legend />
                <Line type="monotone" dataKey="congestion" stroke="#f97316" strokeWidth={3} dot={{ r: 4 }} name="Current" />
                <Line type="monotone" dataKey="avg" stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={2} name="Average" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-5 gap-3">
            <div>
              <h2 className="text-2xl font-bold">Latest Reports</h2>
              <p className="text-sm text-slate-500">Showing only the reports from your local user identity.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">User</span>
          </div>

          {loadingReports ? (
            <div className="rounded-3xl bg-slate-50 p-5 text-slate-600">Loading reports...</div>
          ) : errorReports ? (
            <div className="rounded-3xl bg-red-50 p-5 text-red-700">{errorReports}</div>
          ) : safeReports.length === 0 ? (
            <div className="rounded-3xl bg-slate-50 p-5 text-slate-600">No reports submitted yet.</div>
          ) : (
            <div className="space-y-4">
              {safeReports.slice(0, 5).map((report) => (
                <div key={report._id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-800">{report.issue_type?.replaceAll("_", " ")}</p>
                      <p className="mt-2 text-sm text-slate-600">{report.description}</p>
                    </div>
                    <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">{report.status}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    {report.location_name && <span>📍 {report.location_name}</span>}
                    {report.created_at && <span>🕒 {new Date(report.created_at).toLocaleString()}</span>}
                  </div>
                  
                  {/* Municipal Assignment Details */}
                  {(report.assigned_office || report.office_id || report.distance_to_office_km || report.office_assignment_reason) && (
                    <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 p-3">
                      <h4 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                        🏛️ Municipal Assignment Details
                      </h4>
                      <div className="space-y-1 text-xs text-blue-700">
                        {report.assigned_office && (
                          <div className="flex justify-between">
                            <span className="font-medium">Assigned Office:</span>
                            <span>{report.assigned_office}</span>
                          </div>
                        )}
                        {report.distance_to_office_km && (
                          <div className="flex justify-between">
                            <span className="font-medium">Distance:</span>
                            <span>{report.distance_to_office_km} km</span>
                          </div>
                        )}
                        {report.office_assignment_reason && (
                          <div className="flex justify-between">
                            <span className="font-medium">Reason:</span>
                            <span className="capitalize">{report.office_assignment_reason.replace(/_/g, ' ')}</span>
                          </div>
                        )}
                        {report.office_id && (
                          <div className="flex justify-between">
                            <span className="font-medium">Office ID:</span>
                            <span className="font-mono text-xs">{report.office_id}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
