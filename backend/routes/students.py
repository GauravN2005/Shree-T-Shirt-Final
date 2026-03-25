# Student Routes
import csv
import io
from flask import Blueprint, request, jsonify
from supabase_client import get_supabase

students_bp = Blueprint("students", __name__)
supabase = get_supabase()

ITEM_COLUMNS = [
    "shirt",
    "skirt",
    "pant",
    "pina",
    "tie",
    "belt",
    "socks_house",
    "socks_school",
    "t_shirt",
    "track_pant",
    "blazer",
    "hair_band",
    "house_shoes",
    "school_shoes",
    "pt_suit",
    "sports_uniform",
    "school_bag",
]

CSV_ITEM_ALIASES = {
    "shirt": ["shirt", "boy shirt", "girl shirt"],
    "skirt": ["skirt"],
    "pant": ["pant"],
    "pina": ["pina"],
    "tie": ["tie"],
    "belt": ["belt"],
    "socks_house": ["socks_house", "socks"],
    "socks_school": ["socks_school"],
    "t_shirt": ["t_shirt", "tshirt", "t-shirt"],
    "track_pant": ["track_pant", "track pant"],
    "blazer": ["blazer"],
    "hair_band": ["hair_band", "hair band"],
    "house_shoes": ["house_shoes", "house shoes"],
    "school_shoes": ["school_shoes", "school shoes", "shoes"],
    "pt_suit": ["pt_suit", "pt suit"],
    "sports_uniform": ["sports_uniform", "sports uniform"],
    "school_bag": ["school_bag", "school bag", "bag"],
}


def _first_present_value(row, keys):
    for key in keys:
        if key in row and str(row.get(key, "")).strip() != "":
            return str(row.get(key)).strip()
        key_upper = key.upper()
        if key_upper in row and str(row.get(key_upper, "")).strip() != "":
            return str(row.get(key_upper)).strip()
        key_title = key.title()
        if key_title in row and str(row.get(key_title, "")).strip() != "":
            return str(row.get(key_title)).strip()
    return ""


def _resolve_students_table():
    candidates = ["students", "student", "samata_students", "samata_school_students"]
    for table_name in candidates:
        try:
            supabase.table(table_name).select("*").limit(1).execute()
            return table_name
        except Exception:
            continue
    return None


def _table_exists(table_name):
    try:
        supabase.table(table_name).select("*").limit(1).execute()
        return True
    except Exception:
        return False


def _chunked(values, size=200):
    for i in range(0, len(values), size):
        yield values[i:i + size]


def _read_csv_file(file_obj):
    raw = file_obj.read()
    if isinstance(raw, str):
        text = raw
    else:
        try:
            text = raw.decode("utf-8-sig")
        except Exception:
            text = raw.decode("latin-1")
    return [row for row in csv.DictReader(io.StringIO(text)) if row]

@students_bp.route("/students/school/<school_id>", methods=["GET"])
def get_students_by_school(school_id):
    """Get all students for a specific school"""
    try:
        students_table = _resolve_students_table()
        if not students_table:
            return jsonify({"message": "Students table not found in database"}), 500

        response = supabase.table(students_table).select("*").eq("school_id", school_id).execute()
        return jsonify(response.data if response.data else []), 200
    except Exception as e:
        print(f"Get students error: {str(e)}")
        return jsonify({"message": f"Server error: {str(e)}"}), 500

@students_bp.route("/students", methods=["POST"])
def create_student():
    """
    Create a new student
    Expected payload: { school_id, student_name, std, gender, parent_name, mobile_no, ... }
    """
    try:
        data = request.get_json(silent=True) or {}
        students_table = _resolve_students_table()
        if not students_table:
            return jsonify({"message": "Students table not found in database"}), 500
        
        school_id = data.get("school_id")
        student_name = data.get("student_name", "").strip()
        std = data.get("std", "").strip()
        gender = data.get("gender", "").strip()
        parent_name = data.get("parent_name", "").strip()
        mobile_no = data.get("mobile_no", "").strip()
        
        if not all([school_id, student_name]):
            return jsonify({"message": "School ID and student name are required"}), 400
        
        insert_payload = {
            "school_id": school_id,
            "student_name": student_name,
            "std": std,
            "gender": gender,
            "parent_name": parent_name,
            "mobile_no": mobile_no
        }

        for col in ITEM_COLUMNS:
            if col in data:
                value = data.get(col)
                insert_payload[col] = None if value is None else str(value).strip()

        insert_response = supabase.table(students_table).insert(insert_payload).execute()
        
        if not insert_response.data:
            return jsonify({"message": "Failed to create student"}), 500
        
        return jsonify({
            "message": "Student added successfully",
            "data": insert_response.data[0]
        }), 201
        
    except Exception as e:
        print(f"Create student error: {str(e)}")
        return jsonify({"message": f"Server error: {str(e)}"}), 500

@students_bp.route("/students/<student_id>", methods=["GET"])
def get_student(student_id):
    """Get a specific student by ID"""
    try:
        students_table = _resolve_students_table()
        if not students_table:
            return jsonify({"message": "Students table not found in database"}), 500

        response = supabase.table(students_table).select("*").eq("id", student_id).execute()
        
        if not response.data or len(response.data) == 0:
            return jsonify({"message": "Student not found"}), 404
        
        return jsonify(response.data[0]), 200
        
    except Exception as e:
        print(f"Get student error: {str(e)}")
        return jsonify({"message": f"Server error: {str(e)}"}), 500

