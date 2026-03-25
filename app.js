/**
 * DB-driven frontend controller for School Uniform & Stationery Billing.
 * Products are loaded from uniform_prices via backend API.
 */

const API_BASE = window.APP_CONFIG?.API_BASE || 'http://localhost:5000';
const STORAGE_USER_KEY = 'sut_user';
const STORAGE_SCHOOL_KEY = 'sut_school_id';

const state = {
    user: null,
    activeSchool: null,
    activeBillingStudent: null,
    schools: [],
    students: [],
    invoices: [],
    posItems: [],
    cart: {},
    cartTotal: 0,
    billingPriceByItemId: {},
    billingSizeByItemId: {},
    activeUploadedFileId: null,
    selectedStudentIds: new Set(),
    stocks: [],
    paymentMode: 'cash',
};

let isInvoiceSubmitting = false;

const ITEM_ICON_BY_DB_FIELD = {
    shirt: 'ph-t-shirt',
    shirts: 'ph-t-shirt',
    pant: 'ph-pants',
    skirt: 'ph-dress',
    pina: 'ph-dress',
    t_shirt: 'ph-t-shirt',
    track_pant: 'ph-pants',
    blazer: 'ph-coat-hanger',
    sports_uniform: 'ph-t-shirt',
    belt: 'ph-arrows-in-line-horizontal',
    house_shoes: 'ph-sneaker',
    school_shoes: 'ph-boot',
    socks_house: 'ph-footprints',
    tie: 'img/tie-icon.svg',
    hair_band: 'ph-bandaids',
    school_bag: 'ph-backpack',
    pt_suit: 'ph-t-shirt',
};

// Cache removed - all data now fetched from database only

function normalizeItemKey(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getGenderToken(rawValue) {
    const raw = String(rawValue || '').trim().toLowerCase();
    if (raw === 'male' || raw === 'boy' || raw === 'boys') return 'boys';
    if (raw === 'female' || raw === 'girl' || raw === 'girls') return 'girls';
    return '';
}

function isBoyShirtItem(item) {
    return normalizeItemKey(item?.name || '') === 'boyshirt';
}

function isGirlShirtItem(item) {
    return normalizeItemKey(item?.name || '') === 'girlshirt';
}

function shouldShowItemForGender(item, genderToken) {
    if (!item) return false;
    if (!genderToken) return true;
    if (isBoyShirtItem(item)) return genderToken === 'boys';
    if (isGirlShirtItem(item)) return genderToken === 'girls';
    return true;
}

function pickGenderSpecificShirtItem(items, genderToken) {
    if (!Array.isArray(items) || !items.length) return null;
    if (genderToken === 'boys') return items.find(isBoyShirtItem) || null;
    if (genderToken === 'girls') return items.find(isGirlShirtItem) || null;
    return items.find(i => normalizeItemKey(i?.name || '') === 'shirt') || null;
}

function genId() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input || !btn) return;

    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';

    const icon = btn.querySelector('i');
    if (icon) {
        icon.className = `ph ${isHidden ? 'ph-eye-slash' : 'ph-eye'}`;
    }
    btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    const text = document.getElementById('toast-message');
    if (!toast || !text) return;

    text.textContent = msg;
    toast.style.background = type === 'error' ? 'var(--danger)' : 'var(--bg-card)';
    toast.classList.remove('hidden');
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 2500);
}

function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}

function showView(viewId) {
    document.querySelectorAll('.view, #app-shell').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(viewId);
    if (target) target.classList.remove('hidden');
}

function showRegisterModal() {
    openModal('register-modal');
}

function updateTopbarUserInfo() {
    const nameEl = document.querySelector('.user-name');
    const roleEl = document.getElementById('active-user-role');
    if (nameEl) {
        nameEl.textContent = state.user?.username || state.user?.name || 'User';
    }
    if (roleEl) {
        roleEl.textContent = state.user?.role === 'admin' ? 'Admin' : 'Worker';
    }
}

function persistUserSession() {
    try {
        if (state.user) localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(state.user));
    } catch (e) {
        console.warn('Unable to persist user session', e);
    }
}

function persistActiveSchoolSession() {
    try {
        const schoolId = state.activeSchool?.id ? String(state.activeSchool.id) : '';
        if (schoolId) localStorage.setItem(STORAGE_SCHOOL_KEY, schoolId);
    } catch (e) {
        console.warn('Unable to persist school session', e);
    }
}

function clearPersistedSession() {
    try {
        localStorage.removeItem(STORAGE_USER_KEY);
        localStorage.removeItem(STORAGE_SCHOOL_KEY);
    } catch (e) {
        console.warn('Unable to clear persisted session', e);
    }
}

function applyRoleVisibility() {
    if (state.user?.role === 'worker') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
    } else {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    }
}

function openDashboardForActiveSchool() {
    const activeSchoolName = state.activeSchool?.name || 'No School Assigned';
    document.getElementById('active-school-name').textContent = activeSchoolName;
    updateTopbarUserInfo();
    applyRoleVisibility();

    showView('app-shell');
    switchNav('dashboard');

    if (!state.activeSchool?.id) {
        showToast('No school assigned. Ask admin to add/select a school.', 'error');
        return;
    }

    loadUniformCatalog().finally(() => {
        fetchStudents();
        fetchInvoices();
    });
}

function restoreSessionIfAvailable() {
    let user = null;
    let schoolId = '';

    try {
        const rawUser = localStorage.getItem(STORAGE_USER_KEY);
        user = rawUser ? JSON.parse(rawUser) : null;
        schoolId = String(localStorage.getItem(STORAGE_SCHOOL_KEY) || '');
    } catch (e) {
        user = null;
        schoolId = '';
    }

    if (!user) return;

    state.user = user;
    fetchSchools().then(() => {
        if (schoolId) {
            state.activeSchool = state.schools.find(s => String(s.id) === schoolId) || null;
        }

        if (state.user?.role === 'worker') {
            if (!state.activeSchool && state.schools.length) {
                state.activeSchool = state.schools[0];
                persistActiveSchoolSession();
            }
            openDashboardForActiveSchool();
            return;
        }

        if (state.activeSchool) {
            openDashboardForActiveSchool();
            return;
        }

        showView('view-school-select');
    }).catch(() => {
        clearPersistedSession();
        state.user = null;
        showView('view-login');
    });
}

// Removed: localStorage cache functions - now loading fresh data from database only
function getUploadedFilesForActiveSchool() {
    // Returns empty - files no longer cached locally
    return [];
}

function getDbFieldForPosItem(item) {
    return item?.dbField || null;
}

function normalizeCatalogItem(item, index) {
    const dbField = item?.db_field || item?.dbField || '';
    const priceMap = (item?.price_map && typeof item.price_map === 'object') ? item.price_map : {};
    const standardPriceMap = (item?.standard_price_map && typeof item.standard_price_map === 'object') ? item.standard_price_map : {};
    const parsedDefault = Number(item?.default_price);
    const itemName = String(item?.item_name || item?.name || '').trim();
    
    let iconClass = ITEM_ICON_BY_DB_FIELD[dbField] || 'ph-package';
    
    // Girl Shirt gets dress icon
    if (itemName.toLowerCase().includes('girl') && dbField === 'shirt') {
        iconClass = 'ph-dress';
    }
    // Pina gets skirt icon
    if (itemName.toLowerCase().includes('pina')) {
        iconClass = 'ph-skirt';
    }
    // PT Suit gets hoodie icon
    if (itemName.toLowerCase().includes('pt suit')) {
        iconClass = 'ph-hoodie';
    }
    
    return {
        id: index + 1,
        name: itemName,
        dbField,
        img: iconClass,
        sizes: Array.isArray(item?.sizes) ? item.sizes.filter(Boolean) : [],
        priceMap,
        standardPriceMap,
        defaultPrice: Number.isFinite(parsedDefault) ? parsedDefault : 0,
    };
}

function renderProductIconMarkup(item) {
    const iconValue = String(item?.img || '').trim();
    const lower = iconValue.toLowerCase();
    const isImage = lower.endsWith('.svg') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp');
    if (isImage) {
        return `<img class="product-image-icon" src="${iconValue}" alt="${String(item?.name || 'Product')} icon">`;
    }
    return `<i class="ph ${iconValue || 'ph-package'}"></i>`;
}

