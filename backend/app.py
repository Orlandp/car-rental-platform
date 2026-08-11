import os
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import config
from models import db
from routes.vehicles import vehicles_bp
from routes.auth import auth_bp
from routes.bookings import bookings_bp

def create_app(config_name='development'):
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    db.init_app(app)
    CORS(app)
    JWTManager(app)
    
    app.register_blueprint(vehicles_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(bookings_bp)
    
    with app.app_context():
        db.create_all()
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)