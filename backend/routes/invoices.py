# Invoice Routes
from flask import Blueprint, request, jsonify
from supabase_client import get_supabase
from datetime import datetime

invoices_bp = Blueprint("invoices", __name__)
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

ITEM_TO_STOCK_NAMES = {
    "shirt": ["shirt", "boy shirt", "girl shirt"],
    "skirt": ["skirt"],
    "pant": ["pant"],
    "pina": ["pina"],
    "tie": ["tie"],
    "belt": ["belt"],
    "socks_house": ["socks", "house socks", "socks house"],
    "socks_school": ["socks", "school socks", "socks school"],
    "t_shirt": ["t shirt", "t-shirt", "t_shirt"],
    "track_pant": ["track pant", "track_pant"],
    "blazer": ["blazer"],
    "hair_band": ["hair band", "hair_band"],
    "house_shoes": ["house shoes", "house_shoes"],
    "school_shoes": ["school shoes", "school_shoes", "shoes"],
    "pt_suit": ["pt suit", "pt_suit", "sports uniform"],
    "sports_uniform": ["sports uniform", "pt suit", "pt_suit"],
    "school_bag": ["school bag", "school_bag", "bag"],
}


def _resolve_students_table():
    candidates = ["students", "student", "samata_students", "samata_school_students"]
    for table_name in candidates:
        try:
            supabase.table(table_name).select("*").limit(1).execute()
            return table_name
        except Exception:
            continue
    return None


def _resolve_stock_table():
    # Keep multiple name variants to support historical typo variants in existing DBs.
    candidates = [
        "school_stocks",
        "stocks",
        "samata_school_unifrom_cost",
        "samata_schools_unifrom_cost",
        "samata_school_uniform_cost",
        "samata_schools_uniform_cost",
    ]
    for table_name in candidates:
        try:
            supabase.table(table_name).select("*").limit(1).execute()
            print(f"[INFO] Using pricing table: {table_name}")
            return table_name
        except Exception:
            continue
    print("[ERROR] No pricing table found")
    return None


def _normalize_token(value):
    return str(value or "").strip().lower()


def _to_float(value, default=0.0):
    try:
        return float(str(value).strip())
    except Exception:
        return float(default)


def _parse_item_value(raw_value):
    if raw_value is None:
        return 0, None

    text = str(raw_value).strip()
    if text == "":
        return 0, None

    token = text.lower()
    if token in ["-", "--", "na", "n/a", "none", "0", "0.0"]:
        return 0, None

    try:
        number_value = float(text)
        if number_value <= 0:
            return 0, None
        if number_value <= 10:
            return int(round(number_value)), None
        return 1, text
    except Exception:
        return 1, text


def _normalize_gender(value):
    token = _normalize_token(value)
    if token in ["male", "boy", "boys", "m"]:
        return "boy"
    if token in ["female", "girl", "girls", "f"]:
        return "girl"
    return ""


def _load_stock_rows_for_school(stock_table, school_id):
    try:
        return supabase.table(stock_table).select("*").eq("school_id", school_id).execute().data or []
    except Exception:
        return supabase.table(stock_table).select("*").execute().data or []


def _pick_price_for_item(stock_rows, item_col, student_std, student_gender, student_size):
    aliases = [_normalize_token(v) for v in ITEM_TO_STOCK_NAMES.get(item_col, [item_col])]
    std_token = _normalize_token(student_std)
    gender_token = _normalize_gender(student_gender)
    size_token = _normalize_token(student_size)

    def matches_alias(row_item):
        row_item_token = _normalize_token(row_item)
        return row_item_token in aliases

    candidates = []
    for row in stock_rows:
        row_item = row.get("item") or row.get("Item") or ""
        if not matches_alias(row_item):
            continue

        row_std = _normalize_token(row.get("standard") or row.get("Standard") or "")
        row_gender = _normalize_gender(row.get("gender") or row.get("Gender") or "")
        row_size = _normalize_token(row.get("size") or row.get("Size") or "")
        row_price = _to_float(row.get("price") or row.get("Price"), 0)

        if row_price <= 0:
            continue

        score = 0
        if std_token and row_std == std_token:
            score += 8
        if gender_token and row_gender == gender_token:
            score += 4
        if size_token and row_size == size_token:
            score += 6

        candidates.append((score, row_price))

    if not candidates:
        return 0.0

    candidates.sort(key=lambda x: x[0], reverse=True)
    return float(candidates[0][1])