function parseUniformCellValue(rawValue) {
    if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') {
        return { qty: 0, size: '' };
    }

    const text = String(rawValue).trim();
    const token = text.toLowerCase();
    if (token === '-' || token === '--' || token === 'na' || token === 'n/a' || token === 'none') {
        return { qty: 0, size: '' };
    }

    const numberValue = Number(text);
    if (!Number.isNaN(numberValue)) {
        if (numberValue <= 0) return { qty: 0, size: '' };
        if (numberValue <= 10) return { qty: Math.round(numberValue), size: '' };
        return { qty: 1, size: text };
    }

    return { qty: 1, size: text };
}

function getBillingUnitPrice(itemId) {
    const parsed = Number(state.billingPriceByItemId[itemId]);
    return Number.isFinite(parsed) ? parsed : 0;
}

function getBillingStudentUnitPrice(item, size) {
    if (!item) return 0;

    const selectedSize = String(size || '').trim();
    const stdToken = String(state.activeBillingStudent?.std || '').trim();
    const genderRaw = String(state.activeBillingStudent?.gender || '').trim().toLowerCase();
    const genderToken = (genderRaw === 'male' || genderRaw === 'boy' || genderRaw === 'boys')
        ? 'boys'
        : ((genderRaw === 'female' || genderRaw === 'girl' || genderRaw === 'girls') ? 'girls' : '');

    const pickPrice = (entry) => {
        if (!entry || typeof entry !== 'object') return 0;
        const ordered = [
            genderToken ? entry[genderToken] : null,
            entry.default,
            entry.boys,
            entry.girls,
        ];
        for (const candidate of ordered) {
            const parsed = Number(candidate);
            if (Number.isFinite(parsed) && parsed > 0) return parsed;
        }
        return 0;
    };

    const stdMap = stdToken ? (item.standardPriceMap?.[stdToken] || null) : null;
    if (stdMap) {
        if (selectedSize && stdMap[selectedSize]) {
            const exact = pickPrice(stdMap[selectedSize]);
            if (exact > 0) return exact;
        }

        for (const sizeKey of Object.keys(stdMap)) {
            const fallbackInStd = pickPrice(stdMap[sizeKey]);
            if (fallbackInStd > 0) return fallbackInStd;
        }
    }

    if (selectedSize && item.priceMap?.[selectedSize]) {
        const bySize = pickPrice(item.priceMap[selectedSize]);
        if (bySize > 0) return bySize;
    }

    return Number.isFinite(item.defaultPrice) ? item.defaultPrice : 0;
}

// REMOVED: buildInvoiceQuantitiesPayload - no longer needed (database-only approach)

function loadUniformCatalog() {
    if (!state.activeSchool?.id) return Promise.resolve();

    return fetch(`${API_BASE}/uniform-catalog/${state.activeSchool.id}`)
        .then(res => res.json())
        .then(data => {
            const items = Array.isArray(data?.items) ? data.items : [];
            state.posItems = items.map((item, index) => normalizeCatalogItem(item, index)).filter(item => item.name);
            if (!state.posItems.length) {
                showToast('No products found in uniform_prices for selected school.', 'error');
            }
        })
        .catch(err => {
            console.error('loadUniformCatalog error', err);
            state.posItems = [];
            showToast('Failed to load products from database', 'error');
        });
}

function fetchSchools() {
    return fetch(`${API_BASE}/schools`)
        .then(res => res.json())
        .then(data => {
            const rows = Array.isArray(data?.data) ? data.data : [];
            state.schools = rows
                .map((row, idx) => {
                    const id = row?.id ? String(row.id) : '';
                    const schoolName = String(
                        row?.school_name || row?.name || row?.school || row?.schoolName || ''
                    ).trim();

                    return {
                        id,
                        name: schoolName || `School ${idx + 1}`,
                        address: row?.address || '',
                        contact_person: row?.contact_person || '',
                        contact_person_number: row?.contact_person_number || '',
                        academic_year: row?.academic_year || '',
                    };
                })
                .filter(s => s.id);
            populateSchoolDropdown();
        })
        .catch(err => {
            console.error('fetchSchools error', err);
            showToast('Failed to load schools', 'error');
        });
}

function populateSchoolDropdown() {
    const select = document.getElementById('school-dropdown');
    if (!select) return;
    select.innerHTML = '';

    if (!state.schools.length) {
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'No schools found. Add a school first.';
        placeholder.selected = true;
        select.appendChild(placeholder);
        return;
    }

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select a school';
    placeholder.selected = true;
    placeholder.disabled = true;
    select.appendChild(placeholder);

    state.schools.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name || s.id;
        select.appendChild(opt);
    });
}

function fetchStudents() {
    if (!state.activeSchool?.id) return Promise.resolve();

    return fetch(`${API_BASE}/students/school/${state.activeSchool.id}`)
        .then(res => res.json())
        .then(data => {
            const rows = Array.isArray(data) ? data : [];
            state.students = rows.map((student, idx) => ({
                id: student.id,
                sNo: student.sr_no || String(idx + 1),
                std: student.std || '',
                name: student.student_name || '',
                phone: student.mobile_no || '',
                parent: student.parent_name || '',
                gender: student.gender || '',
                house: student.house || '',
                school_id: student.school_id,
                uniform_data: student,
            }));

            renderStudentsTable(document.getElementById('search-student')?.value || '');
            renderParentsTable();
        })
        .catch(err => {
            console.error('fetchStudents error', err);
            showToast('Failed to load students', 'error');
        });
}

function fetchInvoices() {
    if (!state.activeSchool?.id) {
        state.invoices = [];
        renderInvoicesTable();
        return Promise.resolve();
    }

    return fetch(`${API_BASE}/invoices/school/${state.activeSchool.id}`)
        .then(res => res.json())
        .then(data => {
            state.invoices = Array.isArray(data?.data) ? data.data : [];
            renderInvoicesTable();
            renderBillingStudentsTable(document.getElementById('search-billing-student')?.value || '');
        })
        .catch(err => {
            console.error('fetchInvoices error', err);
            state.invoices = [];
            renderInvoicesTable();
            renderBillingStudentsTable(document.getElementById('search-billing-student')?.value || '');
        });
}

function switchNav(target) {
    document.querySelectorAll('.subview').forEach(el => el.classList.add('hidden'));
    const current = document.getElementById(`subview-${target}`);
    if (current) current.classList.remove('hidden');

    document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
        if (el.getAttribute('data-target') === target) el.classList.add('active');
        else el.classList.remove('active');
    });

    if (target === 'students-list') renderStudentsTable(document.getElementById('search-student')?.value || '');
    if (target === 'parents') renderParentsTable();
    if (target === 'invoices') fetchInvoices();
    if (target === 'stocks') loadStocks();
    if (target === 'billing') {
        Promise.all([fetchStudents(), fetchInvoices()])
            .finally(() => renderBillingStudentsTable(document.getElementById('search-billing-student')?.value || ''));
    }
    if (target === 'billing-pos') {
        if (!state.activeBillingStudent) {
            showToast('Select a student first from Students list.', 'error');
            switchNav('students-list');
            return;
        }
        setupBillingView();
    }
}

function continueToDashboard() {
    const schoolId = document.getElementById('school-dropdown')?.value;
    if (!schoolId) {
        showToast('Please select a school first.', 'error');
        return;
    }

    state.activeSchool = state.schools.find(s => s.id === schoolId) || null;
    if (!state.activeSchool) return;
    persistActiveSchoolSession();
    openDashboardForActiveSchool();
}

function logout() {
    state.user = null;
    state.activeSchool = null;
    state.activeBillingStudent = null;
    state.cart = {};
    clearPersistedSession();
    showView('view-login');
}

