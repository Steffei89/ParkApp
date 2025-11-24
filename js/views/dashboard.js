import * as dom from '../dom.js';
import { createBooking, subscribeToMyBookings, deleteBooking, subscribeToStatus, subscribeToReservationsForDate } from '../services/booking.js';
import { createGuestLink } from '../services/invite.js';
import { showMessage, navigateTo } from '../ui.js';
import { getTodayDateString } from '../utils.js';
import { setUnsubscriber, getState } from '../state.js';

// Globale Variablen für den Buchungsstatus
let selectedDate = new Date(); // Datum-Objekt
let selectedTime = new Date(); // Zeit-Objekt (nur HH:MM relevant)
let durationMinutes = 120; // 2 Std Standard

export function initDashboardView() {
    // Buttons und Navigation
    document.getElementById('book-btn').addEventListener('click', () => {
        resetBookingForm(); // Alles auf Standard (Jetzt) setzen
        navigateTo(dom.bookingSection);
    });

    document.getElementById('invite-guest-btn').addEventListener('click', createGuestLink);
    document.getElementById('overview-btn').addEventListener('click', () => { initOverviewView(); navigateTo(dom.overviewSection); });
    document.getElementById('profile-btn').addEventListener('click', () => navigateTo(dom.profileSection));
    
    document.getElementById('back-to-menu-btn-booking').addEventListener('click', () => navigateTo(dom.mainMenu));
    document.getElementById('back-to-menu-btn-overview').addEventListener('click', () => navigateTo(dom.mainMenu));
    document.getElementById('back-to-menu-btn-profile').addEventListener('click', () => navigateTo(dom.mainMenu));

    setupSmartBookingUI();
}

function resetBookingForm() {
    // 1. Datum auf Heute
    selectedDate = new Date();
    updateDateTabsUI('today');

    // 2. Zeit auf Jetzt (gerundet auf nächste 5min)
    selectedTime = new Date();
    const coeff = 1000 * 60 * 5;
    selectedTime = new Date(Math.ceil(selectedTime.getTime() / coeff) * coeff);
    
    // 3. Dauer Standard 2h
    durationMinutes = 120;
    updateDurationUI();

    updateTimeDisplay();
}

function setupSmartBookingUI() {
    // --- 1. SPOT WAHL ---
    dom.spotCards.forEach(card => {
        card.addEventListener('click', () => {
            dom.spotCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            dom.bookingSpot.value = card.dataset.value;
        });
    });

    // --- 2. DATUM WAHL (Tabs) ---
    const tabToday = document.getElementById('date-tab-today');
    const tabTomorrow = document.getElementById('date-tab-tomorrow');
    const tabPicker = document.getElementById('date-tab-picker');
    const picker = dom.hiddenDatePicker;

    tabToday.onclick = () => {
        selectedDate = new Date();
        updateDateTabsUI('today');
        updateTimeDisplay(); // Endzeit neu berechnen
    };
    tabTomorrow.onclick = () => {
        selectedDate = new Date();
        selectedDate.setDate(selectedDate.getDate() + 1);
        updateDateTabsUI('tomorrow');
        updateTimeDisplay();
    };
    // Kalender Picker Logik
    tabPicker.onclick = () => picker.showPicker(); // Öffnet nativen Kalender
    picker.onchange = () => {
        if(picker.value) {
            selectedDate = new Date(picker.value);
            updateDateTabsUI('picker');
            updateTimeDisplay();
        }
    };

    // --- 3. ZEIT KONTROLLE (Das Herzstück!) ---
    
    // [JETZT] Button
    dom.btnSetNow.onclick = () => {
        selectedTime = new Date();
        updateTimeDisplay();
    };

    // Helfer für Zeit-Änderung
    const changeTime = (minutes) => {
        selectedTime.setMinutes(selectedTime.getMinutes() + minutes);
        updateTimeDisplay();
    };

    // [ - ] und [ + ] Buttons mit "Hold to Scroll" Logik
    setupHoldAction(dom.timeMinus, () => changeTime(-15));
    setupHoldAction(dom.timePlus, () => changeTime(15));


    // --- 4. DAUER WAHL ---
    dom.durationChips.forEach(chip => {
        chip.addEventListener('click', () => {
            durationMinutes = parseInt(chip.dataset.min);
            updateDurationUI();
            updateTimeDisplay();
        });
    });

    // --- 5. BUCHEN ---
    dom.bookSubmitBtn.addEventListener('click', async () => {
        // Wir bauen das Datum und die Startzeit zusammen
        const finalStart = new Date(selectedDate);
        finalStart.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);

        const finalEnd = new Date(finalStart.getTime() + durationMinutes * 60000);

        const startISO = finalStart.toISOString();
        const endISO = finalEnd.toISOString();
        const spot = dom.bookingSpot.value;
        const plate = dom.bookingPlate.value;

        dom.bookSubmitBtn.disabled = true;
        dom.bookSubmitBtn.textContent = "Buche...";

        const result = await createBooking(startISO, endISO, spot, plate);
        
        dom.bookSubmitBtn.disabled = false;
        dom.bookSubmitBtn.textContent = "FERTIG - BUCHEN";

        if (result.success) {
            navigateTo(dom.mainMenu);
        }
    });
}

