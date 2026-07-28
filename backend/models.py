from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db =SQLAlchemy

class user(db.model):
    __tablename__ ='users'

    id = db.column(db.integer, primary_key=True)
    email = db.column(db.string(255), unique=True, nullable=False)
    password = db.column(db.string(15), nullable=False)
    name = db.column(db.string(30), nullable=False)
    role =db.column(db.string(20), default='client')
    created_at = db.column(db.DateTime, default=datetime.utcnow)

    bookings = db.relationship('booking', backref='user', lazy='true', cascade='all, delete-orphan')

class Vehicle(db.model):
    __tablename__ ='vehicles'

    id = db.column(db.integer, primary_key=True)
    vehicle = db.column(db.string(255),nullable=False)
    fuel =db.colum(db.string(30), nullable=False)
    price_per_day = db.column(db.Float, nullable=False)
    capacity = db.column(db.string(20), nullable=False)
    image_url = db.column(db.string(255))
    available = db.column(db.string(15), default='True')
    created_at = db.column(db.datetime, default=datetime.utcnow)

    bookings = db.relationship('Booking', backref='vehicle', lazy='true', cascade='all, delete-orphan')

class Booking(db.model):
    __tablename__ = 'Booking'

    id = db.column(db.integer, primary_key=True)
    user_id = db.column(db.integer, db.ForeignKey('user_id'), nullable=False)
    vehicle_id = db.column(db.integer, db.ForeignKey('vehicle_id'), nulable=False)
    start_date = db.column(db.Datetime, nullable=False)
    end_date = db.column(db.Datetime, nullable=False)
    total_price= db.column(db.float, nullable=False)
    status = db.column(db.string(255), default='Pending')
    created_at = db.column(db.Datetime, default=datetime.utcnow)
    