function renderStudentsTable(filterText = '') {
    const tbody = document.querySelector('#students-table tbody');
    const tableWrapper = document.getElementById('students-table')?.parentElement;
    const empty = document.getElementById('empty-students');
    if (!tbody) return;

    const lower = String(filterText || '').toLowerCase();
    const filtered = state.students.filter(s =>
        s.name.toLowerCase().includes(lower) ||
        s.std.toLowerCase().includes(lower)
    );

    tbody.innerHTML = '';

    if (!filtered.length) {
        if (empty) empty.classList.remove('hidden');
        if (tableWrapper) tableWrapper.classList.add('hidden');
        return;
    }

    if (empty) empty.classList.add('hidden');
    if (tableWrapper) tableWrapper.classList.remove('hidden');

    filtered.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" onchange="toggleStudentSelection('${s.id}', this.checked)"></td>
            <td>#${s.sNo}</td>
            <td><span class="badge badge-outline">${s.std}</span></td>
            <td class="font-medium">${s.name}</td>
            <td>${s.phone}</td>
            <td class="text-right">
                <div class="dropdown" id="dropdown-${s.id}">
                    <button class="dropdown-toggle" onclick="toggleDropdown('${s.id}')"><i class="ph ph-dots-three"></i></button>
                    <div class="dropdown-menu">
                        <button class="dropdown-item admin-only" onclick="editStudent('${s.id}')"><i class="ph ph-pencil-simple" style="margin-right: .5rem;"></i> Edit</button>
                        <button class="dropdown-item" onclick="startBillingForStudent('${s.id}')"><i class="ph ph-receipt" style="margin-right: .5rem;"></i> Create Invoice</button>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (state.user?.role === 'worker') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
    }
}

function renderParentsTable() {
    const tbody = document.querySelector('#parents-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    state.students.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="font-medium">${s.name}</td>
            <td>${s.parent || '-'}</td>
            <td>${s.phone || '-'}</td>
            <td>${s.address || '-'}</td>
            <td class="text-right"><button class="btn btn-icon-small"><i class="ph ph-pencil-simple"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
}

function getLatestInvoiceByStudentId(studentId) {
    const id = String(studentId || '');
    const related = state.invoices.filter(inv => String(inv.student_id || '') === id);
    if (!related.length) return null;

    related.sort((a, b) => {
        const aTime = Date.parse(a.created_at || '') || 0;
        const bTime = Date.parse(b.created_at || '') || 0;
        return bTime - aTime;
    });

    return related[0];
}

function getLatestPaidInvoiceByStudentId(studentId) {
    const id = String(studentId || '');
    const related = state.invoices.filter(inv =>
        String(inv.student_id || '') === id && String(inv.status || '').toLowerCase() === 'paid'
    );
    if (!related.length) return null;

    related.sort((a, b) => {
        const aTime = Date.parse(a.created_at || '') || 0;
        const bTime = Date.parse(b.created_at || '') || 0;
        return bTime - aTime;
    });

    return related[0];
}

function renderBillingStudentsTable(filterText = '') {
    const tbody = document.querySelector('#billing-invoices-table tbody');
    const table = document.getElementById('billing-invoices-table');
    const tableWrapper = table?.parentElement;
    const empty = document.getElementById('empty-billing-students');
    if (!tbody) return;

    const lower = String(filterText || '').toLowerCase();
    const filtered = state.invoices.filter(inv => {
        const isPaid = String(inv?.status || '').toLowerCase() === 'paid';
        if (!isPaid) return false;

        const invoiceId = String(inv.id || '').toLowerCase();
        const invoiceNumber = String(inv.invoice_number || '').toLowerCase();
        const studentName = String(inv.student_name || '').toLowerCase();
        const schoolName = String(inv.school_name || state.activeSchool?.name || '').toLowerCase();
        const status = String(inv.status || '').toLowerCase();
        return (
            invoiceId.includes(lower) ||
            invoiceNumber.includes(lower) ||
            studentName.includes(lower) ||
            schoolName.includes(lower) ||
            status.includes(lower)
        );
    });

    tbody.innerHTML = '';

    if (!filtered.length) {
        if (empty) empty.classList.remove('hidden');
        if (table) table.classList.add('hidden');
        return;
    }

    if (empty) empty.classList.add('hidden');
    if (table) table.classList.remove('hidden');
    if (tableWrapper) tableWrapper.classList.remove('hidden');

    filtered.forEach(inv => {
        const amount = Number(inv.total ?? inv.amount ?? 0);
        const status = inv.status || 'Pending';
        const statusCls = status === 'Paid' ? 'badge-success' : (status === 'Draft' ? 'badge-outline' : 'badge-warning');
        const paymentMode = String(inv.payment_mode || inv.paymentMode || '-').trim() || '-';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="font-medium">#INV-${inv.id || 'NA'}</td>
            <td>${inv.student_name || '-'}</td>
            <td>${state.activeSchool?.name || inv.school_name || '-'}</td>
            <td class="font-bold text-primary">₹${amount.toFixed(2)}</td>
            <td><span class="badge ${statusCls}">${status}</span></td>
            <td style="text-transform: capitalize;">${paymentMode}</td>
        `;
        tbody.appendChild(tr);
    });
}

function exportTotalSaleXls() {
    if (typeof XLSX === 'undefined') {
        showToast('XLS export library not loaded.', 'error');
        return;
    }

    const paidInvoices = state.invoices.filter(inv =>
        String(inv?.status || '').toLowerCase() === 'paid'
    );

    if (!paidInvoices.length) {
        showToast('No paid invoices found to export.', 'error');
        return;
    }

    const rows = [["Invoice ID", "Student Name", "Total Amount", "Status", "Mode of Payment"]];
    let grandTotal = 0;

    paidInvoices.forEach((inv) => {
        const amount = Number(inv.total ?? inv.amount ?? 0) || 0;
        grandTotal += amount;

        rows.push([
            String(inv.invoice_number || `INV-${inv.id || 'NA'}`),
            String(inv.student_name || '-'),
            Number(amount.toFixed(2)),
            String(inv.status || 'Paid'),
            String(inv.payment_mode || inv.paymentMode || '-'),
        ]);
    });

    rows.push([]);
    rows.push(["TOTAL", "", Number(grandTotal.toFixed(2)), "", ""]);

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Total Sale');

    const schoolName = String(state.activeSchool?.name || 'School').replace(/[^a-z0-9]+/gi, '_');
    const dateText = new Date().toISOString().slice(0, 10);
    const fileName = `${schoolName}_total_sale_${dateText}.xlsx`;

    XLSX.writeFile(book, fileName);
    showToast('Total sale XLS exported successfully.');
}

function renderInvoicesTable() {
    const tbody = document.querySelector('#invoices-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const draftInvoices = state.invoices.filter(inv =>
        String(inv?.status || '').toLowerCase() === 'draft'
    );

    draftInvoices.forEach(inv => {
        const amount = Number(inv.total ?? inv.amount ?? 0);
        const status = inv.status || 'Pending';
        const statusCls = status === 'Paid' ? 'badge-success' : (status === 'Draft' ? 'badge-outline' : 'badge-warning');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="font-medium">#INV-${inv.id || 'NA'}</td>
            <td>${inv.student_name || '-'}</td>
            <td>${state.activeSchool?.name || inv.school_name || '-'}</td>
            <td class="font-bold text-primary">₹${amount.toFixed(2)}</td>
            <td><span class="badge ${statusCls}">${status}</span></td>
            <td class="text-right">-</td>
        `;
        tbody.appendChild(tr);
    });

    if (!draftInvoices.length) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="6" class="text-center text-muted">No draft bills found.</td>';
        tbody.appendChild(tr);
    }
}

let studentCart = {};