// Logik für "Gedrückt halten" (Hold Action)
function setupHoldAction(button, action) {
    let interval;
    let timeout;

    const start = () => {
        action(); // Sofort einmal ausführen
        timeout = setTimeout(() => {
            interval = setInterval(() => {
                action(); // Dann schnell wiederholen
            }, 100); // Alle 100ms
        }, 400); // Nach 400ms Warten
    };

    const stop = () => {
        clearTimeout(timeout);
        clearInterval(interval);
    };

    // Touch und Maus Events abdecken
    button.addEventListener('mousedown', start);
    button.addEventListener('touchstart', (e) => { e.preventDefault(); start(); }); // preventDefault verhindert Geister-Klicks
    
    button.addEventListener('mouseup', stop);
    button.addEventListener('mouseleave', stop);
    button.addEventListener('touchend', stop);
}

// UI Helfer
function updateDateTabsUI(activeType) {
    dom.dateTabs.forEach(t => t.classList.remove('selected'));
    if(activeType === 'today') document.getElementById('date-tab-today').classList.add('selected');
    if(activeType === 'tomorrow') document.getElementById('date-tab-tomorrow').classList.add('selected');
    if(activeType === 'picker') document.getElementById('date-tab-picker').classList.add('selected');
}

function updateDurationUI() {
    dom.durationChips.forEach(c => {
        if(parseInt(c.dataset.min) === durationMinutes) c.classList.add('selected');
        else c.classList.remove('selected');
    });
}

function updateTimeDisplay() {
    // Startzeit Anzeige (HH:MM)
    const hh = String(selectedTime.getHours()).padStart(2, '0');
    const mm = String(selectedTime.getMinutes()).padStart(2, '0');
    dom.displayStartTime.textContent = `${hh}:${mm}`;

    // Endzeit berechnen (für Info Box)
    // Achtung: Hier müssen wir selectedDate + selectedTime kombinieren für korrekte Berechnung über Mitternacht
    const combinedStart = new Date(selectedDate);
    combinedStart.setHours(selectedTime.getHours(), selectedTime.getMinutes());
    
    const combinedEnd = new Date(combinedStart.getTime() + durationMinutes * 60000);
    const endHH = String(combinedEnd.getHours()).padStart(2, '0');
    const endMM = String(combinedEnd.getMinutes()).padStart(2, '0');
    
    dom.displayEndTime.textContent = `${endHH}:${endMM}`;
}


