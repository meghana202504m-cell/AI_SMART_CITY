import { useEffect, useState } from "react";
import { reportIssue, autocompletePlaces, geocodeAddress, uploadWasteImage, verifyToken } from "../services/api";
import { FiMapPin, FiAlertCircle, FiCheckCircle, FiSend, FiCrosshair, FiUpload } from "react-icons/fi";

function ReportForm() {
  const [form, setForm] = useState({
    issue_type: "road_defect",
    description: "",
    reporter: "",
  });
  const [locationQuery, setLocationQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState({ name: "", lat: null, lng: null });
  const [suggestions, setSuggestions] = useState([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [userId, setUserId] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Image upload states
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [wasteAnalysis, setWasteAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("authToken");
      if (token) {
        const result = await verifyToken();
        if (result.success) {
          setIsAuthenticated(true);
          setUserId(result.data.user.id);
        } else {
          setIsAuthenticated(false);
          const newId = window.crypto?.randomUUID?.() || `user-${Date.now()}`;
          localStorage.setItem("smartCityUserId", newId);
          setUserId(newId);
        }
      } else {
        const storedUserId = localStorage.getItem("smartCityUserId");
        if (storedUserId) {
          setUserId(storedUserId);
        } else {
          const newId = window.crypto?.randomUUID?.() || `user-${Date.now()}`;
          localStorage.setItem("smartCityUserId", newId);
          setUserId(newId);
        }
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (locationQuery.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const result = await autocompletePlaces(locationQuery);
        if (result.success) {
          setSuggestions(result.data.slice(0, 5));
        } else {
          setSuggestions([]);
        }
      } catch (error) {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [locationQuery]);

  const handleSelectSuggestion = async (item) => {
    setLocationQuery(item.description);
    setSuggestions([]);
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
    } catch (error) {
      console.error("Geocode failed:", error);
      setSelectedLocation({ name: item.description, lat: null, lng: null });
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setMessage("Geolocation unavailable in this browser.");
      setIsError(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSelectedLocation({
          name: "My current location",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationQuery("My current location");
        setMessage("Location set to your device location.");
        setIsError(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        setMessage("Unable to access location. Please allow location access.");
        setIsError(true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!["image/jpeg", "image/png", "image/gif"].includes(file.type)) {
      setMessage("Please select a valid image (JPG, PNG, or GIF)");
      setIsError(true);
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage("Image size must be less than 5MB");
      setIsError(true);
      return;
    }

    setSelectedImage(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);

    setMessage("");
    setIsError(false);
    setWasteAnalysis(null);
  };

  const analyzeWasteImage = async () => {
    if (!selectedImage) {
      setMessage("Please select an image first.");
      setIsError(true);
      return;
    }

    if (!isAuthenticated) {
      setMessage("Please log in to upload waste images.");
      setIsError(true);
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await uploadWasteImage(
        selectedImage,
        form.description,
        selectedLocation.name || locationQuery,
        selectedLocation.lat,
        selectedLocation.lng
      );

      if (result.success && result.data.analysis) {
        setWasteAnalysis(result.data.analysis);
        setMessage(`✅ Image analyzed! Waste Type: ${result.data.analysis.type}, Severity: ${result.data.analysis.severity}`);
        setIsError(false);
      } else {
        setMessage(result.error?.message || "Failed to analyze image");
        setIsError(true);
      }
    } catch (error) {
      console.error("Image analysis error:", error);
      setMessage("Error during image analysis");
      setIsError(true);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();

    if (!form.description.trim()) {
      setMessage("Please enter a description.");
      setIsError(true);
      return;
    }
    if (!locationQuery.trim() && !selectedLocation.name) {
      setMessage("Please provide a location for the report.");
      setIsError(true);
      return;
    }

    try {
      setIsLoading(true);
      setIsError(false);
      setMessage("");

      const payload = {
        issue_type: form.issue_type,
        description: form.description,
        reporter: form.reporter,
        userId,
        locationName: selectedLocation.name || locationQuery,
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
      };

      const result = await reportIssue(payload);
      if (!result.success) {
        throw new Error(result.error?.message || "Unable to submit report.");
      }

      setMessage("✅ Report submitted successfully! Thank you for helping improve the city.");
      setIsError(false);
      setForm({ issue_type: "road_defect", description: "", reporter: "" });
      setLocationQuery("");
      setSelectedLocation({ name: "", lat: null, lng: null });
      setSelectedImage(null);
      setImagePreview(null);
      setWasteAnalysis(null);

      setTimeout(() => setMessage(""), 5000);
    } catch (error) {
      console.error("Error submitting report:", error);
      setMessage(error.message || "Failed to submit report.");
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-8">
      <div className="bg-gradient-to-r from-green-500 via-teal-500 to-blue-500 rounded-lg shadow-lg p-8 text-white mb-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Report a Civic Issue</h1>
            <p className="text-lg opacity-90">Share issue details, location, and optional images for AI analysis.</p>
          </div>
          <div className="text-6xl opacity-20">📝</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-8">
        {message && (
          <div className={`mb-6 p-4 rounded-lg border-l-4 flex items-center gap-3 ${isError ? "bg-red-50 border-red-500 text-red-700" : "bg-green-50 border-green-500 text-green-700"}`}>
            {isError ? <FiAlertCircle className="w-5 h-5 flex-shrink-0" /> : <FiCheckCircle className="w-5 h-5 flex-shrink-0" />}
            <span className="font-medium">{message}</span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">📍 Issue Type</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { value: "road_defect", label: "🛣️ Road Defect" },
                { value: "waste", label: "🗑️ Waste Issue" },
                { value: "traffic", label: "🚦 Traffic Issue" },
                { value: "other", label: "📌 Other" },
              ].map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setForm({ ...form, issue_type: type.value })}
                  className={`p-4 rounded-lg border-2 transition transform hover:scale-105 ${form.issue_type === type.value ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white"}`}
                >
                  <p className="text-2xl mb-1">{type.label.split(" ")[0]}</p>
                  <p className="font-semibold text-slate-800">{type.label}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">👤 Your Name (optional)</label>
            <input
              type="text"
              value={form.reporter}
              onChange={(e) => setForm({ ...form, reporter: e.target.value })}
              placeholder="Enter your name or remain anonymous"
              className="w-full border-2 border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">📝 Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the issue, location, and any safety risks."
              className="w-full border-2 border-slate-300 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
              rows="6"
              required
            />
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Clear, actionable reports help responders act faster.</span>
              <span className="font-semibold">{form.description.length}/500</span>
            </div>
          </div>

          {/* Image Upload Section (Waste-specific) */}
          {form.issue_type === "waste" && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <FiUpload className="w-5 h-5 text-amber-600" />
                <p className="font-semibold text-slate-800 text-sm">Upload Waste Image for AI Analysis</p>
              </div>
              
              <input
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />

              {imagePreview && (
                <div className="space-y-2">
                  <img src={imagePreview} alt="Preview" className="w-full max-h-64 object-cover rounded-lg border border-amber-200" />
                  
                  {!wasteAnalysis && (
                    <button
                      type="button"
                      onClick={analyzeWasteImage}
                      disabled={isAnalyzing}
                      className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition"
                    >
                      {isAnalyzing ? "Analyzing with AI..." : "Analyze Image with AI"}
                    </button>
                  )}

                  {wasteAnalysis && (
                    <div className="bg-white border-2 border-amber-300 rounded-lg p-4">
                      <p className="font-semibold text-slate-800 mb-2">AI Analysis Results:</p>
                      <ul className="space-y-1 text-sm text-slate-700">
                        <li>🔍 Waste Type: <span className="font-semibold capitalize">{wasteAnalysis.type}</span></li>
                        <li>⚠️ Severity: <span className="font-semibold capitalize">{wasteAnalysis.severity}</span></li>
                        <li>📊 Confidence: {(wasteAnalysis.confidence * 100).toFixed(1)}%</li>
                        <li>✅ Is Waste: {wasteAnalysis.is_waste ? "Yes" : "No"}</li>
                      </ul>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedImage(null);
                      setImagePreview(null);
                      setWasteAnalysis(null);
                    }}
                    className="w-full px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-semibold rounded-lg transition"
                  >
                    Remove Image
                  </button>
                </div>
              )}

              {!isAuthenticated && (
                <div className="text-xs text-amber-700 bg-amber-100 p-2 rounded">
                  💡 Tip: Log in to unlock AI waste analysis using your authenticated account.
                </div>
              )}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800 text-sm">📍 Report Location</p>
                <p className="text-xs text-slate-600">Enter a city, neighborhood, or landmark.</p>
              </div>
              <button
                type="button"
                onClick={handleUseMyLocation}
                className="inline-flex items-center gap-2 rounded-full border border-blue-300 bg-white px-4 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
              >
                <FiCrosshair /> Use My Location
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={locationQuery}
                onChange={(e) => {
                  setLocationQuery(e.target.value);
                  setSelectedLocation({ name: "", lat: null, lng: null });
                }}
                placeholder="Search for Mysore, Bangalore, etc."
                className="w-full rounded-3xl border border-slate-300 bg-white px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />

              {suggestions.length > 0 && (
                <div className="rounded-3xl bg-white border border-slate-200 p-2 shadow-sm">
                  {suggestions.map((item) => (
                    <button
                      key={item.place_id}
                      type="button"
                      onClick={() => handleSelectSuggestion(item)}
                      className="w-full text-left rounded-2xl px-3 py-3 text-slate-800 hover:bg-blue-50"
                    >
                      {item.description}
                    </button>
                  ))}
                </div>
              )}

              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">Selected location</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{selectedLocation.name || locationQuery || "None"}</p>
                {selectedLocation.lat !== null && selectedLocation.lng !== null && (
                  <p className="mt-2 text-xs text-slate-500">Lat {selectedLocation.lat.toFixed(4)}, Lng {selectedLocation.lng.toFixed(4)}</p>
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-6 py-4 bg-gradient-to-r from-green-500 via-teal-500 to-blue-600 text-white font-bold rounded-lg hover:from-green-600 hover:via-teal-600 hover:to-blue-700 disabled:from-gray-400 disabled:via-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg"
          >
            {isLoading ? (
              <>
                <div className="animate-spin">⏳</div>
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <FiSend className="w-5 h-5" />
                <span>Submit Report</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-200 text-xs text-slate-600 text-center">
          Your report will help the city prioritize maintenance and safety work.
        </div>
      </div>
    </div>
  );
}

export default ReportForm;
