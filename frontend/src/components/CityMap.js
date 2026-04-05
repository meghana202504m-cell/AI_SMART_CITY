import React, { useEffect, useState } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow, Polyline } from '@react-google-maps/api';
import { getReports } from '../services/api';
import axios from 'axios';

const CityMap = () => {
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [directions, setDirections] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [center, setCenter] = useState({ lat: 40.7128, lng: -74.0060 }); // Fallback default

  const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

  const mapStyles = {
    height: '600px',
    width: '100%',
  };

  // Geocode an address to set center (example: geocode "New York City" or user input)
  const geocodeAddress = async (address) => {
    try {
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`);
      const data = await response.json();
      if (data.results && data.results[0]) {
        const location = data.results[0].geometry.location;
        setCenter({ lat: location.lat, lng: location.lng });
      }
    } catch (err) {
      console.error('Geocoding failed:', err);
    }
  };

  // Use geolocation for default center, fallback to geocoding or default
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCenter({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          // Fallback: geocode a default address like "New York City"
          geocodeAddress('New York City');
        }
      );
    } else {
      geocodeAddress('New York City');
    }
  }, []);

  // Fetch reported issues using getReports from api.js
  useEffect(() => {
    const fetchMarkerData = async () => {
      const result = await getReports();
      if (result.success) {
        const formattedMarkers = (result.data || []).map((report) => ({
          id: report._id || report.id,
          lat: report.latitude || report.lat,
          lng: report.longitude || report.lng,
          type: report.issue_type || report.type,
          severity: report.severity,
          title: `${report.issue_type || report.type} - ${report.severity}`,
        }));
        setMarkers(formattedMarkers);
      } else {
        setError(result.error?.message || 'Failed to fetch markers');
      }
      setLoading(false);
    };

    fetchMarkerData();
  }, []);

  // Get marker color based on severity
  const getMarkerColor = (severity) => {
    switch (severity) {
      case 'high':
        return 'http://maps.google.com/mapfiles/ms/icons/red-dot.png';
      case 'medium':
        return 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png';
      case 'low':
        return 'http://maps.google.com/mapfiles/ms/icons/green-dot.png';
      default:
        return 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png';
    }
  };

  // Fetch directions (using axios for consistency)
  const fetchDirections = async (startLat, startLng, endLat, endLng) => {
    try {
      const response = await axios.get(`/api/directions?startLat=${startLat}&startLng=${startLng}&endLat=${endLat}&endLng=${endLat}`);
      const data = response.data;
      setDirections(data.route);
    } catch (err) {
      setError('Failed to fetch directions: ' + err.message);
    }
  };

  const handleMarkerClick = (marker) => {
    setSelectedMarker(marker);
  };

  const handleGetDirections = async () => {
    if (selectedMarker) {
      await fetchDirections(
        center.lat,
        center.lng,
        selectedMarker.lat,
        selectedMarker.lng
      );
    }
  };

  if (loading) return <p>Loading map...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
      <GoogleMap
        mapContainerStyle={mapStyles}
        zoom={12}
        center={center}
        onLoad={(mapInstance) => setMap(mapInstance)}
      >
        {/* Markers for reported issues */}
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={{ lat: marker.lat, lng: marker.lng }}
            title={marker.title}
            icon={getMarkerColor(marker.severity)}
            onClick={() => handleMarkerClick(marker)}
          />
        ))}

        {/* Info window for selected marker */}
        {selectedMarker && (
          <InfoWindow
            position={{ lat: selectedMarker.lat, lng: selectedMarker.lng }}
            onCloseClick={() => setSelectedMarker(null)}
          >
            <div>
              <h3>{selectedMarker.type}</h3>
              <p>Severity: {selectedMarker.severity}</p>
              <button onClick={handleGetDirections}>Get Directions</button>
            </div>
          </InfoWindow>
        )}

        {/* Polyline for directions */}
        {directions && (
          <Polyline
            path={directions}
            options={{
              strokeColor: '#4285F4',
              strokeOpacity: 1,
              strokeWeight: 4,
            }}
          />
        )}
      </GoogleMap>
    </LoadScript>
  );
};

export default CityMap;