function renderStudentPOSItems(filterText = '') {
    const grid = document.getElementById('modal-pos-items-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!state.posItems.length) {
        grid.innerHTML = '<div class="empty-cart text-center text-muted p-4"><p>No products configured in uniform_prices.</p></div>';
        return;
    }

    const lower = String(filterText || '').toLowerCase();
    const genderToken = getStudentGenderToken();
    const filtered = state.posItems
        .filter(item => item.name.toLowerCase().includes(lower))
        .filter(item => shouldShowItemForGender(item, genderToken));

    filtered.forEach(item => {
        const entry = studentCart[item.id] || { qty: 0, size: '' };
        const sizes = item.sizes?.length ? item.sizes : ['XS', 'S', 'M', 'L', 'XL'];
        const options = sizes.map(s => `<option value="${s}">${s}</option>`).join('');

        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="product-image">${renderProductIconMarkup(item)}</div>
            <div class="product-info">
                <div class="product-title">${item.name}</div>
                <div class="size-select-container mt-2">
                    <select class="size-select" onchange="updateStudentItemSize(${item.id}, this.value)">
                        <option value="">Size</option>
                        ${options}
                    </select>
                </div>
                <div class="qty-controls mt-2">
                    <button class="qty-btn" onclick="updateStudentItemQty(${item.id}, -1)"><i class="ph ph-minus"></i></button>
                    <span class="qty-display">${entry.qty || 0}</span>
                    <button class="qty-btn" onclick="updateStudentItemQty(${item.id}, 1)"><i class="ph ph-plus"></i></button>
                </div>
            </div>
        `;

        grid.appendChild(card);
        const select = card.querySelector('.size-select');
        if (select && entry.size) select.value = entry.size;
    });
}

function updateStudentItemQty(itemId, change) {
    const current = studentCart[itemId] || { qty: 0, size: '' };
    const nextQty = current.qty + change;
    if (nextQty <= 0) delete studentCart[itemId];
    else studentCart[itemId] = { qty: nextQty, size: current.size };

    renderStudentPOSItems(document.getElementById('search-items-student')?.value || '');
    updateStudentCartUI();
}

function updateStudentItemSize(itemId, size) {
    const current = studentCart[itemId] || { qty: 0, size: '' };
    studentCart[itemId] = { qty: current.qty, size };
    updateStudentCartUI();
}

function getStudentGenderToken() {
    return getGenderToken(document.getElementById('add-student-gender')?.value || '');
}

function getSelectedStudentStandard() {
    const raw = String(document.getElementById('add-student-class')?.value || '').trim();
    if (!raw) return '';
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return '';
    return String(Math.trunc(parsed));
}

function getStudentItemUnitPrice(item, size) {
    if (!item) return 0;

    const selectedSize = String(size || '').trim();
    const genderToken = getStudentGenderToken();
    const standardToken = getSelectedStudentStandard();
    const stdMap = standardToken ? (item.standardPriceMap?.[standardToken] || null) : null;

    const pickPrice = (entry) => {
        if (!entry) return 0;
        const orderedCandidates = [
            genderToken ? entry[genderToken] : null,
            entry.default,
            entry.boys,
            entry.girls,
        ];
        for (const candidate of orderedCandidates) {
            const parsed = Number(candidate);
            if (Number.isFinite(parsed) && parsed > 0) return parsed;
        }
        return 0;
    };

    // Highest priority: exact standard + exact size.
    if (stdMap && selectedSize && stdMap[selectedSize]) {
        const exactStandardPrice = pickPrice(stdMap[selectedSize]);
        if (exactStandardPrice > 0) return exactStandardPrice;
    }

    // Fallback in same standard: any priced size for item.
    if (stdMap) {
        for (const key of Object.keys(stdMap)) {
            const sameStandardPrice = pickPrice(stdMap[key]);
            if (sameStandardPrice > 0) return sameStandardPrice;
        }
    }

    // Legacy fallback: size-based catalog mapping without standard.
    const sizeEntry = selectedSize ? (item.priceMap?.[selectedSize] || null) : null;

    if (sizeEntry) {
        const fallbackBySizePrice = pickPrice(sizeEntry);
        if (fallbackBySizePrice > 0) return fallbackBySizePrice;
    }

    return Number.isFinite(item.defaultPrice) ? item.defaultPrice : 0;
}

function updateStudentCartUI() {
    const list = document.getElementById('modal-cart-items-list');
    const subtotalEl = document.getElementById('modal-bill-subtotal');
    const totalEl = document.getElementById('modal-bill-total');
    if (!list) return;
    list.innerHTML = '';

    const keys = Object.keys(studentCart);
    if (!keys.length) {
        list.innerHTML = '<div class="empty-cart text-center text-muted p-4"><i class="ph ph-shopping-cart" style="font-size: 2rem;"></i><p>No items selected yet.</p></div>';
        if (subtotalEl) subtotalEl.textContent = '0.00';
        if (totalEl) totalEl.textContent = '0.00';
        return;
    }

    let subtotal = 0;

    keys.forEach(k => {
        const itemId = Number(k);
        const item = state.posItems.find(i => i.id === itemId);
        if (!item) return;
        const entry = studentCart[itemId];
        const qty = Number(entry?.qty) || 0;
        if (qty <= 0) return;

        const unitPrice = getStudentItemUnitPrice(item, entry.size);
        const lineTotal = unitPrice * qty;
        subtotal += lineTotal;

        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div class="cart-item-info">
                <div class="cart-item-title">${item.name}${entry.size ? ` (${entry.size})` : ''}</div>
                <div class="cart-item-meta">Qty: ${qty}${unitPrice > 0 ? ` x ₹${unitPrice.toFixed(2)}` : ''}</div>
            </div>
            <div class="cart-item-price">₹${lineTotal.toFixed(2)}</div>
        `;
        list.appendChild(div);
    });

    if (subtotalEl) subtotalEl.textContent = subtotal.toFixed(2);
    if (totalEl) totalEl.textContent = subtotal.toFixed(2);
}

function buildUniformItemsFromStudentCart() {
    const rows = [];
    Object.keys(studentCart).forEach(k => {
        const itemId = Number(k);
        const item = state.posItems.find(i => i.id === itemId);
        if (!item) return;
        const entry = studentCart[itemId];
        if (!entry?.qty) return;

        rows.push({
            item_name: item.name,
            quantity: Number(entry.qty) || 0,
            size: entry.size || null,
        });
    });
    return rows;
}

function buildUniformFieldsFromStudentCart() {
    const fields = {};
    Object.keys(studentCart).forEach(k => {
        const itemId = Number(k);
        const item = state.posItems.find(i => i.id === itemId);
        if (!item) return;
        const entry = studentCart[itemId];
        const dbField = getDbFieldForPosItem(item);
        if (!dbField || !entry?.qty) return;
        fields[dbField] = entry.size ? String(entry.size) : Number(entry.qty);
    });
    return fields;
}

function openAddStudentModal() {
    const form = document.getElementById('add-student-form');
    if (form) form.reset();

    studentCart = {};
    renderStudentPOSItems('');
    updateStudentCartUI();
    openModal('add-student-modal');
}