@students_bp.route("/students/<student_id>", methods=["PUT"])
def update_student(student_id):
    """Update a student's information"""
    try:
        data = request.get_json(silent=True) or {}
        students_table = _resolve_students_table()
        if not students_table:
            return jsonify({"message": "Students table not found in database"}), 500
        
        # Build update payload with only provided fields
        update_payload = {}
        for key in ["student_name", "std", "gender", "parent_name", "mobile_no"]:
            if key in data:
                update_payload[key] = data.get(key, "").strip()

        for col in ITEM_COLUMNS:
            if col in data:
                value = data.get(col)
                update_payload[col] = None if value is None else str(value).strip()
        
        if not update_payload:
            return jsonify({"message": "No fields to update"}), 400
        
        update_response = supabase.table(students_table).update(update_payload).eq("id", student_id).execute()
        
        if not update_response.data:
            return jsonify({"message": "Student not found or update failed"}), 404
        
        return jsonify({
            "message": "Student updated successfully",
            "data": update_response.data[0]
        }), 200
        
    except Exception as e:
        print(f"Update student error: {str(e)}")
        return jsonify({"message": f"Server error: {str(e)}"}), 500

@students_bp.route("/students/bulk", methods=["POST"])
def bulk_import_students():
    """Bulk import students from CSV file"""
    try:
        students_table = _resolve_students_table()
        if not students_table:
            return jsonify({
                "message": "Students table not found. Create table 'students' (or 'student') in Supabase first."
            }), 500

        school_id = str(request.form.get("school_id", "")).strip()
        file_obj = request.files.get("file")

        if not school_id:
            return jsonify({"message": "school_id is required"}), 400
        if not file_obj:
            return jsonify({"message": "Students file is required"}), 400

        filename = str(file_obj.filename or "").lower()
        if not filename.endswith(".csv"):
            return jsonify({"message": "Bulk import supports CSV only"}), 400

        rows = _read_csv_file(file_obj)
        payload = []
        for row in rows:
            student_name = str(row.get("student_name") or row.get("name") or row.get("Student Name") or "").strip()
            if not student_name:
                continue

            sr_no_raw = row.get("sr_no") or row.get("Sr No") or row.get("S.No") or None
            try:
                sr_no = int(float(str(sr_no_raw))) if str(sr_no_raw).strip() else None
            except Exception:
                sr_no = None

            student_row = {
                "school_id": school_id,
                "sr_no": sr_no,
                "std": str(row.get("std") or row.get("class") or row.get("Standard") or "").strip(),
                "student_name": student_name,
                "mobile_no": str(row.get("mobile_no") or row.get("phone") or row.get("Mobile") or "").strip(),
                "parent_name": str(row.get("parent_name") or row.get("Parent Name") or "").strip(),
                "gender": str(row.get("gender") or row.get("Gender") or "").strip(),
                "house": str(row.get("house") or row.get("House") or "").strip(),
            }

            for col in ITEM_COLUMNS:
                value = _first_present_value(row, CSV_ITEM_ALIASES.get(col, [col]))
                if value != "":
                    student_row[col] = value

            payload.append(student_row)

        if not payload:
            return jsonify({"message": "No valid student rows found in file"}), 400

        inserted_count = 0
        chunk_size = 500
        for i in range(0, len(payload), chunk_size):
            batch = payload[i:i + chunk_size]
            response = supabase.table(students_table).insert(batch).execute()
            inserted_count += len(response.data or [])

        return jsonify({
            "message": f"Bulk import successfully completed. Added {inserted_count} students.",
            "count": inserted_count
        }), 201
    except Exception as e:
        print(f"Bulk import error: {str(e)}")
        return jsonify({"message": f"Server error: {str(e)}"}), 500

@students_bp.route("/students/bulk-delete", methods=["POST"])
def bulk_delete_students():
    """Delete multiple students"""
    try:
        data = request.get_json(silent=True) or {}
        students_table = _resolve_students_table()
        if not students_table:
            return jsonify({"message": "Students table not found in database"}), 500

        ids = data.get("ids", [])
        
        if not ids or not isinstance(ids, list):
            return jsonify({"message": "Invalid request format"}), 400

        # Normalize ids and drop empty values.
        ids = [str(student_id).strip() for student_id in ids if str(student_id).strip()]
        if not ids:
            return jsonify({"message": "No valid student ids provided"}), 400

        deleted_invoice_items = 0
        deleted_invoices = 0

        # Cascade delete related invoice data first to satisfy FK constraints.
        if _table_exists("invoices"):
            invoice_rows = []
            for id_batch in _chunked(ids):
                response = supabase.table("invoices").select("id").in_("student_id", id_batch).execute()
                invoice_rows.extend(response.data or [])

            invoice_ids = [str(row.get("id")).strip() for row in invoice_rows if row.get("id")]

            if invoice_ids and _table_exists("invoice_items"):
                for invoice_batch in _chunked(invoice_ids):
                    del_items_resp = supabase.table("invoice_items").delete().in_("invoice_id", invoice_batch).execute()
                    deleted_invoice_items += len(del_items_resp.data or [])

            for id_batch in _chunked(ids):
                del_inv_resp = supabase.table("invoices").delete().in_("student_id", id_batch).execute()
                deleted_invoices += len(del_inv_resp.data or [])
        
        deleted_students = 0
        for id_batch in _chunked(ids):
            del_students_resp = supabase.table(students_table).delete().in_("id", id_batch).execute()
            deleted_students += len(del_students_resp.data or [])
        
        return jsonify({
            "message": f"Successfully deleted {deleted_students} students",
            "deleted_students": deleted_students,
            "deleted_invoices": deleted_invoices,
            "deleted_invoice_items": deleted_invoice_items,
        }), 200
        
    except Exception as e:
        print(f"Bulk delete error: {str(e)}")
        return jsonify({"message": f"Server error: {str(e)}"}), 500
