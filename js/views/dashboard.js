import * as dom from '../dom.js';
import { createBooking, subscribeToMyBookings, deleteBooking, subscribeToStatus } from '../services/booking.js';
import { showMessage, navigateTo } from '../ui.js';
import { getTodayDateString, getCurrentTimeString } from '../utils.js';
import { setUnsubscriber } from '../state.js';

export function initDashboardView() {
    // Navigation Buttons
    document.getElementById('book-btn').addEventListener('click', () => {
        dom.bookingDate.value = getTodayDateString();
        dom.bookingStart.value = getCurrentTimeString();
        navigateTo(dom.bookingSection);
    });

    document.getElementById('overview-btn').addEventListener('click', () => navigateTo(dom.overviewSection));
    document.getElementById('profile-btn').addEventListener('click', () => navigateTo(dom.profileSection));

    // Zurück Buttons
    document.getElementById('back-to-menu-btn-booking').addEventListener('click', () => navigateTo(dom.mainMenu));
    document.getElementById('back-to-menu-btn-overview').addEventListener('click', () => navigateTo(dom.mainMenu));
    document.getElementById('back-to-menu-btn-profile').addEventListener('click', () => navigateTo(dom.mainMenu));

    // Buchung absenden
    dom.bookSubmitBtn.addEventListener('click', async () => {
        const date = dom.bookingDate.value;
        const start = dom.bookingStart.value;
        const end = dom.bookingEnd.value;
        const spot = dom.bookingSpot.value;
        const plate = dom.bookingPlate.value;

        if (!date || !start || !end) {
            showMessage('booking-error', 'Bitte Zeitangaben ausfüllen.');
            return;
        }

        // Datum Logik bauen
        const startObj = new Date(`${date}T${start}`);
        let endObj = new Date(`${date}T${end}`);

        // LOGIK FIX: Mitternachts-Überquerung
        // Wenn Ende VOR Start liegt (z.B. Start 23:00, Ende 01:00),
        // gehen wir davon aus, dass der nächste Tag gemeint ist.
        if (endObj <= startObj) {
            endObj.setDate(endObj.getDate() + 1); // +1 Tag
        }

        // ISO-Strings für die Datenbank
        const startISO = startObj.toISOString();
        const endISO = endObj.toISOString();

        dom.bookSubmitBtn.disabled = true;
        dom.bookSubmitBtn.textContent = "Buche...";

        // Aufruf der verbesserten Funktion
        const result = await createBooking(startISO, endISO, spot, plate);
        
        dom.bookSubmitBtn.disabled = false;
        dom.bookSubmitBtn.textContent = "Reservieren";

        if (result.success) {
            // Bei Erfolg zurück zum Menü
            navigateTo(dom.mainMenu);
        }
    });
}

// Lädt die Liste "Meine Reservierungen"
export function loadMyBookings() {
    const unsub = subscribeToMyBookings((bookings) => {
        dom.myBookingsList.innerHTML = '';
        
        if (bookings.length === 0) {
            dom.myBookingsList.innerHTML = '<p class="small-text">Keine aktiven Reservierungen.</p>';
            return;
        }

        bookings.forEach(b => {
            const start = new Date(b.startZeit);
            const end = new Date(b.endZeit);
            
            const dateStr = start.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
            const timeStr = `${start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - ${end.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;

            const div = document.createElement('div');
            div.className = 'booking-item';
            div.innerHTML = `
                <div>
                    <strong style="color:var(--primary-color)">${b.parkplatzId}</strong> 
                    <span style="font-weight:500">${dateStr}</span> <span class="small-text">${timeStr}</span>
                    <br><span class="small-text">${b.kennzeichen || 'Gast'}</span>
                </div>
                <button class="button-small button-danger delete-btn" data-id="${b.id}">X</button>
            `;
            
            div.querySelector('.delete-btn').addEventListener('click', async (e) => {
                if(confirm("Reservierung wirklich löschen?")) {
                    await deleteBooking(e.target.dataset.id);
                }
            });

            dom.myBookingsList.appendChild(div);
        });
    });
    
    setUnsubscriber('myBookings', unsub);
}

// Ampel
export function initStatusWidget() {
    const unsub = subscribeToStatus((status) => {
        updateSpotUI('status-p1', status.P1);
        updateSpotUI('status-p2', status.P2);
    });
    setUnsubscriber('statusWidget', unsub);
}

function updateSpotUI(elementId, status) {
    const el = document.getElementById(elementId);
    const icon = el.querySelector('.status-icon');
    if (status === 'busy') {
        el.className = 'parking-spot-indicator busy';
        icon.className = 'fa-solid fa-car-side status-icon'; 
    } else {
        el.className = 'parking-spot-indicator free';
        icon.className = 'fa-solid fa-circle-check status-icon'; 
    }
}