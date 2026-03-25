# Main Flask Application
from flask import Flask, jsonify
from flask_cors import CORS
import os
from config import DEBUG, CORS_ORIGINS, PERMANENT_SESSION_LIFETIME
from routes.auth import auth_bp
from routes.schools import schools_bp
from routes.students import students_bp
from routes.invoices import invoices_bp

# Create Flask app instance
app = Flask(__name__)

# Load configuration
app.config.from_object("config")
app.config["PERMANENT_SESSION_LIFETIME"] = PERMANENT_SESSION_LIFETIME

# Enable CORS
CORS(app, resources={r"/*": {"origins": CORS_ORIGINS}})

# Register blueprints (route modules)
app.register_blueprint(auth_bp)
app.register_blueprint(schools_bp)
app.register_blueprint(students_bp)
app.register_blueprint(invoices_bp)

# Health check endpoint
@app.route("/", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "API Server is running",
        "environment": "development" if DEBUG else "production"
    }), 200

@app.route("/health", methods=["GET"])
def health():
    """Another health check endpoint"""
    return jsonify({"status": "ok"}), 200

# Error handlers
@app.errorhandler(404)
def not_found(e):
    """Handle 404 errors"""
    return jsonify({"message": "Endpoint not found"}), 404

@app.errorhandler(500)
def server_error(e):
    """Handle 500 errors"""
    return jsonify({"message": "Internal server error"}), 500

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    # Run the development server
    app.run(
        host="0.0.0.0",
        port=port,
        debug=DEBUG,
        threaded=True
    )
