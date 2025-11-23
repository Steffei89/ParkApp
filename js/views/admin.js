import { db, collection, getDocs, query, orderBy, deleteDoc, doc } from '../firebase.js';
import * as dom from '../dom.js';
import { navigateTo } from '../ui.js';

export function initAdminView() {
    document.getElementById('back-to-menu-btn-admin').addEventListener('click', () => navigateTo(dom.mainMenu));
    
    // Wenn Admin-Bereich geöffnet wird, Daten laden
    // (Hier könnte man noch einen Listener einbauen, der prüft ob "Details" geöffnet wird)
}

export async function loadAdminData() {
    // Nutzer laden
    const usersSnap = await getDocs(collection(db, "users"));
    let userHtml = '';
    usersSnap.forEach(doc => {
        const u = doc.data();
        userHtml += `<div class="user-list-item"><strong>${u.partei}</strong><br>${u.email}</div>`;
    });
    document.getElementById('admin-user-list').innerHTML = userHtml || 'Keine Nutzer.';

    // Buchungen laden
    const bookingsQ = query(collection(db, "bookings"), orderBy("startZeit", "desc"));
    const bookingsSnap = await getDocs(bookingsQ);
    let bookingHtml = '';
    bookingsSnap.forEach(docSnap => {
        const b = docSnap.data();
        const start = new Date(b.startZeit).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
        bookingHtml += `
            <div class="user-list-item" style="display:flex; justify-content:space-between;">
                <div><strong>${b.parkplatzId}</strong>: ${start}<br>${b.partei} (${b.kennzeichen || '?'})</div>
                <button class="button-small button-danger del-admin-btn" data-id="${docSnap.id}">Lösch</button>
            </div>`;
    });
    document.getElementById('admin-booking-list').innerHTML = bookingHtml || 'Keine Buchungen.';

    document.querySelectorAll('.del-admin-btn').forEach(btn => {
        btn.onclick = async (e) => {
            if(confirm("Löschen?")) {
                await deleteDoc(doc(db, "bookings", e.target.dataset.id));
                loadAdminData(); // Reload
            }
        };
    });
}