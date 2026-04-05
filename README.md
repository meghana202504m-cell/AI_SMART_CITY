# Smart City AI Web Application

## Overview
A simple Smart City AI full-stack application.

- Frontend: React + TailwindCSS
- Backend: Flask REST API
- Database: MongoDB
- Map API: Google Maps (mocked route response in backend)

## Features
- Dashboard with traffic congestion prediction and latest reports
- Report issue form (road defects, waste management, traffic issues)
- Emergency route optimization (real Google Maps Directions API with fallback mock)
- Basic issue categorization using keyword classification

## Backend structure
- `backend/app.py`: app and blueprint registration, Mongo setup
- `backend/routes/`: route endpoints
- `backend/services/`: business logic for traffic, reports, emergency routing
- `backend/models/`: data models (report object) and DTO conversion

## Setup

### Backend

1. Navigate to backend folder:
   `cd backend`
2. Create virtual environment:
   `python -m venv venv`
3. Activate it:
   `venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Mac/Linux)
4. Install dependencies:
   `pip install -r requirements.txt`
5. Generate and save model:
   `python services/train_traffic_model.py`
6. Ensure MongoDB is running locally on mongodb://localhost:27017, or update `.env`.
7. Run backend:
   `python app.py`

### Frontend

1. Navigate to frontend folder:
   `cd frontend`
2. Install dependencies:
   `npm install`
3. Start dev server:
   `npm start`

## Notes
- If using Google Maps API, add key to frontend and call Directions API in backend using requests.
- For production, add authentication, validation, error handling, and secure API keys.
