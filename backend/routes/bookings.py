from flask import Blueprint, request, jsonify
from models import db, Booking, Vehicle, User
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime

bookings_bp = Blueprint('bookings', __name__, url_prefix='/api/bookings')

@bookings_bp.route('', methods=['POST'])
@jwt_required()
def create_booking():
    try:
        identity = get_jwt_identity()
        user_id = identity['user_id']
        data = request.get_json()
        
        if not data.get('vehicle_id'):
            return jsonify({
                'success': False,
                'status': 400,
                'error': 'Vehicle ID is required'
            }), 400
        
        if not data.get('start_date'):
            return jsonify({
                'success': False,
                'status': 400,
                'error': 'Start date is required'
            }), 400
        
        if not data.get('end_date'):
            return jsonify({
                'success': False,
                'status': 400,
                'error': 'End date is required'
            }), 400
        
        vehicle = Vehicle.query.get(data['vehicle_id'])
        if not vehicle:
            return jsonify({
                'success': False,
                'status': 404,
                'error': 'Vehicle not found'
            }), 404
        
        start_date = datetime.fromisoformat(data['start_date'])
        end_date = datetime.fromisoformat(data['end_date'])
        
        if start_date >= end_date:
            return jsonify({
                'success': False,
                'status': 400,
                'error': 'End date must be after start date'
            }), 400
        
        existing_booking = Booking.query.filter(
            Booking.vehicle_id == data['vehicle_id'],
            Booking.start_date < end_date,
            Booking.end_date > start_date
        ).first()
        
        if existing_booking:
            return jsonify({
                'success': False,
                'status': 400,
                'error': 'Vehicle already booked for these dates'
            }), 400
        
        days = (end_date - start_date).days
        total_price = days * vehicle.price_per_day
        
        booking = Booking(
            user_id=user_id,
            vehicle_id=data['vehicle_id'],
            start_date=start_date,
            end_date=end_date,
            total_price=total_price,
            status='pending'
        )
        
        db.session.add(booking)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'status': 201,
            'message': 'Booking created successfully',
            'data': {
                'id': booking.id,
                'vehicle_id': booking.vehicle_id,
                'start_date': booking.start_date.isoformat(),
                'end_date': booking.end_date.isoformat(),
                'total_price': booking.total_price,
                'status': booking.status
            }
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'status': 500,
            'error': str(e)
        }), 500

@bookings_bp.route('/me', methods=['GET'])
@jwt_required()
def get_my_bookings():
    try:
        identity = get_jwt_identity()
        user_id = identity['user_id']
        
        bookings = Booking.query.filter_by(user_id=user_id).all()
        
        booking_list = [
            {
                'id': b.id,
                'vehicle_id': b.vehicle_id,
                'vehicle_name': b.vehicle.name,
                'start_date': b.start_date.isoformat(),
                'end_date': b.end_date.isoformat(),
                'total_price': b.total_price,
                'status': b.status,
                'created_at': b.created_at.isoformat()
            }
            for b in bookings
        ]
        
        return jsonify({
            'success': True,
            'status': 200,
            'data': booking_list,
            'count': len(booking_list)
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'status': 500,
            'error': str(e)
        }), 500

@bookings_bp.route('/<int:booking_id>', methods=['GET'])
@jwt_required()
def get_booking(booking_id):
    try:
        identity = get_jwt_identity()
        user_id = identity['user_id']
        user_role = identity['role']
        
        booking = Booking.query.get(booking_id)
        
        if not booking:
            return jsonify({
                'success': False,
                'status': 404,
                'error': 'Booking not found'
            }), 404
        
        if booking.user_id != user_id and user_role != 'admin':
            return jsonify({
                'success': False,
                'status': 403,
                'error': 'You can only view your own bookings'
            }), 403
        
        response = {
            'id': booking.id,
            'user_id': booking.user_id,
            'vehicle_id': booking.vehicle_id,
            'vehicle_name': booking.vehicle.name,
            'start_date': booking.start_date.isoformat(),
            'end_date': booking.end_date.isoformat(),
            'total_price': booking.total_price,
            'status': booking.status,
            'created_at': booking.created_at.isoformat()
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

@bookings_bp.route('/<int:booking_id>', methods=['PUT'])
@jwt_required()
def cancel_booking(booking_id):
    try:
        identity = get_jwt_identity()
        user_id = identity['user_id']
        user_role = identity['role']
        
        booking = Booking.query.get(booking_id)
        
        if not booking:
            return jsonify({
                'success': False,
                'status': 404,
                'error': 'Booking not found'
            }), 404
        
        if booking.user_id != user_id and user_role != 'admin':
            return jsonify({
                'success': False,
                'status': 403,
                'error': 'You can only cancel your own bookings'
            }), 403
        
        booking.status = 'cancelled'
        db.session.commit()
        
        return jsonify({
            'success': True,
            'status': 200,
            'message': 'Booking cancelled successfully',
            'data': {
                'id': booking.id,
                'status': booking.status
            }
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'status': 500,
            'error': str(e)
        }), 500