function handleAddStudent(e) {
    e.preventDefault();
    if (!state.activeSchool?.id) return;

    const uniformItems = buildUniformItemsFromStudentCart();
    const uniformFields = buildUniformFieldsFromStudentCart();

    const payload = {
        school_id: state.activeSchool.id,
        student_name: document.getElementById('add-student-name')?.value?.trim() || '',
        std: document.getElementById('add-student-class')?.value?.trim() || '',
        gender: document.getElementById('add-student-gender')?.value?.trim() || '',
        parent_name: document.getElementById('add-student-parent')?.value?.trim() || '',
        mobile_no: document.getElementById('add-student-parent-phone')?.value?.trim() || '',
        uniform_items: uniformItems,
        ...uniformFields,
    };

    fetch(`${API_BASE}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
        .then(res => res.json())
        .then(data => {
            if (data.message?.includes('successfully')) {
                closeModal('add-student-modal');
                showToast('Student added successfully');
                fetchStudents();
            } else {
                showToast(data.message || 'Failed to add student', 'error');
            }
        })
        .catch(err => {
            console.error('handleAddStudent error', err);
            showToast('Connection error while adding student', 'error');
        });
}

let currentEditStudentId = null;

function editStudent(id) {
    const s = state.students.find(st => st.id === id);
    if (!s) return;

    currentEditStudentId = id;
    document.getElementById('edit-student-name').value = s.name || '';
    document.getElementById('edit-student-class').value = s.std || '';
    document.getElementById('edit-student-gender').value = s.gender || '';
    document.getElementById('edit-student-parent').value = s.parent || '';
    document.getElementById('edit-student-parent-phone').value = s.phone || '';

    closeDropdown(id);
    openModal('edit-student-modal');
}

function handleEditStudent(e) {
    e.preventDefault();
    if (!currentEditStudentId) return;

    const payload = {
        student_name: document.getElementById('edit-student-name')?.value?.trim() || '',
        std: document.getElementById('edit-student-class')?.value?.trim() || '',
        gender: document.getElementById('edit-student-gender')?.value?.trim() || '',
        parent_name: document.getElementById('edit-student-parent')?.value?.trim() || '',
        mobile_no: document.getElementById('edit-student-parent-phone')?.value?.trim() || '',
    };

    fetch(`${API_BASE}/students/${currentEditStudentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
        .then(res => res.json())
        .then(data => {
            if (data.message?.includes('successfully')) {
                closeModal('edit-student-modal');
                showToast('Student updated successfully');
                currentEditStudentId = null;
                fetchStudents();
            } else {
                showToast(data.message || 'Failed to update student', 'error');
            }
        })
        .catch(err => {
            console.error('handleEditStudent error', err);
            showToast('Connection error while updating student', 'error');
        });
}

function openAddParentModal() {
    console.log('openAddParentModal called');
    const form = document.getElementById('add-parent-form');
    if (form) form.reset();
    
    // Populate student dropdown
    const select = document.getElementById('add-parent-student');
    console.log('select element:', select);
    console.log('state.students:', state.students);
    
    if (select) {
        select.innerHTML = '<option value="">Select Student</option>';
        if (state.students && state.students.length > 0) {
            state.students.forEach(s => {
                const option = document.createElement('option');
                option.value = s.id;
                option.textContent = `${s.name || 'N/A'} (Std ${s.std || 'N/A'})`;
                select.appendChild(option);
            });
        } else {
            const option = document.createElement('option');
            option.disabled = true;
            option.textContent = 'No students available';
            select.appendChild(option);
        }
    }
    
    console.log('Opening modal');
    openModal('add-parent-modal');
}

function handleAddParent(e) {
    e.preventDefault();
    console.log('handleAddParent called');
    
    const studentId = document.getElementById('add-parent-student')?.value?.trim();
    const parentName = document.getElementById('add-parent-name')?.value?.trim();
    const parentPhone = document.getElementById('add-parent-phone')?.value?.trim();
    
    console.log('Form data:', { studentId, parentName, parentPhone });
    
    if (!studentId) {
        console.log('No student selected');
        showToast('Please select a student', 'error');
        return;
    }
    
    const payload = {
        parent_name: parentName || '',
        mobile_no: parentPhone || '',
    };

    console.log('Sending payload:', payload);
    
    fetch(`${API_BASE}/students/${studentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
        .then(res => res.json())
        .then(data => {
            console.log('Response:', data);
            if (data.message?.includes('successfully')) {
                closeModal('add-parent-modal');
                showToast('Parent details added successfully');
                fetchStudents();
            } else {
                showToast(data.message || 'Failed to add parent details', 'error');
            }
        })
        .catch(err => {
            console.error('handleAddParent error', err);
            showToast('Connection error while adding parent details', 'error');
        });
}

function setupBillingView() {
    const s = state.activeBillingStudent;
    if (!s) return;

    document.getElementById('bill-student-name').textContent = s.name || '-';
    document.getElementById('bill-student-std').textContent = `Std ${s.std || '-'}`;
    document.getElementById('bill-parent-name').textContent = s.parent || '-';
    document.getElementById('bill-student-phone').textContent = s.phone || '-';
    document.getElementById('bill-student-house').textContent = s.house || '-';

    document.getElementById('search-items').value = '';
    setPaymentMode(state.paymentMode || 'cash');
    renderPOSItems('');
    updateCartUI();
}

function startBillingForStudent(studentId) {
    const student = state.students.find(s => s.id === studentId);
    if (!student) return;

    state.activeBillingStudent = student;
    // CLEAR all caches - fetch fresh data from database
    state.billingPriceByItemId = {};
    state.billingSizeByItemId = {};
    state.cart = {};
    state.paymentMode = 'cash';

    // Fetch fresh invoice data from database (no local cache used)
    fetch(`${API_BASE}/create-invoice/${studentId}`)
        .then(res => res.json())
        .then(data => {
            const items = Array.isArray(data?.items) ? data.items : [];
            const serverCart = {};
            const studentGenderToken = getGenderToken(student.gender);

            items.forEach(line => {
                const key = normalizeItemKey(line.dress || '');
                let item = state.posItems.find(p => normalizeItemKey(p.name) === key);
                if (!item && key === 'shirt') {
                    item = pickGenderSpecificShirtItem(state.posItems, studentGenderToken);
                }
                if (!item) return;

                const qty = Number(line.quantity) || 0;
                if (qty > 0) serverCart[item.id] = qty;
                if (line.size && line.size !== '-') state.billingSizeByItemId[item.id] = String(line.size);
                state.billingPriceByItemId[item.id] = Number(line.unit_price) || 0;
            });

            // Use fresh database data only
            state.cart = serverCart;

            renderPOSItems(document.getElementById('search-items')?.value || '');
            updateCartUI();
        })
        .catch(err => {
            console.error('Failed to load invoice from database:', err);
            showToast('Failed to load student data from database', 'error');
        });

    switchNav('billing-pos');
}

function setPaymentMode(mode) {
    const selected = String(mode || '').toLowerCase() === 'online' ? 'online' : 'cash';
    state.paymentMode = selected;

    const cashBtn = document.getElementById('payment-mode-cash');
    const onlineBtn = document.getElementById('payment-mode-online');
    if (!cashBtn || !onlineBtn) return;

    if (selected === 'cash') {
        cashBtn.classList.remove('btn-outline');
        cashBtn.classList.add('btn-primary');
        onlineBtn.classList.remove('btn-primary');
        onlineBtn.classList.add('btn-outline');
    } else {
        onlineBtn.classList.remove('btn-outline');
        onlineBtn.classList.add('btn-primary');
        cashBtn.classList.remove('btn-primary');
        cashBtn.classList.add('btn-outline');
    }
}

function renderPOSItems(filterText = '') {
    const grid = document.getElementById('pos-items-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!state.posItems.length) {
        grid.innerHTML = '<div class="empty-cart text-center text-muted p-4"><p>No products configured in uniform_prices.</p></div>';
        return;
    }

    const lower = String(filterText || '').toLowerCase();
    const billingGenderToken = getGenderToken(state.activeBillingStudent?.gender || '');
    const filtered = state.posItems
        .filter(item => item.name.toLowerCase().includes(lower))
        .filter(item => shouldShowItemForGender(item, billingGenderToken));

    filtered.forEach(item => {
        const qty = state.cart[item.id] || 0;
        const unitPrice = getBillingUnitPrice(item.id);
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="product-image">${renderProductIconMarkup(item)}</div>
            <div class="product-info">
                <div class="product-title">${item.name}</div>
                <div class="product-price">${unitPrice > 0 ? `₹${unitPrice}` : 'Price from DB'}</div>
                <div class="qty-controls mt-2">
                    <button class="qty-btn" onclick="updateItemQty(${item.id}, -1)"><i class="ph ph-minus"></i></button>
                    <span class="qty-display">${qty}</span>
                    <button class="qty-btn" onclick="updateItemQty(${item.id}, 1)"><i class="ph ph-plus"></i></button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function updateItemQty(itemId, change) {
    const current = Number(state.cart[itemId] || 0);
    const next = current + change;
    if (next <= 0) {
        delete state.cart[itemId];
        delete state.billingPriceByItemId[itemId];
    } else {
        state.cart[itemId] = next;
        // Set the price when item is first added to cart.
        // Prefer student-specific database mapping over generic default averages.
        if (!state.billingPriceByItemId[itemId]) {
            const item = state.posItems.find(i => i.id === itemId);
            if (item) {
                const selectedSize = state.billingSizeByItemId[itemId] || '';
                const resolved = getBillingStudentUnitPrice(item, selectedSize);
                if (resolved > 0) {
                    state.billingPriceByItemId[itemId] = resolved;
                }
            }
        }
    }

    renderPOSItems(document.getElementById('search-items')?.value || '');
    updateCartUI();
}

function updateCartUI() {
    const list = document.getElementById('cart-items-list');
    if (!list) return;
    list.innerHTML = '';

    let subtotal = 0;
    const keys = Object.keys(state.cart);

    if (!keys.length) {
        list.innerHTML = '<div class="empty-cart text-center text-muted p-4"><i class="ph ph-shopping-cart" style="font-size: 2rem;"></i><p>No items selected yet.</p></div>';
    } else {
        keys.forEach(k => {
            const itemId = Number(k);
            const item = state.posItems.find(i => i.id === itemId);
            if (!item) return;

            const qty = Number(state.cart[itemId] || 0);
            const unitPrice = getBillingUnitPrice(itemId);
            const lineTotal = unitPrice * qty;
            subtotal += lineTotal;
            const size = state.billingSizeByItemId[itemId];

            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <div class="cart-item-info">
                    <div class="cart-item-title">${item.name}${size ? ` (${size})` : ''}</div>
                    <div class="cart-item-meta">₹${unitPrice.toFixed(2)} × ${qty}</div>
                </div>
                <div class="cart-item-price">₹${lineTotal.toFixed(2)}</div>
            `;
            list.appendChild(div);
        });
    }

    state.cartTotal = subtotal;
    const sub = document.getElementById('bill-subtotal');
    const total = document.getElementById('bill-total');
    if (sub) sub.textContent = subtotal.toFixed(2);
    if (total) total.textContent = subtotal.toFixed(2);
}

