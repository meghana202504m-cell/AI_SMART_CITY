import logging
from flask import Blueprint, request, jsonify
import requests
import os

directions_bp = Blueprint('directions', __name__)

@directions_bp.route('/directions', methods=['GET'])
def get_directions():
    try:
        start_lat = request.args.get('startLat')
        start_lng = request.args.get('startLng')
        end_lat = request.args.get('endLat')
        end_lng = request.args.get('endLng')

        if not all([start_lat, start_lng, end_lat, end_lng]):
            return jsonify({'error': 'Missing coordinates'}), 400

        google_api_key = os.getenv('GOOGLE_MAPS_API_KEY')
        url = 'https://maps.googleapis.com/maps/api/directions/json'
        params = {
            'origin': f'{start_lat},{start_lng}',
            'destination': f'{end_lat},{end_lng}',
            'key': google_api_key,
        }

        response = requests.get(url, params=params)
        data = response.json()

        if data['status'] == 'OK':
            route = []
            for step in data['routes'][0]['legs'][0]['steps']:
                route.append({
                    'lat': step['start_location']['lat'],
                    'lng': step['start_location']['lng'],
                })
            route.append({
                'lat': data['routes'][0]['legs'][0]['end_location']['lat'],
                'lng': data['routes'][0]['legs'][0]['end_location']['lng'],
            })
            return jsonify({'route': route}), 200
        else:
            return jsonify({'error': 'Directions not found'}), 404

    except Exception as e:
        logging.error(f'Error fetching directions: {str(e)}')
        return jsonify({'error': 'Internal server error'}), 500