# Authentication Routes
from flask import Blueprint, request, jsonify
from supabase_client import get_supabase
import hashlib

auth_bp = Blueprint("auth", __name__)
supabase = get_supabase()

def hash_password(password):
    """Hash password using SHA256 (simple version - use bcrypt in production)"""
    return hashlib.sha256(password.encode()).hexdigest()

@auth_bp.route("/login", methods=["POST"])
def login():
    """
    User login endpoint
    Expected payload: { email, password, role }
    """
    try:
        data = request.get_json()
        email = data.get("email", "").strip()
        password = data.get("password", "").strip()
        selected_role = str(data.get("role", "")).strip().lower()
        
        if not email or not password:
            return jsonify({"message": "Email and password required"}), 400

        if selected_role not in ["admin", "worker"]:
            return jsonify({"message": "Valid role is required"}), 400
        
        # Query users table for matching email
        response = supabase.table("users").select("*").eq("email", email).execute()
        
        if not response.data or len(response.data) == 0:
            return jsonify({"message": "Invalid email or password"}), 401
        
        user = response.data[0]
        
        # Verify password
        password_hash = hash_password(password)
        if user.get("password_hash") != password_hash:
            return jsonify({"message": "Invalid email or password"}), 401

        # Enforce role-specific login for the selected role.
        user_role = str(user.get("role", "worker")).strip().lower()
        if user_role != selected_role:
            return jsonify({"message": f"This account is registered as {user_role}. Please select the correct role."}), 403
        
        # Check if user is active
        if not user.get("is_active", True):
            return jsonify({"message": "User account is inactive"}), 403
        
        return jsonify({
            "message": "Login successful",
            "user": {
                "id": user.get("id"),
                "name": user.get("username"),
                "username": user.get("username"),
                "email": user.get("email"),
                "role": user_role
            }
        }), 200
        
    except Exception as e:
        print(f"Login error: {str(e)}")
        return jsonify({"message": f"Server error: {str(e)}"}), 500

@auth_bp.route("/register", methods=["POST"])
def register():
    """
    User registration endpoint
    Expected payload: { name, email, password, role }
    """
    try:
        data = request.get_json()
        name = data.get("name", "").strip()
        email = data.get("email", "").strip()
        password = data.get("password", "").strip()
        role = str(data.get("role", "worker")).strip().lower()
        
        if not all([name, email, password]):
            return jsonify({"message": "Name, email, and password required"}), 400
        
        # Validate email format (basic)
        if "@" not in email:
            return jsonify({"message": "Invalid email format"}), 400
        
        # Check if email already exists
        response = supabase.table("users").select("id").eq("email", email).execute()
        
        if response.data and len(response.data) > 0:
            return jsonify({"message": "Email already registered"}), 409
        
        # Hash password
        password_hash = hash_password(password)
        
        # Insert new user
        insert_response = supabase.table("users").insert({
            "email": email,
            "username": name,
            "password_hash": password_hash,
            "role": role if role in ["admin", "worker"] else "worker",
            "is_active": True
        }).execute()
        
        if not insert_response.data:
            return jsonify({"message": "Failed to create user"}), 500
        
        return jsonify({
            "message": "Registration successfully completed",
            "user": {
                "id": insert_response.data[0].get("id"),
                "name": insert_response.data[0].get("username"),
                "email": insert_response.data[0].get("email"),
                "role": insert_response.data[0].get("role")
            }
        }), 201
        
    except Exception as e:
        print(f"Register error: {str(e)}")
        return jsonify({"message": f"Server error: {str(e)}"}), 500
