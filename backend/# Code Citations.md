# Code Citations

## License: MIT
https://github.com/21beckem/tracter-tracker/blob/477c0f93d00c940168e436de8d895760000faf97/index.html

```
### Google Maps React Component with Markers and Directions

Install the required library first:
```bash
npm install @react-google-maps/api
```

Then create the map component:

```javascript
// filepath: e:\projects\AI_SMART_CITY_PROJECT\frontend\src\components\CityMap.js
import React, { useEffect, useState } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow, Polyline } from '@react-google-maps/api';
import axios from 'axios';

const CityMap = () => {
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [directions, setDirections] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  const defaultCenter = { lat: 40.7128, lng: -74.0060 }; // New York City

  const mapStyles = {
    height: '600px',
    width: '100%',
  };

  // Fetch reported issues and traffic zones from backend
  useEffect(() => {
    const fetchMarkerData = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/reports/all');
        const formattedMarkers = response.data.map((report) => ({
          id: report._id,
          lat: report.latitude,
          lng: report.longitude,
          type: report.issue_type,
          severity: report.severity,
          title: `${report.issue_type} - ${report.severity}`,
        }));
        setMarkers(formattedMarkers);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch markers: ' + err.message);
        setLoading(false);
      }
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

  // Fetch directions between two points
  const fetchDirections = async (startLat, startLng, endLat, endLng) => {
    try {
      const response = await axios.get('http://localhost:5000/api/directions', {
        params: {
          startLat,
          startLng,
          endLat,
          endLng,
        },
      });
      setDirections(response.data.route);
    } catch (err) {
      setError('Failed to fetch directions: ' + err.message);
    }
  };

  const handleMarkerClick = (marker) => {
    setSelectedMarker
```


## License: MIT
https://github.com/21beckem/tracter-tracker/blob/477c0f93d00c940168e436de8d895760000faf97/index.html

```
### Google Maps React Component with Markers and Directions

Install the required library first:
```bash
npm install @react-google-maps/api
```

Then create the map component:

```javascript
// filepath: e:\projects\AI_SMART_CITY_PROJECT\frontend\src\components\CityMap.js
import React, { useEffect, useState } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow, Polyline } from '@react-google-maps/api';
import axios from 'axios';

const CityMap = () => {
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [directions, setDirections] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  const defaultCenter = { lat: 40.7128, lng: -74.0060 }; // New York City

  const mapStyles = {
    height: '600px',
    width: '100%',
  };

  // Fetch reported issues and traffic zones from backend
  useEffect(() => {
    const fetchMarkerData = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/reports/all');
        const formattedMarkers = response.data.map((report) => ({
          id: report._id,
          lat: report.latitude,
          lng: report.longitude,
          type: report.issue_type,
          severity: report.severity,
          title: `${report.issue_type} - ${report.severity}`,
        }));
        setMarkers(formattedMarkers);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch markers: ' + err.message);
        setLoading(false);
      }
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

  // Fetch directions between two points
  const fetchDirections = async (startLat, startLng, endLat, endLng) => {
    try {
      const response = await axios.get('http://localhost:5000/api/directions', {
        params: {
          startLat,
          startLng,
          endLat,
          endLng,
        },
      });
      setDirections(response.data.route);
    } catch (err) {
      setError('Failed to fetch directions: ' + err.message);
    }
  };

  const handleMarkerClick = (marker) => {
    setSelectedMarker
```


## License: MIT
https://github.com/21beckem/tracter-tracker/blob/477c0f93d00c940168e436de8d895760000faf97/index.html

```
### Google Maps React Component with Markers and Directions

Install the required library first:
```bash
npm install @react-google-maps/api
```

Then create the map component:

```javascript
// filepath: e:\projects\AI_SMART_CITY_PROJECT\frontend\src\components\CityMap.js
import React, { useEffect, useState } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow, Polyline } from '@react-google-maps/api';
import axios from 'axios';

const CityMap = () => {
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [directions, setDirections] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  const defaultCenter = { lat: 40.7128, lng: -74.0060 }; // New York City

  const mapStyles = {
    height: '600px',
    width: '100%',
  };

  // Fetch reported issues and traffic zones from backend
  useEffect(() => {
    const fetchMarkerData = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/reports/all');
        const formattedMarkers = response.data.map((report) => ({
          id: report._id,
          lat: report.latitude,
          lng: report.longitude,
          type: report.issue_type,
          severity: report.severity,
          title: `${report.issue_type} - ${report.severity}`,
        }));
        setMarkers(formattedMarkers);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch markers: ' + err.message);
        setLoading(false);
      }
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

  // Fetch directions between two points
  const fetchDirections = async (startLat, startLng, endLat, endLng) => {
    try {
      const response = await axios.get('http://localhost:5000/api/directions', {
        params: {
          startLat,
          startLng,
          endLat,
          endLng,
        },
      });
      setDirections(response.data.route);
    } catch (err) {
      setError('Failed to fetch directions: ' + err.message);
    }
  };

  const handleMarkerClick = (marker) => {
    setSelectedMarker
```


## License: MIT
https://github.com/21beckem/tracter-tracker/blob/477c0f93d00c940168e436de8d895760000faf97/index.html

```
### Google Maps React Component with Markers and Directions

Install the required library first:
```bash
npm install @react-google-maps/api
```

Then create the map component:

```javascript
// filepath: e:\projects\AI_SMART_CITY_PROJECT\frontend\src\components\CityMap.js
import React, { useEffect, useState } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow, Polyline } from '@react-google-maps/api';
import axios from 'axios';

const CityMap = () => {
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [directions, setDirections] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  const defaultCenter = { lat: 40.7128, lng: -74.0060 }; // New York City

  const mapStyles = {
    height: '600px',
    width: '100%',
  };

  // Fetch reported issues and traffic zones from backend
  useEffect(() => {
    const fetchMarkerData = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/reports/all');
        const formattedMarkers = response.data.map((report) => ({
          id: report._id,
          lat: report.latitude,
          lng: report.longitude,
          type: report.issue_type,
          severity: report.severity,
          title: `${report.issue_type} - ${report.severity}`,
        }));
        setMarkers(formattedMarkers);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch markers: ' + err.message);
        setLoading(false);
      }
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

  // Fetch directions between two points
  const fetchDirections = async (startLat, startLng, endLat, endLng) => {
    try {
      const response = await axios.get('http://localhost:5000/api/directions', {
        params: {
          startLat,
          startLng,
          endLat,
          endLng,
        },
      });
      setDirections(response.data.route);
    } catch (err) {
      setError('Failed to fetch directions: ' + err.message);
    }
  };

  const handleMarkerClick = (marker) => {
    setSelectedMarker
```

