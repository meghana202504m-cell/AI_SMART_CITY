/**
 * Centralized API Service
 * Features: Authentication, Geocoding, Traffic Prediction, Reports, Image Upload
 */

import axios from "axios";

// Set global axios defaults
axios.defaults.baseURL = "http://127.0.0.1:5000";
axios.defaults.timeout = 15000;
axios.defaults.withCredentials = true;
axios.defaults.headers.common["Accept"] = "application/json";

// ==================== TOKEN MANAGEMENT ====================
export const setAuthToken = (token) => {
  if (token) {
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    localStorage.setItem("authToken", token);
  } else {
    delete axios.defaults.headers.common["Authorization"];
    localStorage.removeItem("authToken");
  }
};

// Initialize token from localStorage on load
const savedToken = localStorage.getItem("authToken");
if (savedToken) {
  setAuthToken(savedToken);
}

// ==================== ERROR HANDLING ====================
const parseError = (error) => {
  if (error.response) {
    return {
      message: error.response?.data?.message || error.response?.data?.error || "Backend error",
      status: error.response.status,
    };
  }
  if (error.request) {
    return { message: "No response from backend (maybe not running)", status: null };
  }
  return { message: error.message || "Unknown request error", status: null };
};

// ==================== HEALTH & STATUS ====================
export const healthCheck = async () => {
  try {
    const res = await axios.get("/api/health");
    return { ok: res?.data?.success !== false, data: res.data };
  } catch (error) {
    return { ok: false, error: parseError(error) };
  }
};

// ==================== AUTHENTICATION ====================
export const register = async (name, email, password, locality = "", age = 0) => {
  try {
    const response = await axios.post("/api/auth/register", {
      name,
      email,
      password,
      locality,
      age,
    });
    if (response.data.token) {
      setAuthToken(response.data.token);
    }
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

export const login = async (email, password) => {
  try {
    console.log("Making login request to:", "/api/auth/login", { email, password });
    const response = await axios.post("/api/auth/login", { email, password });
    console.log("Login response:", response.data);
    if (response.data.token) {
      setAuthToken(response.data.token);
    }
    return { success: true, data: response.data };
  } catch (error) {
    console.error("Login error:", error.response || error.message);
    return { success: false, error: parseError(error) };
  }
};

export const verifyToken = async () => {
  try {
    const response = await axios.get("/api/auth/verify");
    return { success: true, data: response.data };
  } catch (error) {
    // Token expired or invalid
    setAuthToken(null);
    return { success: false, error: parseError(error) };
  }
};

export const logout = () => {
  setAuthToken(null);
  return { success: true };
};

// ==================== GEOCODING & PLACES ====================
export const autocompletePlaces = async (query) => {
  try {
    const response = await axios.get("/api/autocomplete", { params: { query } });
    return { success: true, data: response.data.data || [] };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

export const geocodeAddress = async (address) => {
  try {
    const response = await axios.get("/api/geocode", { params: { address } });
    return { success: true, data: response.data.data };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

export const getPlaceDetails = async (placeId) => {
  try {
    const response = await axios.get("/api/place-details", { params: { place_id: placeId } });
    return { success: true, data: response.data.data };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

// ==================== TRAFFIC PREDICTION ====================
export const predictTraffic = async (payload) => {
  try {
    const response = await axios.post("/api/traffic/predict", payload);
    return { success: true, data: response.data.data };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

// ==================== EMERGENCY ROUTE ====================
export const getEmergencyRoute = async (payload) => {
  try {
    const response = await axios.post("/api/emergency/route", payload);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

// ==================== REPORTS ====================
export const reportIssue = async (payload) => {
  try {
    const response = await axios.post("/api/report", payload);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

export const getReports = async (userId, locality) => {
  try {
    const params = {};
    if (userId) params.userId = userId;
    if (locality) params.locality = locality;

    const response = await axios.get("/api/reports", { params });
    const payload = response.data || {};
    const reports = Array.isArray(payload.reports)
      ? payload.reports
      : Array.isArray(payload.data)
      ? payload.data
      : [];

    return { success: true, data: reports };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

export const getReport = async (reportId) => {
  try {
    const response = await axios.get(`/api/reports/${reportId}`);
    return { success: true, data: response.data.data };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

export const updateReportStatus = async (reportId, status) => {
  try {
    const response = await axios.put(`/api/reports/${reportId}`, { status });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

// ==================== WASTE MANAGEMENT ====================
export const uploadWasteImage = async (image, description, locationName, latitude, longitude) => {
  try {
    const formData = new FormData();
    formData.append("image", image);
    formData.append("description", description);
    formData.append("location_name", locationName);
    formData.append("latitude", latitude);
    formData.append("longitude", longitude);

    const response = await axios.post("/api/upload-waste", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

export const getImage = async (imageId) => {
  try {
    const response = await axios.get(`/api/image/${imageId}`, { responseType: "blob" });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};

// ==================== DASHBOARD ====================
export const getDashboardStats = async (locality) => {
  try {
    const params = locality ? { locality } : {};
    const response = await axios.get("/api/dashboard/stats", { params });
    return { success: true, data: response.data.data };
  } catch (error) {
    return { success: false, error: parseError(error) };
  }
};
