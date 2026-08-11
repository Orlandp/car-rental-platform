from flask import Blueprint, request, jsonify
from models import db, User
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from datetime import datetime

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        if not data.get('email'):
            return jsonify({
                'success': False,
                'status': 400,
                'error': 'Email is required'
            }), 400
        
        if not data.get('password'):
            return jsonify({
                'success': False,
                'status': 400,
                'error': 'Password is required'
            }), 400
        
        if not data.get('name'):
            return jsonify({
                'success': False,
                'status': 400,
                'error': 'Name is required'
            }), 400
        
        if User.query.filter_by(email=data['email']).first():
            return jsonify({
                'success': False,
                'status': 400,
                'error': 'Email already registered'
            }), 400
        
        hashed_password = generate_password_hash(data['password'])
        
        user = User(
            email=data['email'],
            password=hashed_password,
            name=data['name'],
            role=data.get('role', 'client')
        )
        
        db.session.add(user)
        db.session.commit()
        
        access_token = create_access_token(identity={
            'user_id': user.id,
            'email': user.email,
            'role': user.role
        })
        
        return jsonify({
            'success': True,
            'status': 201,
            'message': 'User registered successfully',
            'token': access_token,
            'user': {
                'id': user.id,
                'email': user.email,
                'name': user.name,
                'role': user.role
            }
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'status': 500,
            'error': str(e)
        }), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        
        if not data.get('email'):
            return jsonify({
                'success': False,
                'status': 400,
                'error': 'Email is required'
            }), 400
        
        if not data.get('password'):
            return jsonify({
                'success': False,
                'status': 400,
                'error': 'Password is required'
            }), 400
        
        user = User.query.filter_by(email=data['email']).first()
        
        if not user:
            return jsonify({
                'success': False,
                'status': 401,
                'error': 'Invalid email or password'
            }), 401
        
        if not check_password_hash(user.password, data['password']):
            return jsonify({
                'success': False,
                'status': 401,
                'error': 'Invalid email or password'
            }), 401
        
        access_token = create_access_token(identity={
            'user_id': user.id,
            'email': user.email,
            'role': user.role
        })
        
        return jsonify({
            'success': True,
            'status': 200,
            'message': 'Login successful',
            'token': access_token,
            'user': {
                'id': user.id,
                'email': user.email,
                'name': user.name,
                'role': user.role
            }
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'status': 500,
            'error': str(e)
        }), 500

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user_info():
    try:
        identity = get_jwt_identity()
        user = User.query.get(identity['user_id'])
        
        if not user:
            return jsonify({
                'success': False,
                'status': 404,
                'error': 'User not found'
            }), 404
        
        return jsonify({
            'success': True,
            'status': 200,
            'data': {
                'id': user.id,
                'email': user.email,
                'name': user.name,
                'role': user.role,
                'created_at': user.created_at.isoformat()
            }
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'status': 500,
            'error': str(e)
        }), 500

@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    return jsonify({
        'success': True,
        'status': 200,
        'message': 'Logged out successfully'
    }), 200