function persistInvoice(status) {
    if (!state.activeBillingStudent?.id) {
        return Promise.resolve({ ok: false, message: 'No active student selected.' });
    }

    const invoiceItems = Object.keys(state.cart).map((k) => {
        const itemId = Number(k);
        const item = state.posItems.find(p => p.id === itemId);
        const quantity = Number(state.cart[itemId] || 0);
        const unitPrice = getBillingUnitPrice(itemId);
        const size = state.billingSizeByItemId[itemId] || null;

        if (!item || quantity <= 0) return null;
        return {
            item_name: item.name,
            quantity,
            size,
            unit_price: unitPrice,
        };
    }).filter(Boolean);

    const payload = {
        student_id: state.activeBillingStudent.id,
        school_id: state.activeSchool?.id || null,
        status,
        payment_mode: state.paymentMode || 'cash',
        items: invoiceItems,
    };

    return fetch(`${API_BASE}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
        .then(res => res.json().then(data => ({ statusCode: res.status, data })))
        .then(({ statusCode, data }) => {
            if (statusCode >= 200 && statusCode < 300) {
                const inserted = Array.isArray(data?.data) && data.data.length ? data.data[0] : null;
                if (inserted) {
                    const exists = state.invoices.some(inv => String(inv.id || '') === String(inserted.id || ''));
                    if (!exists) state.invoices.unshift(inserted);
                }

                const lines = Array.isArray(data?.invoice?.items) ? data.invoice.items : [];
                lines.forEach(line => {
                    const key = normalizeItemKey(line.dress || '');
                    const item = state.posItems.find(p => normalizeItemKey(p.name) === key);
                    if (!item) return;
                    state.billingPriceByItemId[item.id] = Number(line.unit_price) || 0;
                    if (line.size && line.size !== '-') state.billingSizeByItemId[item.id] = String(line.size);
                });

                return { ok: true, invoiceId: inserted?.id || genId() };
            }

            return { ok: false, message: data?.message || 'Failed to store invoice.' };
        })
        .catch(err => {
            console.error('persistInvoice error', err);
            return { ok: false, message: 'Connection error while storing invoice.' };
        });
}

function saveAsDraft() {
    if (!Object.keys(state.cart).length) {
        showToast('Cannot save empty draft.', 'error');
        return;
    }
    persistInvoice('Draft').then(result => {
        if (!result.ok) {
            showToast(result.message || 'Failed to save draft', 'error');
            return;
        }
        showToast('Invoice saved as draft.');
        showPaperBill(String(result.invoiceId), 'Draft');
    });
}

function generateInvoice() {
    if (!Object.keys(state.cart).length) {
        showToast('Cannot generate empty bill.', 'error');
        return;
    }
    if (isInvoiceSubmitting) {
        showToast('Invoice generation already in progress.', 'error');
        return;
    }

    isInvoiceSubmitting = true;
    const btn = document.getElementById('btn-generate-invoice');
    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.7';
    }

    persistInvoice('Paid').then(result => {
        if (!result.ok) {
            showToast(result.message || 'Failed to generate invoice', 'error');
            isInvoiceSubmitting = false;
            if (btn) {
                btn.disabled = false;
                btn.style.opacity = '1';
            }
            return;
        }
        showToast('Invoice generated successfully.');
        showPaperBill(String(result.invoiceId), 'Paid');
        fetchInvoices();
        loadStocks();
        isInvoiceSubmitting = false;
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    });
}

function showPaperBill(invoiceId, status) {
    const s = state.activeBillingStudent;
    if (!s) return;

    const now = new Date();
    document.getElementById('pb-invoice-id').textContent = `INV-${invoiceId}`;
    document.getElementById('pb-date').textContent = now.toLocaleDateString('en-IN');
    document.getElementById('pb-time').textContent = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('pb-student-name').textContent = s.name || '-';
    document.getElementById('pb-student-std').textContent = s.std || '-';
    document.getElementById('pb-student-roll').textContent = s.sNo || '-';
    document.getElementById('pb-school-name').textContent = state.activeSchool?.name || '-';
    document.getElementById('pb-phone').textContent = s.phone || '-';
    document.getElementById('pb-barcode-label').textContent = `INV-${invoiceId}`;

    const tbody = document.getElementById('pb-items-body');
    tbody.innerHTML = '';

    let subtotal = 0;
    let idx = 1;
    Object.keys(state.cart).forEach(k => {
        const itemId = Number(k);
        const item = state.posItems.find(i => i.id === itemId);
        if (!item) return;

        const qty = Number(state.cart[itemId] || 0);
        const unitPrice = getBillingUnitPrice(itemId);
        const lineTotal = unitPrice * qty;
        subtotal += lineTotal;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align:center">${idx}</td>
            <td>${item.name}</td>
            <td style="text-align:center">${qty}</td>
            <td style="text-align:right">₹${unitPrice.toFixed(2)}</td>
            <td style="text-align:right">₹${lineTotal.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
        idx += 1;
    });

    const grand = subtotal;

    document.getElementById('pb-subtotal').textContent = `₹${subtotal.toFixed(2)}`;
    document.getElementById('pb-total').textContent = `₹${grand.toFixed(2)}`;
    document.getElementById('pb-amount-words').textContent = `Rupees ${Math.round(grand)} Only`;
    document.getElementById('pb-payment-mode').textContent = String(state.paymentMode || 'cash').toUpperCase();

    const stamp = document.getElementById('pb-status-stamp');
    stamp.textContent = status.toUpperCase();
    stamp.className = 'paper-bill-status-stamp' + (status === 'Paid' ? ' paid' : '');

    openModal('bill-draft-modal');
}

function handleLogin(e) {
    e.preventDefault();

    const payload = {
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value,
        role: document.getElementById('login-role').value,
    };

    fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
        .then(res => res.json())
        .then(data => {
            console.log('[login] response received:', data);
            if (data.message === 'Login successful') {
                state.user = {
                    id: data.user?.id,
                    username: data.user?.name || data.user?.username || data.user?.email || 'User',
                    email: data.user?.email,
                    role: data.user?.role,
                };
                persistUserSession();
                showToast('Logged in successfully');
                
                // Route by role after loading schools.
                fetchSchools()
                    .then(() => {
                        console.log('[login] schools loaded');
                        if (state.user?.role === 'worker') {
                            state.activeSchool = state.schools[0] || null;
                            if (state.activeSchool) persistActiveSchoolSession();
                            openDashboardForActiveSchool();
                            return;
                        }

                        state.activeSchool = null;
                        showView('view-school-select');
                    })
                    .catch(err => {
                        console.error('[login] error fetching schools:', err);
                        if (state.user?.role === 'worker') {
                            state.activeSchool = null;
                            openDashboardForActiveSchool();
                            return;
                        }
                        showView('view-school-select');
                    });
            } else {
                console.log('[login] login failed with message:', data.message);
                showToast(data.message || 'Login failed', 'error');
            }
        })
        .catch(err => {
            console.error('[login] network or parse error:', err);
            showToast('Connection error while logging in', 'error');
        });
}

function handleRegister(e) {
    e.preventDefault();

    const payload = {
        name: document.getElementById('register-name').value,
        email: document.getElementById('register-email').value,
        password: document.getElementById('register-password').value,
        role: document.getElementById('register-role').value,
    };

    fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
        .then(res => res.json())
        .then(data => {
            if (data.message?.includes('successfully')) {
                showToast('Registration successful');
                closeModal('register-modal');
                document.getElementById('register-form').reset();
            } else {
                showToast(data.message || 'Registration failed', 'error');
            }
        })
        .catch(err => {
            console.error('handleRegister error', err);
            showToast('Connection error while registering', 'error');
        });
}

function handleAddSchool(e) {
    e.preventDefault();

    const file = document.getElementById('school-excel-file')?.files?.[0];
    if (!file) {
        showToast('Upload the school pricing file before adding school.', 'error');
        return;
    }

    const lowerName = String(file.name || '').toLowerCase();
    if (!(lowerName.endsWith('.xls') || lowerName.endsWith('.xlsx') || lowerName.endsWith('.csv'))) {
        showToast('Invalid file type. Please upload .xls, .xlsx, or .csv', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('school_name', document.getElementById('add-school-name').value);
    formData.append('address', document.getElementById('add-school-address').value);
    formData.append('contact_person', document.getElementById('add-school-contact-person').value);
    formData.append('contact_person_number', document.getElementById('add-school-phone').value);
    formData.append('academic_year', document.getElementById('add-school-year').value || '2024-2025');
    formData.append('file', file);

    fetch(`${API_BASE}/schools`, { method: 'POST', body: formData })
        .then(async res => ({ status: res.status, data: await res.json() }))
        .then(({ status, data }) => {
            if (data.message?.includes('successfully')) {
                showToast('School added successfully');
                closeModal('add-school-modal');
                document.getElementById('add-school-form').reset();
                const fileInfo = document.getElementById('school-file-info');
                if (fileInfo) fileInfo.classList.add('hidden');
                fetchSchools();
            } else {
                const prefix = status >= 400 ? 'Upload failed: ' : '';
                showToast(prefix + (data.message || 'Failed to add school'), 'error');
            }
        })
        .catch(err => {
            console.error('handleAddSchool error', err);
            showToast('Connection error while adding school', 'error');
        });
}

function mockImportStudents() {
    const file = document.getElementById('bulk-student-file')?.files?.[0];
    if (!file || !state.activeSchool?.id) {
        showToast('Select a file and school first.', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('school_id', state.activeSchool.id);

    fetch(`${API_BASE}/students/bulk`, { method: 'POST', body: formData })
        .then(async res => {
            let data = {};
            try {
                data = await res.json();
            } catch (e) {
                data = {};
            }
            return { status: res.status, data };
        })
        .then(({ status, data }) => {
            if (status >= 200 && status < 300 && data.message?.includes('successfully')) {
                showToast(data.message || 'Students imported successfully');
                fetchStudents();
                switchNav('students-list');
                return;
            }

            const prefix = status >= 400 ? 'Import failed: ' : '';
            showToast(prefix + (data.message || 'Failed to import students'), 'error');
        })
        .catch(err => {
            console.error('mockImportStudents error', err);
            showToast('Connection error while importing students', 'error');
        });
}

function toggleDropdown(studentId) {
    document.querySelectorAll('.dropdown').forEach(el => {
        if (el.id !== `dropdown-${studentId}`) el.classList.remove('show');
    });

    const el = document.getElementById(`dropdown-${studentId}`);
    if (el) el.classList.toggle('show');
}

function closeDropdown(studentId) {
    const el = document.getElementById(`dropdown-${studentId}`);
    if (el) el.classList.remove('show');
}

function toggleStudentSelection(id, checked) {
    if (!id) return;
    if (checked) state.selectedStudentIds.add(String(id));
    else state.selectedStudentIds.delete(String(id));
}

function toggleSelectAllStudents(checked) {
    const boxes = document.querySelectorAll('#students-table tbody input[type="checkbox"]');
    boxes.forEach(cb => {
        cb.checked = checked;
        const onchange = cb.getAttribute('onchange') || '';
        const match = onchange.match(/'([^']+)'/);
        if (!match?.[1]) return;
        if (checked) state.selectedStudentIds.add(match[1]);
        else state.selectedStudentIds.delete(match[1]);
    });
}

function deleteSelectedStudents() {
    const ids = Array.from(state.selectedStudentIds);
    if (!ids.length) {
        showToast('Select at least one student to delete.', 'error');
        return;
    }

    fetch(`${API_BASE}/students/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
    })
        .then(res => res.json())
        .then(data => {
            if (data.message?.includes('successfully')) {
                state.selectedStudentIds.clear();
                showToast(data.message);
                fetchStudents();
            } else {
                showToast(data.message || 'Failed to delete students', 'error');
            }
        })
        .catch(err => {
            console.error('deleteSelectedStudents error', err);
            showToast('Connection error while deleting students', 'error');
        });
}