def _item_col_to_label(item_col):
    return item_col.replace("_", " ").title()


def _build_lines_from_student_uniform(student_row):
    school_id = student_row.get("school_id")
    student_std = student_row.get("std")
    student_gender = student_row.get("gender")

    stock_table = _resolve_stock_table()
    stock_rows = _load_stock_rows_for_school(stock_table, school_id) if stock_table else []

    lines = []
    for item_col in ITEM_COLUMNS:
        qty, size = _parse_item_value(student_row.get(item_col))
        if qty <= 0:
            continue

        unit_price = _pick_price_for_item(
            stock_rows=stock_rows,
            item_col=item_col,
            student_std=student_std,
            student_gender=student_gender,
            student_size=size,
        )

        lines.append({
            "dress": _item_col_to_label(item_col),
            "quantity": qty,
            "size": size or "-",
            "unit_price": unit_price,
        })

    return lines

@invoices_bp.route("/invoices/school/<school_id>", methods=["GET"])
def get_invoices_by_school(school_id):
    """Get all invoices for a specific school"""
    try:
        try:
            response = supabase.table("invoices").select("*").eq("school_id", school_id).order("created_at", desc=True).execute()
            invoices = response.data if response.data else []
        except Exception as e:
            print(f"Invoices table lookup skipped: {str(e)}")
            invoices = []

        student_ids = [row.get("student_id") for row in invoices if row.get("student_id")]
        student_map = {}
        students_table = _resolve_students_table()
        if student_ids and students_table:
            students_response = supabase.table(students_table).select("id, student_name").in_("id", student_ids).execute()
            student_map = {row.get("id"): row.get("student_name") for row in (students_response.data or [])}

        school_name = None
        school_response = supabase.table("schools").select("school_name").eq("id", school_id).limit(1).execute()
        if school_response.data:
            school_name = school_response.data[0].get("school_name")

        enriched = []
        for row in invoices:
            item = dict(row)
            item["student_name"] = student_map.get(row.get("student_id"))
            item["school_name"] = school_name
            enriched.append(item)

        return jsonify({
            "data": enriched
        }), 200
    except Exception as e:
        print(f"Get invoices error: {str(e)}")
        return jsonify({"message": f"Server error: {str(e)}"}), 500

@invoices_bp.route("/invoices", methods=["POST"])
def create_invoice():
    """
    Create a new invoice
    Expected payload: { student_id, school_id, status, payment_mode, items }
    """
    try:
        data = request.get_json(silent=True) or {}
        
        student_id = data.get("student_id")
        school_id = data.get("school_id")
        status = data.get("status", "Draft").strip()
        payment_mode = data.get("payment_mode", "cash").strip().lower()
        items = data.get("items") if isinstance(data.get("items"), list) else []
        
        if not student_id:
            return jsonify({"message": "Student ID is required"}), 400

        if not school_id:
            students_table = _resolve_students_table()
            if not students_table:
                return jsonify({"message": "Students table not found in database"}), 500

            student_response = supabase.table(students_table).select("school_id").eq("id", student_id).limit(1).execute()
            if not student_response.data:
                return jsonify({"message": "Student not found"}), 404
            school_id = student_response.data[0].get("school_id")

        if not school_id:
            return jsonify({"message": "School ID is required"}), 400
        
        if status not in ["Draft", "Paid"]:
            status = "Draft"
        
        if payment_mode not in ["cash", "online"]:
            payment_mode = "cash"
        
        # Generate invoice number
        invoice_number = f"INV-{datetime.now().strftime('%Y%m%d%H%M%S')}"

        normalized_items = []
        total = 0.0
        for raw in items:
            item_name = str(raw.get("item_name") or raw.get("dress") or "").strip()
            quantity = int(raw.get("quantity") or 0)
            size = str(raw.get("size") or "").strip() or None
            unit_price = float(raw.get("unit_price") or 0)

            if not item_name or quantity <= 0:
                continue

            normalized_items.append({
                "item_name": item_name,
                "quantity": quantity,
                "size": size,
                "unit_price": unit_price,
            })
            total += (quantity * unit_price)
        
        tax_percent = float(data.get("tax_percent") or 0)
        tax_amount = float(data.get("tax_amount") or 0)
        subtotal = round(total, 2)
        grand_total = round(subtotal + tax_amount, 2)

        insert_data = {
            "student_id": student_id,
            "school_id": school_id,
            "status": status,
            "invoice_number": invoice_number,
            "subtotal": subtotal,
            "tax_percent": tax_percent,
            "tax_amount": tax_amount,
            "total": grand_total,
            "payment_mode": payment_mode
        }
        
        insert_response = supabase.table("invoices").insert(insert_data).execute()
        
        if not insert_response.data:
            return jsonify({"message": "Failed to create invoice"}), 500
        
        invoice = insert_response.data[0]
        invoice_items_payload = []
        if normalized_items:
            for line in normalized_items:
                invoice_items_payload.append({
                    "invoice_id": invoice.get("id"),
                    "item_name": line["item_name"],
                    "quantity": line["quantity"],
                    "size": line["size"],
                    "unit_price": line["unit_price"],
                })
            supabase.table("invoice_items").insert(invoice_items_payload).execute()

        response_items = [{
            "dress": line["item_name"],
            "quantity": line["quantity"],
            "size": line["size"] or "-",
            "unit_price": line["unit_price"],
        } for line in normalized_items]

        return jsonify({
            "message": "Invoice created successfully",
            "data": [invoice],
            "invoice": {"items": response_items}
        }), 201
        
    except Exception as e:
        print(f"Create invoice error: {str(e)}")
        return jsonify({"message": f"Server error: {str(e)}"}), 500

