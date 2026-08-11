from functools import wraps
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask import jsonify

def admin_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        identity = get_jwt_identity()
        if identity.get('role') != 'admin':
            return jsonify({
                'success': False,
                'status': 403,
                'error': 'Only administrators can access this resource'
            }), 403
        return fn(*args, **kwargs)
    return wrapper

def owner_or_admin_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        identity = get_jwt_identity()
        user_role = identity.get('role')
        user_id = identity.get('user_id')
        
        if user_role == 'admin':
            return fn(*args, **kwargs)
        
        kwargs['current_user_id'] = user_id
        return fn(*args, **kwargs)
    return wrapper