// --- RESTLICHE FUNKTIONEN (MyBookings, Status, Overview) bleiben unverändert ---

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
                <div><strong style="color:var(--primary)">${b.parkplatzId}</strong> <span style="font-weight:500">${dateStr}</span> <span class="small-text">${timeStr}</span><br><span class="small-text">${b.kennzeichen || 'Gast'}</span></div>
                <button class="button-small button-danger delete-btn" style="width:auto; padding:5px 10px;" data-id="${b.id}"><i class="fa-solid fa-trash"></i></button>
            `;
            div.querySelector('.delete-btn').addEventListener('click', async (e) => {
                if(confirm("Reservierung löschen?")) { await deleteBooking(e.target.closest('button').dataset.id); }
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

// Overview Code
export function initOverviewView() {
    const datePicker = dom.overviewDatePicker;
    const dateLabel = dom.overviewDateLabel;
    let currentDateObj = new Date();
    
    const updateDateDisplay = () => {
        const yyyy = currentDateObj.getFullYear();
        const mm = String(currentDateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(currentDateObj.getDate()).padStart(2, '0');
        const isoDate = `${yyyy}-${mm}-${dd}`;
        datePicker.value = isoDate;

        const today = new Date();
        const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
        const reset = d => d.setHours(0,0,0,0);
        const curTime = reset(new Date(currentDateObj));
        
        if (curTime === reset(today)) dateLabel.textContent = "Heute";
        else if (curTime === reset(tomorrow)) dateLabel.textContent = "Morgen";
        else if (curTime === reset(yesterday)) dateLabel.textContent = "Gestern";
        else dateLabel.textContent = currentDateObj.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
        
        loadData(isoDate);
    };

    const loadData = (dateStr) => {
        const unsub = subscribeToReservationsForDate(dateStr, (bookings) => renderTimeline(bookings, dateStr));
        setUnsubscriber('overview', unsub);
    };
    
    // Init Listener
    if(dom.prevDayBtn) dom.prevDayBtn.onclick = () => { currentDateObj.setDate(currentDateObj.getDate() - 1); updateDateDisplay(); };
    if(dom.nextDayBtn) dom.nextDayBtn.onclick = () => { currentDateObj.setDate(currentDateObj.getDate() + 1); updateDateDisplay(); };
    datePicker.onchange = () => { if(datePicker.value) { currentDateObj = new Date(datePicker.value); updateDateDisplay(); }};
    
    updateDateDisplay();
}

function renderTimeline(bookings, dateStr) {
    const containerP1 = dom.trackLanesP1;
    const containerP2 = dom.trackLanesP2;
    const detailsList = dom.bookingListDay;
    containerP1.innerHTML = ''; containerP2.innerHTML = ''; detailsList.innerHTML = '';
    const getMinutes = (dateObj) => dateObj.getHours() * 60 + dateObj.getMinutes();
    const { currentUser } = getState();

    bookings.forEach(b => {
        const start = new Date(b.startZeit);
        const end = new Date(b.endZeit);
        const dayStart = new Date(dateStr + "T00:00:00");
        const dayEnd = new Date(dateStr + "T23:59:59");
        let startMin = 0; let endMin = 1440; 
        if (start > dayStart) startMin = getMinutes(start);
        if (end < dayEnd) endMin = getMinutes(end);
        const widthPercent = ((endMin - startMin) / 1440) * 100;
        const leftPercent = (startMin / 1440) * 100;

        const el = document.createElement('div');
        el.className = 'timeline-block';
        el.style.left = `${leftPercent}%`;
        el.style.width = `${widthPercent}%`;
        
        if (currentUser && b.userId === currentUser.uid) el.classList.add('mine');
        else if (b.partei === 'Admin') el.classList.add('admin');
        else el.classList.add('others');

        el.addEventListener('click', () => {
            document.querySelectorAll('.timeline-block').forEach(x => x.style.opacity = '0.6');
            el.style.opacity = '1';
            const timeRange = `${start.toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'})} - ${end.toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'})}`;
            detailsList.innerHTML = `<div class="card" style="border-left: 5px solid var(--primary); animation: fadeIn 0.3s;"><strong>${b.partei}</strong> (${b.kennzeichen || 'Kein KZ'})<br><span class="small-text">${timeRange}</span><br><span class="small-text" style="color:var(--text-secondary)">${b.gastName || ''}</span></div>`;
        });
        if (b.parkplatzId === 'P1') containerP1.appendChild(el);
        if (b.parkplatzId === 'P2') containerP2.appendChild(el);
    });
    if (bookings.length === 0) detailsList.innerHTML = '<p class="text-center small-text">Alles frei.</p>';
}