document.addEventListener('click', (event) => {
    if (!event.target.closest('.dropdown')) {
        document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('show'));
    }
});

function clearAllFrontendCache() {
    // Clear all localStorage data
    localStorage.clear();
    
    // Clear all sessionStorage data
    sessionStorage.clear();
    
    // Clear IndexedDB if available
    if (window.indexedDB) {
        try {
            const dbs = window.indexedDB.databases();
            if (dbs && typeof dbs.then === 'function') {
                dbs.then(list => {
                    list.forEach(db => {
                        try {
                            window.indexedDB.deleteDatabase(db.name);
                        } catch (e) {
                            console.warn(`Could not delete IndexedDB: ${db.name}`, e);
                        }
                    });
                }).catch(err => console.warn('Could not list IndexedDB databases', err));
            }
        } catch (e) {
            console.warn('IndexedDB not available', e);
        }
    }
    
    // Clear all cookies
    document.cookie.split(';').forEach(cookie => {
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
    
    // Clear all state data
    state.user = null;
    state.activeSchool = null;
    state.activeBillingStudent = null;
    state.schools = [];
    state.students = [];
    state.invoices = [];
    state.posItems = [];
    state.cart = {};
    state.cartTotal = 0;
    state.billingPriceByItemId = {};
    state.billingSizeByItemId = {};
    state.activeUploadedFileId = null;
    state.selectedStudentIds = new Set();
    
    // Clear any global variables with cached data
    if (typeof studentCart !== 'undefined') {
        studentCart = {};
    }
    if (typeof uploadedStudentFilesBySchool !== 'undefined') {
        uploadedStudentFilesBySchool = {};
    }
    
    console.log('All frontend caches have been cleared.');
}

// Expose cache clearing function globally for manual use
window.clearCache = clearAllFrontendCache;

function initApp() {
    // Restore previous session so refresh does not force login again.
    restoreSessionIfAvailable();
    
    
    document.getElementById('login-form')?.addEventListener('submit', handleLogin);
    document.getElementById('register-form')?.addEventListener('submit', handleRegister);
    document.getElementById('add-school-form')?.addEventListener('submit', handleAddSchool);
    document.getElementById('add-student-form')?.addEventListener('submit', handleAddStudent);
    document.getElementById('edit-student-form')?.addEventListener('submit', handleEditStudent);
    document.getElementById('add-parent-form')?.addEventListener('submit', handleAddParent);

    document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            const target = el.getAttribute('data-target');
            if (target) switchNav(target);
        });
    });

    document.getElementById('search-student')?.addEventListener('input', (e) => renderStudentsTable(e.target.value || ''));
    document.getElementById('search-billing-student')?.addEventListener('input', (e) => renderBillingStudentsTable(e.target.value || ''));
    document.getElementById('search-items')?.addEventListener('input', (e) => renderPOSItems(e.target.value || ''));
    document.getElementById('search-items-student')?.addEventListener('input', (e) => renderStudentPOSItems(e.target.value || ''));

    const loginPasswordToggle = document.getElementById('login-password-toggle');
    loginPasswordToggle?.addEventListener('click', () => {
        const inputId = loginPasswordToggle.getAttribute('data-target-input') || 'login-password';
        togglePasswordVisibility(inputId, loginPasswordToggle);
    });

    document.getElementById('school-excel-file')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        const info = document.getElementById('school-file-info');
        const name = document.getElementById('school-file-name');
        if (!file || !info || !name) return;
        name.textContent = file.name;
        info.classList.remove('hidden');
    });

    document.getElementById('bulk-student-file')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        const disp = document.getElementById('bulk-file-display');
        const name = document.getElementById('bulk-file-name');
        if (!file || !disp || !name) return;
        name.textContent = file.name;
        disp.classList.remove('hidden');
    });

    document.getElementById('stock-file-input')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        const disp = document.getElementById('stock-file-display');
        const name = document.getElementById('stock-file-name');
        if (!file || !disp || !name) return;
        name.textContent = file.name;
        disp.classList.remove('hidden');
    });

}

