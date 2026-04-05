import { useEffect, useState } from "react";
import { getEmergencyRoute, predictTraffic } from "../services/api";

export default function MapView() {
  const [route, setRoute] = useState(null);
  const [traffic, setTraffic] = useState(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [region, setRegion] = useState("");

  const handleGetRoute = async () => {
    if (!from || !to) return;
    const result = await getEmergencyRoute({ from, to });
    if (result.success) {
      setRoute(result.data);
    } else {
      alert(result.error?.message || "Failed to get route");
    }
  };

  const handlePredictTraffic = async () => {
    if (!region) return;
    const result = await predictTraffic({ region });
    if (result.success) {
      setTraffic(result.data);
    } else {
      alert(result.error?.message || "Failed to predict traffic");
    }
  };

  return (
    <div>
      <h2>Emergency Route</h2>
      <input placeholder="From" value={from} onChange={(e) => setFrom(e.target.value)} />
      <input placeholder="To" value={to} onChange={(e) => setTo(e.target.value)} />
      <button onClick={handleGetRoute}>Get Route</button>
      {route && <p>Route: {JSON.stringify(route)}</p>}

      <h2>Traffic Prediction</h2>
      <input placeholder="Region" value={region} onChange={(e) => setRegion(e.target.value)} />
      <button onClick={handlePredictTraffic}>Predict</button>
      {traffic && <p>Traffic: {JSON.stringify(traffic)}</p>}
    </div>
  );
}