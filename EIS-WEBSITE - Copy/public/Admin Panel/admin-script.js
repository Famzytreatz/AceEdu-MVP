// Admin panel browser-side helpers. Server routes belong in server.js, not this file.

async function readJsonResponse(response) {
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(result.message || `Request failed (${response.status})`);
    }
    return result;
}

async function enrollUser() {
    const fullName = document.getElementById('userName')?.value.trim();
    const role = document.getElementById('roleSelect')?.value;
    const designation = document.getElementById('userDesignation')?.value.trim();
    const passport = document.getElementById('passportBase64')?.value || '';

    if (!fullName || !role) {
        alert('Enter the user name and select a role.');
        return;
    }

    try {
        const response = await fetch('/api/admin/enroll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName, role, designation, passport })
        });
        const result = await readJsonResponse(response);

        if (!result.success) {
            throw new Error(result.message || 'Enrollment was not completed.');
        }

        alert(result.pin ? `Identity installed. Access PIN: ${result.pin}` : 'Identity installed.');
        await loadRegistry();
    } catch (error) {
        console.error('Enrollment failed:', error);
        alert(error.message || 'Enrollment failed. Please try again.');
    }
}

async function transmitBroadcast(type) {
    const input = document.getElementById('broadcastInput');
    const message = input?.value.trim();
    if (!message) {
        alert('Enter a message before sending.');
        return;
    }

    try {
        const response = await fetch('/api/admin/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, message })
        });
        const result = await readJsonResponse(response);
        if (!result.success) throw new Error(result.message || 'Broadcast was not updated.');
        alert(`Global ${type} updated across portals.`);
    } catch (error) {
        console.error('Broadcast failed:', error);
        alert(error.message || 'Broadcast failed. Please try again.');
    }
}

function previewPassport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        alert('Choose an image file for the photo.');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        const encoded = document.getElementById('passportBase64');
        const preview = document.getElementById('photoPreview');
        if (encoded) encoded.value = reader.result;
        if (preview) preview.src = reader.result;
    };
    reader.onerror = () => alert('The selected photo could not be read.');
    reader.readAsDataURL(file);
}

function createCell(value, className) {
    const cell = document.createElement('td');
    if (className) cell.className = className;
    cell.textContent = value == null || value === '' ? '—' : String(value);
    return cell;
}

async function loadRegistry() {
    const tbody = document.getElementById('registryBody');
    if (!tbody) return;

    try {
        const response = await fetch('/api/admin/users');
        const users = await readJsonResponse(response);
        if (!Array.isArray(users)) throw new Error('The registry response was not valid.');

        tbody.replaceChildren();
        if (users.length === 0) {
            const row = document.createElement('tr');
            const cell = createCell('No records yet.');
            cell.colSpan = 6;
            row.append(cell);
            tbody.append(row);
            return;
        }

        users.forEach((user) => {
            const row = document.createElement('tr');
            const photoCell = document.createElement('td');
            const photo = document.createElement('img');
            photo.src = user.passport || 'https://via.placeholder.com/40';
            photo.alt = user.fullName ? `${user.fullName} photo` : 'User photo';
            photo.className = 'table-img';
            photoCell.append(photo);

            const nameCell = createCell(user.fullName);
            nameCell.style.fontWeight = '700';
            const roleCell = document.createElement('td');
            const roleBadge = document.createElement('span');
            roleBadge.className = 'role-badge';
            roleBadge.textContent = user.role || '—';
            roleCell.append(roleBadge);

            row.append(
                photoCell,
                nameCell,
                roleCell,
                createCell(user.designation),
                createCell(user.accessPin, 'pin-code'),
                createCell(user.status || 'Active')
            );
            tbody.append(row);
        });
    } catch (error) {
        console.error('Registry load failed:', error);
        tbody.replaceChildren();
        const row = document.createElement('tr');
        const cell = createCell('Could not load records. Please refresh and try again.');
        cell.colSpan = 6;
        row.append(cell);
        tbody.append(row);
    }
}

// Kept as an alias for any existing markup that calls the earlier function name.
function loadUserRegistry() {
    return loadRegistry();
}

function filterRegistry() {
    const input = document.getElementById('registrySearch');
    const tbody = document.getElementById('registryBody');
    if (!input || !tbody) return;

    const query = input.value.trim().toLocaleUpperCase();
    Array.from(tbody.rows).forEach((row) => {
        const name = row.cells[1]?.textContent?.toLocaleUpperCase() || '';
        const pin = row.cells[4]?.textContent?.toLocaleUpperCase() || '';
        row.hidden = !(name.includes(query) || pin.includes(query));
    });
}

function printAdminCard() {
    window.print();
}

document.addEventListener('DOMContentLoaded', loadRegistry);
