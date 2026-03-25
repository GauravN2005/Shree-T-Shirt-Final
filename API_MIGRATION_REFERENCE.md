# API Endpoints Reference - For Migration

This file tracks all API calls in `app.js` that need to be migrated to Supabase.

## Authentication Endpoints

### POST /login
**Current**: Used in `handleLogin()`
```
const payload = {
    email,
    password,
    role
};
```
**Response Expected**: `{ message: 'Login successful', user: { id, name, email, role } }`

### POST /register
**Current**: Used in `handleRegister()`
```
const payload = {
    name,
    email,
    password,
    role
};
```
**Response Expected**: `{ message: 'Registration successful' }`

## School Endpoints

### GET /schools
**Current**: Used in `fetchSchools()`
**Response Expected**: 
```
{ 
    data: [
        { id, school_name, address, contact_person, contact_person_number, academic_year }
    ]
}
```

### POST /schools
**Current**: Used in `handleAddSchool()` - Multipart form with file upload
**Requires**: File with pricing data

### GET /uniform-catalog/{school_id}
**Current**: Used in `loadUniformCatalog()`
**Response Expected**:
```
{
    items: [
        {
            id,
            item_name,
            db_field,
            sizes: [...],
            price_map: {...},
            standard_price_map: {...},
            default_price
        }
    ]
}
```

## Student Endpoints

### GET /students/school/{school_id}
**Current**: Used in `fetchStudents()`
**Response Expected**:
```
[
    {
        id,
        sr_no,
        std,
        student_name,
        mobile_no,
        parent_name,
        gender,
        house,
        school_id,
        uniform_data: {...}
    }
]
```

### POST /students
**Current**: Used in `handleAddStudent()`
```
{
    school_id,
    student_name,
    std,
    gender,
    parent_name,
    mobile_no,
    uniform_items: [{ item_name, quantity, size }],
    ...uniformFields
}
```

### PUT /students/{id}
**Current**: Used in `handleEditStudent()` and `handleAddParent()`
```
{
    student_name,
    std,
    gender,
    parent_name,
    mobile_no
}
```

### POST /students/bulk
**Current**: Used in `mockImportStudents()` - File upload
**Response Expected**: `{ message: '..successfully..', ... }`

### POST /students/bulk-delete
**Current**: Used in `deleteSelectedStudents()`
```
{
    ids: [...]
}
```
**Response Expected**: `{ message: '..successfully..', ... }`

## Invoice Endpoints

### GET /invoices/school/{school_id}
**Current**: Used in `fetchInvoices()`
**Response Expected**:
```
{
    data: [
        {
            id,
            student_id,
            status,
            total,
            amount,
            invoice_number,
            created_at,
            student_name,
            school_name
        }
    ]
}
```

### GET /create-invoice/{student_id}
**Current**: Used in `startBillingForStudent()` to get invoice draft
**Response Expected**:
```
{
    items: [
        {
            dress,
            quantity,
            size,
            unit_price
        }
    ]
}
```

### POST /invoices
**Current**: Used in `persistInvoice()` for Draft/Paid invoices
```
{
    student_id,
    status (Draft or Paid)
}
```
**Response Expected**:
```
{
    data: [{ id, student_id, status, total, invoice_number, created_at }],
    invoice: {
        items: [{ dress, quantity, size, unit_price }]
    }
}
```

## Total Endpoints to Migrate: 13

- 2 Auth endpoints
- 3 School endpoints
- 5 Student endpoints
- 3 Invoice endpoints