@invoices_bp.route("/create-invoice/<student_id>", methods=["GET"])
def get_invoice_draft(student_id):
    """Get invoice draft for a student"""
    try:
        # Always compute fresh pricing from the uniform cost table for this student.
        students_table = _resolve_students_table()
        if students_table:
            student_response = supabase.table(students_table).select("*").eq("id", student_id).limit(1).execute()
            if student_response.data:
                auto_lines = _build_lines_from_student_uniform(student_response.data[0])
                return jsonify({"items": auto_lines}), 200

        # Fallback only when student row cannot be resolved.
        response = supabase.table("invoices").select("*").eq("student_id", student_id).order("created_at", desc=True).limit(1).execute()
        if not response.data:
            return jsonify({"items": []}), 200

        invoice = response.data[0]
        lines = []
        items_response = supabase.table("invoice_items").select("*").eq("invoice_id", invoice.get("id")).execute()
        for line in (items_response.data if items_response.data else []):
            lines.append({
                "dress": line.get("item_name") or line.get("dress") or "",
                "quantity": line.get("quantity") or 0,
                "size": line.get("size") or "-",
                "unit_price": line.get("unit_price") or 0,
            })

        return jsonify({"items": lines}), 200

    except Exception as e:
        print(f"Get invoice draft error: {str(e)}")
        return jsonify({"items": []}), 200

@invoices_bp.route("/invoices/<invoice_id>", methods=["GET"])
def get_invoice(invoice_id):
    """Get a specific invoice by ID"""
    try:
        response = supabase.table("invoices").select("*").eq("id", invoice_id).execute()
        
        if not response.data or len(response.data) == 0:
            return jsonify({"message": "Invoice not found"}), 404
        
        return jsonify(response.data[0]), 200
        
    except Exception as e:
        print(f"Get invoice error: {str(e)}")
        return jsonify({"message": f"Server error: {str(e)}"}), 500

@invoices_bp.route("/invoices/<invoice_id>", methods=["PUT"])
def update_invoice(invoice_id):
    """Update an invoice"""
    try:
        data = request.get_json(silent=True) or {}
        
        update_payload = {}
        if "status" in data:
            update_payload["status"] = data.get("status")
        if "total" in data:
            update_payload["total"] = data.get("total")
        
        if not update_payload:
            return jsonify({"message": "No fields to update"}), 400
        
        update_response = supabase.table("invoices").update(update_payload).eq("id", invoice_id).execute()
        
        if not update_response.data:
            return jsonify({"message": "Invoice not found or update failed"}), 404
        
        return jsonify({
            "message": "Invoice updated successfully",
            "data": update_response.data[0]
        }), 200
        
    except Exception as e:
        print(f"Update invoice error: {str(e)}")
        return jsonify({"message": f"Server error: {str(e)}"}), 500
