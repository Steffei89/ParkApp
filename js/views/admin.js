import { db, collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc, where } from '../firebase.js';
import * as dom from '../dom.js';
import { navigateTo } from '../ui.js';

export function initAdminView() {
    document.getElementById('back-to-menu-btn-admin').addEventListener('click', () => navigateTo(dom.mainMenu));
    
    // Tabs Logik
    dom.adminTabUsers.onclick = () => switchAdminTab('users');
    dom.adminTabBookings.onclick = () => switchAdminTab('bookings');
}

function switchAdminTab(tab) {
    if (tab === 'users') {
        dom.adminTabUsers.classList.add('active');
        dom.adminTabBookings.classList.remove('active');
        dom.adminViewUsers.style.display = 'block';
        dom.adminViewBookings.style.display = 'none';
    } else {
        dom.adminTabUsers.classList.remove('active');
        dom.adminTabBookings.classList.add('active');
        dom.adminViewUsers.style.display = 'none';
        dom.adminViewBookings.style.display = 'block';
    }
}

export async function loadAdminData() {
    // 1. Daten laden
    const usersSnap = await getDocs(collection(db, "users"));
    const bookingsQ = query(collection(db, "bookings"), orderBy("startZeit", "desc"));
    const bookingsSnap = await getDocs(bookingsQ);

    const users = [];
    usersSnap.forEach(d => users.push({id: d.id, ...d.data()}));
    
    const bookings = [];
    bookingsSnap.forEach(d => bookings.push({id: d.id, ...d.data()}));

    // 2. Statistiken berechnen & Rendern
    renderStats(users, bookings);
    renderTopList(bookings); // NEU

    // 3. Listen rendern
    renderUsersList(users);
    renderBookingsList(bookings);
}

function renderStats(users, bookings) {
    dom.statUsers.textContent = users.length;
    const now = new Date().toISOString();
    const active = bookings.filter(b => b.endZeit > now).length;
    dom.statBookings.textContent = active;
    const p1Count = bookings.filter(b => b.parkplatzId === 'P1').length;
    const p2Count = bookings.filter(b => b.parkplatzId === 'P2').length;
    dom.statTopSpot.textContent = p1Count >= p2Count ? 'P1' : 'P2';
}

function renderTopList(bookings) {
    const counts = {};
    bookings.forEach(b => {
        // Partei oder "Gast" zählen
        const name = b.partei || 'Unbekannt';
        counts[name] = (counts[name] || 0) + 1;
    });

    // Sortieren (Höchste zuerst) und Top 3 nehmen
    const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

    let html = '';
    const medals = ['🥇', '🥈', '🥉'];

    sorted.forEach((item, index) => {
        const name = item[0];
        const count = item[1];
        html += `
            <div class="top-list-item">
                <div class="top-rank">${medals[index] || (index + 1) + '.'}</div>
                <div class="top-name">${name}</div>
                <div class="top-count">${count} Buchungen</div>
            </div>
        `;
    });

    dom.adminTopList.innerHTML = html || '<p class="small-text text-center" style="padding:10px;">Keine Daten.</p>';
}

function renderUsersList(users) {
    let html = '';
    users.forEach(u => {
        const isBlocked = u.isBlocked === true;
        const blockClass = isBlocked ? 'blocked' : '';
        const blockIcon = isBlocked ? 'fa-lock' : 'fa-lock-open';
        
        html += `
            <div class="user-list-item">
                <div class="user-info">
                    <h4>${u.partei}</h4>
                    <p>${u.email}</p>
                    ${isBlocked ? '<small style="color:var(--danger)">GESPERRT</small>' : ''}
                </div>
                <div class="user-actions">
                    <button class="action-btn-icon btn-block ${blockClass}" onclick="toggleBlockUser('${u.id}', ${!isBlocked})">
                        <i class="fa-solid ${blockIcon}"></i>
                    </button>
                    <button class="action-btn-icon btn-delete" onclick="deleteUserEntry('${u.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
    dom.adminUserList.innerHTML = html || '<p class="text-center small-text">Keine Nutzer.</p>';

    window.toggleBlockUser = async (uid, blockStatus) => {
        if(confirm(blockStatus ? "Nutzer sperren?" : "Nutzer entsperren?")) {
            await updateDoc(doc(db, "users", uid), { isBlocked: blockStatus });
            loadAdminData(); 
        }
    };
    window.deleteUserEntry = async (uid) => {
        if(confirm("Nutzerprofil wirklich löschen?")) {
            await deleteDoc(doc(db, "users", uid));
            loadAdminData();
        }
    };
}

function renderBookingsList(bookings) {
    let html = '';
    bookings.forEach(b => {
        const start = new Date(b.startZeit).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
        html += `
            <div class="booking-item" style="background:var(--input-bg); border:none;">
                <div>
                    <strong>${b.parkplatzId}</strong>: ${start}<br>
                    <span class="small-text">${b.partei} (${b.kennzeichen || '?'})</span>
                </div>
                <button class="action-btn-icon btn-delete" onclick="deleteBookingAdmin('${b.id}')">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>`;
    });
    dom.adminBookingList.innerHTML = html || '<p class="text-center small-text">Keine Buchungen.</p>';

    window.deleteBookingAdmin = async (bid) => {
        if(confirm("Buchung löschen?")) {
            await deleteDoc(doc(db, "bookings", bid));
            loadAdminData();
        }
    };
}