// ==================== STOCKS MANAGEMENT ====================

function uploadStocks() {
    const file = document.getElementById('stock-file-input')?.files?.[0];
    if (!file || !state.activeSchool?.id) {
        showToast('Select a file and ensure school is selected first.', 'error');
        return;
    }

    const btn = document.getElementById('btn-upload-stocks');
    if (btn) btn.disabled = true;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('school_id', state.activeSchool.id);

    fetch(`${API_BASE}/stocks/upload`, { method: 'POST', body: formData })
        .then(async res => {
            let data = {};
            try {
                data = await res.json();
            } catch (e) {
                data = {};
            }
            return { status: res.status, data };
        })
        .then(({ status, data }) => {
            if (btn) btn.disabled = false;
            
            if (status >= 200 && status < 300 && data.success) {
                showToast(data.message || `Successfully uploaded ${data.count || 0} stock records`);
                // Clear file input
                document.getElementById('stock-file-input').value = '';
                document.getElementById('stock-file-display').classList.add('hidden');
                // Reload stocks table
                loadStocks();
                return;
            }

            const prefix = status >= 400 ? 'Upload failed: ' : '';
            showToast(prefix + (data.error || data.message || 'Failed to upload stocks'), 'error');
        })
        .catch(err => {
            if (btn) btn.disabled = false;
            console.error('uploadStocks error', err);
            showToast('Connection error while uploading stocks', 'error');
        });
}

function loadStocks() {
    if (!state.activeSchool?.id) {
        return;
    }

    fetch(`${API_BASE}/stocks?school_id=${encodeURIComponent(state.activeSchool.id)}`)
        .then(res => res.json())
        .then(data => {
            if (data.success && Array.isArray(data.stocks)) {
                // Store stocks in state for later use
                state.stocks = data.stocks || [];
                renderStocksTable();
            } else {
                state.stocks = [];
                renderStocksTable();
            }
        })
        .catch(err => {
            console.error('loadStocks error', err);
            state.stocks = [];
            renderStocksTable();
        });
}

function getGroupedStockSummaryRows(stocks) {
    const grouped = new Map();
    (stocks || []).forEach((stock) => {
        const standard = String(stock.standard ?? '-').trim() || '-';
        const item = String(stock.item ?? '-').trim() || '-';
        const gender = String(stock.gender ?? '-').trim() || '-';
        const key = `${standard}__${item}__${gender}`;
        const qty = Number(stock.stock ?? 0) || 0;

        if (!grouped.has(key)) {
            grouped.set(key, { standard, item, gender, stock: 0 });
        }

        grouped.get(key).stock += qty;
    });

    return Array.from(grouped.values())
        .sort((a, b) => {
            const stdA = parseInt(a.standard, 10);
            const stdB = parseInt(b.standard, 10);
            if (!Number.isNaN(stdA) && !Number.isNaN(stdB) && stdA !== stdB) return stdA - stdB;
            const itemCmp = a.item.localeCompare(b.item);
            if (itemCmp !== 0) return itemCmp;
            return a.gender.localeCompare(b.gender);
        });
}

function downloadFallbackXls(sheetRows, fileName) {
    const htmlRows = sheetRows.map((row) => {
        const cells = row.map((cell) => `<td>${String(cell ?? '')}</td>`).join('');
        return `<tr>${cells}</tr>`;
    }).join('');

    const html = `
        <html>
            <head><meta charset="utf-8"></head>
            <body>
                <table>${htmlRows}</table>
            </body>
        </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = fileName.replace(/\.xlsx$/i, '.xls');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function buildAvailableStockSheetRows(rows) {
    let totalRemainingStock = 0;
    const sheetRows = [["Standard", "Item", "Gender", "Remaining Stock"]];

    rows.forEach((row) => {
        const qty = Number(row.stock ?? 0) || 0;
        totalRemainingStock += qty;
        sheetRows.push([
            String(row.standard || '-'),
            String(row.item || '-'),
            String(row.gender || '-'),
            qty,
        ]);
    });

    sheetRows.push([]);
    sheetRows.push(["TOTAL REMAINING STOCK", "", "", totalRemainingStock]);
    return { sheetRows, totalRemainingStock };
}

function fetchStocksForExport() {
    if (!state.activeSchool?.id) return Promise.resolve([]);

    return fetch(`${API_BASE}/stocks?school_id=${encodeURIComponent(state.activeSchool.id)}`)
        .then(res => res.json())
        .then(data => {
            if (data.success && Array.isArray(data.stocks)) {
                state.stocks = data.stocks;
                return data.stocks;
            }
            return state.stocks || [];
        })
        .catch(() => state.stocks || []);
}

function exportAvailableStockXls() {
    if (!state.activeSchool?.id) {
        showToast('Select a school first.', 'error');
        return;
    }

    fetchStocksForExport().then((stocks) => {
        const rows = getGroupedStockSummaryRows(stocks || []);
        if (!rows.length) {
            showToast('No stock data available to export.', 'error');
            return;
        }

        const { sheetRows, totalRemainingStock } = buildAvailableStockSheetRows(rows);
        const schoolName = String(state.activeSchool?.name || 'School').replace(/[^a-z0-9]+/gi, '_');
        const dateText = new Date().toISOString().slice(0, 10);
        const fileName = `${schoolName}_available_stock_${dateText}.xlsx`;

        if (typeof XLSX !== 'undefined') {
            const sheet = XLSX.utils.aoa_to_sheet(sheetRows);
            const book = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(book, sheet, 'Available Stock');
            XLSX.writeFile(book, fileName);
        } else {
            downloadFallbackXls(sheetRows, fileName);
        }

        showToast(`Available stock XLS exported. Total remaining stock: ${totalRemainingStock}`);
    }).catch((err) => {
        console.error('exportAvailableStockXls error', err);
        showToast('Failed to export stock file.', 'error');
    });
}

function renderStocksTable() {
    const table = document.getElementById('stocks-table')?.querySelector('tbody');
    const emptyMsg = document.getElementById('empty-stocks');
    
    if (!table || !emptyMsg) return;

    table.innerHTML = '';
    
    if (!state.stocks || state.stocks.length === 0) {
        emptyMsg.classList.remove('hidden');
        return;
    }

    emptyMsg.classList.add('hidden');

    const rows = getGroupedStockSummaryRows(state.stocks || []);

    rows.forEach((stock) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${stock.standard || '-'}</td>
            <td>${stock.item || '-'}</td>
            <td>${stock.gender || '-'}</td>
            <td>
                <span class="badge ${stock.stock > 10 ? 'badge-success' : stock.stock > 0 ? 'badge-warning' : 'badge-danger'}">
                    ${stock.stock ?? 0}
                </span>
            </td>
        `;
        table.appendChild(row);
    });
}

document.addEventListener('DOMContentLoaded', initApp);

window.exportAvailableStockXls = exportAvailableStockXls;
window.setPaymentMode = setPaymentMode;

