import { useEffect, useState } from "react";
import { getReports, predictTraffic } from "../services/api";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning, Star Mapper 🌅";
  if (hour < 18) return "Good Afternoon, City Navigator ☀️";
  return "Good Evening, Road Guardian 🌙";
};

const getDateLabel = () => {
  const now = new Date();
  return now.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export default function Dashboard() {
  const [statusMessage, setStatusMessage] = useState("Where are you now... I will predict traffic for you...");
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [trafficPrediction, setTrafficPrediction] = useState(null);
  const [location, setLocation] = useState("");

  const loadReports = async () => {
    setLoading(true);
    const result = await getReports();
    setLoading(false);
    if (result.success) {
      const reportList = Array.isArray(result.data)
        ? result.data
        : Array.isArray(result.data?.reports)
        ? result.data.reports
        : [];
      setReports(reportList);
    } else {
      setReports([]);
      setStatusMessage(result.error?.message || "Unable to load reports right now");
    }
  };

  const handlePredictTraffic = async () => {
    if (!location.trim()) {
      setStatusMessage("Please enter a location for traffic prediction.");
      return;
    }
    const result = await predictTraffic({ location });
    if (result.success) {
      setTrafficPrediction(result.data);
      setStatusMessage("Traffic prediction loaded.");
    } else {
      setStatusMessage(result.error?.message || "Failed to predict traffic.");
    }
  };

  useEffect(() => {
    loadReports();
    // Polling for auto-update every 30 seconds
    const interval = setInterval(loadReports, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(130deg, #0f1f3d 0%, #193f79 35%, #2a73b8 70%, #1f4d83 100%)",
        color: "#fff",
        padding: "26px",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      }}
    >
      <h1>{getGreeting()}</h1>
      <p>{getDateLabel()}</p>
      <p style={{ fontSize: "1.15rem", marginBottom: "20px" }}>{statusMessage}</p>
      <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: "14px", padding: "18px" }}>
        <h2>Traffic Congestion Prediction</h2>
        <input
          type="text"
          placeholder="Enter your current location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          style={{ marginRight: "10px" }}
        />
        <button onClick={handlePredictTraffic}>Predict Traffic</button>
        {trafficPrediction && (
          <div style={{ marginTop: "10px" }}>
            <p>Prediction: {JSON.stringify(trafficPrediction)}</p>
          </div>
        )}
      </div>

      <div style={{ marginTop: "20px", color: "#eee" }}>
        <h3>Latest Reports</h3>
        {loading ? (
          <p>Loading recent reports...</p>
        ) : reports.length === 0 ? (
          <p>No reports yet</p>
        ) : (
          <ul>
            {reports.slice(0, 5).map((rep, idx) => (
              <li key={rep._id || idx}>
                {rep.description || "Report entry"} - {rep.issue_type || "Unknown issue"}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}