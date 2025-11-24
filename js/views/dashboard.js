import * as dom from '../dom.js';
import { createBooking, subscribeToMyBookings, deleteBooking, subscribeToStatus, subscribeToReservationsForDate } from '../services/booking.js';
import { createGuestLink } from '../services/invite.js';
import { showMessage, navigateTo } from '../ui.js';
import { getTodayDateString, getCurrentTimeString } from '../utils.js';
import { setUnsubscriber, getState } from '../state.js';

export function initDashboardView() {
    // Navigation Buttons
    document.getElementById('book-btn').addEventListener('click', () => {
        dom.bookingDate.value = getTodayDateString();
        dom.bookingStart.value = getCurrentTimeString();
        navigateTo(dom.bookingSection);
    });

    document.getElementById('invite-guest-btn').addEventListener('click', createGuestLink);

    // Button zur Übersicht -> Initialisiert jetzt auch die Ansicht
    document.getElementById('overview-btn').addEventListener('click', () => {
        initOverviewView(); 
        navigateTo(dom.overviewSection);
    });

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

        const startObj = new Date(`${date}T${start}`);
        let endObj = new Date(`${date}T${end}`);

        if (endObj <= startObj) {
            endObj.setDate(endObj.getDate() + 1); 
        }

        const startISO = startObj.toISOString();
        const endISO = endObj.toISOString();

        dom.bookSubmitBtn.disabled = true;
        dom.bookSubmitBtn.textContent = "Buche...";

        const result = await createBooking(startISO, endISO, spot, plate);
        
        dom.bookSubmitBtn.disabled = false;
        dom.bookSubmitBtn.textContent = "Reservieren";

        if (result.success) {
            navigateTo(dom.mainMenu);
        }
    });
}

export function loadMyBookings() {
    const unsub = subscribeToMyBookings((bookings) => {
        dom.myBookingsList.innerHTML = '';
        
        if (bookings.length === 0) {
            dom.myBookingsList.innerHTML = '<p class="small-text text-center">Keine aktiven Reservierungen.</p>';
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
                    <strong style="color:var(--primary)">${b.parkplatzId}</strong> 
                    <span style="font-weight:500">${dateStr}</span> <span class="small-text">${timeStr}</span>
                    <br><span class="small-text">${b.kennzeichen || 'Gast'}</span>
                </div>
                <button class="button-small button-danger delete-btn" style="width:auto; padding:5px 10px;" data-id="${b.id}">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;
            
            div.querySelector('.delete-btn').addEventListener('click', async (e) => {
                if(confirm("Reservierung löschen?")) {
                    await deleteBooking(e.target.closest('button').dataset.id);
                }
            });

            dom.myBookingsList.appendChild(div);
        });
    });
    setUnsubscriber('myBookings', unsub);
}

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
        el.className = 'parking-spot-pill busy';
        icon.className = 'fa-solid fa-car-side status-icon'; 
    } else {
        el.className = 'parking-spot-pill free';
        icon.className = 'fa-solid fa-circle-check status-icon'; 
    }
}

// --- NEU: ÜBERSICHTS-LOGIK ---

export function initOverviewView() {
    const datePicker = dom.overviewDatePicker;
    
    // Default auf Heute setzen, wenn leer
    if (!datePicker.value) {
        datePicker.value = getTodayDateString();
    }

    // Funktion zum Laden der Daten
    const loadData = () => {
        const dateStr = datePicker.value;
        const unsub = subscribeToReservationsForDate(dateStr, (bookings) => {
            renderTimeline(bookings, dateStr);
        });
        setUnsubscriber('overview', unsub);
    };

    // Erster Load
    loadData();

    // Bei Änderung des Datums neu laden
    datePicker.onchange = loadData;
}

function renderTimeline(bookings, dateStr) {
    const containerP1 = dom.trackLanesP1;
    const containerP2 = dom.trackLanesP2;
    const detailsList = dom.bookingListDay;

    // Alles leeren
    containerP1.innerHTML = '';
    containerP2.innerHTML = '';
    detailsList.innerHTML = '';

    // Hilfsfunktion: Minuten seit 00:00 Uhr
    const getMinutes = (dateObj) => dateObj.getHours() * 60 + dateObj.getMinutes();
    const { currentUser } = getState();

    bookings.forEach(b => {
        const start = new Date(b.startZeit);
        const end = new Date(b.endZeit);
        
        // Wir müssen prüfen, ob die Buchung am gewählten Tag sichtbar ist
        // Startet sie heute? Oder läuft sie von gestern rein?
        const dayStart = new Date(dateStr + "T00:00:00");
        const dayEnd = new Date(dateStr + "T23:59:59");

        // Berechne Start- und End-Minuten relativ zum Tag (0 - 1440)
        let startMin = 0;
        let endMin = 1440; // 24h * 60

        if (start > dayStart) startMin = getMinutes(start);
        if (end < dayEnd) endMin = getMinutes(end);

        // Breite und Position in Prozent
        const totalMinutes = 1440;
        const leftPercent = (startMin / totalMinutes) * 100;
        const widthPercent = ((endMin - startMin) / totalMinutes) * 100;

        // Element bauen
        const el = document.createElement('div');
        el.className = 'timeline-block';
        el.style.left = `${leftPercent}%`;
        el.style.width = `${widthPercent}%`;
        
        // Farben: Meins = Grün, Admin = Rot, Andere = Blau
        if (currentUser && b.userId === currentUser.uid) {
            el.classList.add('mine');
        } else if (b.partei === 'Admin') {
            el.classList.add('admin');
        } else {
            el.classList.add('others');
        }

        // Klick Event für Details
        el.addEventListener('click', () => {
            // Highlight entfernen von anderen
            document.querySelectorAll('.timeline-block').forEach(x => x.style.opacity = '0.6');
            el.style.opacity = '1';

            // Details unten anzeigen
            const timeRange = `${start.toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'})} - ${end.toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'})}`;
            detailsList.innerHTML = `
                <div class="card" style="border-left: 5px solid var(--primary); animation: fadeIn 0.3s;">
                    <strong>${b.partei}</strong> (${b.kennzeichen || 'Kein KZ'})<br>
                    <span class="small-text">${timeRange}</span><br>
                    <span class="small-text" style="color:var(--text-secondary)">${b.gastName || ''}</span>
                </div>
            `;
        });

        // Hinzufügen zum richtigen Track
        if (b.parkplatzId === 'P1') containerP1.appendChild(el);
        if (b.parkplatzId === 'P2') containerP2.appendChild(el);
    });

    if (bookings.length === 0) {
        detailsList.innerHTML = '<p class="text-center small-text">Alles frei für heute.</p>';
    }
}