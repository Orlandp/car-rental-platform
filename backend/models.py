from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(30), nullable=False)
    role = db.Column(db.String(20), default='client')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    bookings = db.relationship('Booking', backref='user', lazy=True, cascade='all, delete-orphan')

class Vehicle(db.Model):
    __tablename__ = 'vehicles'

    id = db.Column(db.Integer, primary_key=True)
    vehicle = db.Column(db.String(255), nullable=False)
    fuel = db.Column(db.String(30), nullable=False)
    price_per_day = db.Column(db.Float, nullable=False)
    capacity = db.Column(db.String(20), nullable=False)
    image_url = db.Column(db.String(255))
    available = db.Column(db.String(15), default='True')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    bookings = db.relationship('Booking', backref='vehicle', lazy=True, cascade='all, delete-orphan')

class Booking(db.Model):
    __tablename__ = 'bookings'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicles.id'), nullable=False)
    start_date = db.Column(db.DateTime, nullable=False)
    end_date = db.Column(db.DateTime, nullable=False)
    total_price = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(255), default='Pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
