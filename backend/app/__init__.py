import click
from flask import Flask, jsonify

from app.config import Config, DEFAULT_SECRET_KEY
from app.extensions import cors, db, login_manager, migrate


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    if app.config.get("ENV") == "production" and app.config["SECRET_KEY"] == DEFAULT_SECRET_KEY:
        raise RuntimeError(
            "SECRET_KEY is still the default value - set a real secret via the "
            "SECRET_KEY environment variable before running with FLASK_ENV=production."
        )

    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    cors.init_app(
        app,
        supports_credentials=True,
        origins=app.config["CORS_ORIGINS"],
    )

    from app.models.user import User

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))

    @login_manager.unauthorized_handler
    def unauthorized():
        return jsonify({"error": "login required"}), 401

    from app.routes.auth import auth_bp
    from app.routes.vehicles import vehicles_bp
    from app.routes.bookings import bookings_bp
    from app.routes.payments import payments_bp
    from app.routes.users import users_bp
    from app.routes.company_settings import company_settings_bp
    from app.routes.admin import admin_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(vehicles_bp)
    app.register_blueprint(bookings_bp)
    app.register_blueprint(payments_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(company_settings_bp)
    app.register_blueprint(admin_bp)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"}), 200

    @app.get("/api/meta")
    def meta():
        from app.models.payment import VALID_METHODS
        from app.models.vehicle import VALID_CATEGORIES, VALID_TYPES
        from app.utils.kenya import KENYA_LOCATIONS

        return jsonify(
            {
                "locations": KENYA_LOCATIONS,
                "vehicle_types": sorted(VALID_TYPES),
                "vehicle_categories": sorted(VALID_CATEGORIES),
                "payment_methods": sorted(VALID_METHODS),
            }
        ), 200

    @app.errorhandler(404)
    def not_found(_e):
        return jsonify({"error": "not found"}), 404

    @app.errorhandler(400)
    def bad_request(_e):
        return jsonify({"error": "bad request"}), 400

    @app.errorhandler(403)
    def forbidden(_e):
        return jsonify({"error": "forbidden"}), 403

    @app.errorhandler(500)
    def server_error(_e):
        return jsonify({"error": "internal server error"}), 500

    register_cli(app)

    return app


def register_cli(app):
    @app.cli.command("create-admin")
    @click.option("--name", prompt=True)
    @click.option("--username", prompt=True)
    @click.option("--email", prompt=True)
    @click.option("--password", prompt=True, hide_input=True, confirmation_prompt=True)
    def create_admin(name, username, email, password):
        """Create an admin user. Usage: flask create-admin"""
        from app.models.user import ROLE_ADMIN, User

        username = username.strip().lower()
        email = email.strip().lower()
        if User.query.filter_by(email=email).first():
            click.echo(f"A user with email {email} already exists.")
            return
        if User.query.filter_by(username=username).first():
            click.echo(f"A user with username {username} already exists.")
            return

        user = User(name=name.strip(), username=username, email=email, role=ROLE_ADMIN)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        click.echo(f"Admin user created: {username}")
