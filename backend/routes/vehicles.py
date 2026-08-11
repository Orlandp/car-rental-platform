from flask import Blueprint, request, jsonify
from models import db, Vehicle
from sqlalchemy import desc
from utils.decorators import admin_required

vehicles_bp = Blueprint('vehicles', __name__, url_prefix='/api/vehicles')

@vehicles_bp.route('', methods=['GET'])
def get_all_vehicles():
    try:
        vehicle_type = request.args.get('type')
        max_price = request.args.get('maxPrice', type=float)
        min_price = request.args.get('minPrice', type=float)
        
        query = Vehicle.query
        
        if vehicle_type:
            query = query.filter_by(vehicle_type=vehicle_type)
        
        if max_price:
            query = query.filter(Vehicle.price_per_day <= max_price)
        
        if min_price:
            query = query.filter(Vehicle.price_per_day >= min_price)
        
        vehicles = query.all()
        
        vehicle_list = [
            {
                'id': v.id,
                'name': v.name,
                'vehicle_type': v.vehicle_type,
                'fuel_type': v.fuel_type,
                'price_per_day': v.price_per_day,
                'capacity': v.capacity,
                'available': v.available,
                'image_url': v.image_url
            }
            for v in vehicles
        ]
        
        return jsonify({
            'success': True,
            'status': 200,
            'data': vehicle_list,
            'count': len(vehicle_list)
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'status': 500,
            'error': str(e)
        }), 500

@vehicles_bp.route('/<int:vehicle_id>', methods=['GET'])
def get_vehicle(vehicle_id):
    try:
        vehicle = Vehicle.query.get(vehicle_id)
        
        if not vehicle:
            return jsonify({
                'success': False,
                'status': 404,
                'error': 'Vehicle not found'
            }), 404
        
        response = {
            'id': vehicle.id,
            'name': vehicle.name,
            'vehicle_type': vehicle.vehicle_type,
            'fuel_type': vehicle.fuel_type,
            'price_per_day': vehicle.price_per_day,
            'capacity': vehicle.capacity,
            'available': vehicle.available,
            'image_url': vehicle.image_url,
            'created_at': vehicle.created_at.isoformat()
        }
        
        return jsonify({
            'success': True,
            'status': 200,
            'data': response
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'status': 500,
            'error': str(e)
        }), 500

@vehicles_bp.route('', methods=['POST'])
@admin_required
def create_vehicle():
    try:
        data = request.get_json()
        
        if not data.get('name'):
            return jsonify({
                'success': False,
                'status': 400,
                'error': 'Vehicle name is required'
            }), 400
        
        if not data.get('price_per_day'):
            return jsonify({
                'success': False,
                'status': 400,
                'error': 'Price per day is required'
            }), 400
        
        vehicle = Vehicle(
            name=data.get('name'),
            vehicle_type=data.get('vehicle_type', 'car'),
            fuel_type=data.get('fuel_type', 'petrol'),
            price_per_day=data.get('price_per_day'),
            capacity=data.get('capacity', 5),
            image_url=data.get('image_url'),
            available=data.get('available', True)
        )
        
        db.session.add(vehicle)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'status': 201,
            'message': 'Vehicle created successfully',
            'data': {
                'id': vehicle.id,
                'name': vehicle.name,
                'price_per_day': vehicle.price_per_day
            }
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'status': 500,
            'error': str(e)
        }), 500

@vehicles_bp.route('/<int:vehicle_id>', methods=['PUT'])
@admin_required
def update_vehicle(vehicle_id):
    try:
        vehicle = Vehicle.query.get(vehicle_id)
        
        if not vehicle:
            return jsonify({
                'success': False,
                'status': 404,
                'error': 'Vehicle not found'
            }), 404
        
        data = request.get_json()
        
        if 'name' in data:
            vehicle.name = data['name']
        if 'price_per_day' in data:
            vehicle.price_per_day = data['price_per_day']
        if 'vehicle_type' in data:
            vehicle.vehicle_type = data['vehicle_type']
        if 'fuel_type' in data:
            vehicle.fuel_type = data['fuel_type']
        if 'capacity' in data:
            vehicle.capacity = data['capacity']
        if 'available' in data:
            vehicle.available = data['available']
        if 'image_url' in data:
            vehicle.image_url = data['image_url']
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'status': 200,
            'message': 'Vehicle updated successfully',
            'data': {
                'id': vehicle.id,
                'name': vehicle.name,
                'price_per_day': vehicle.price_per_day
            }
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'status': 500,
            'error': str(e)
        }), 500

@vehicles_bp.route('/<int:vehicle_id>', methods=['DELETE'])
@admin_required
def delete_vehicle(vehicle_id):
    try:
        vehicle = Vehicle.query.get(vehicle_id)
        
        if not vehicle:
            return jsonify({
                'success': False,
                'status': 404,
                'error': 'Vehicle not found'
            }), 404
        
        db.session.delete(vehicle)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'status': 200,
            'message': 'Vehicle deleted successfully'
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'status': 500,
            'error': str(e)
        }), 500