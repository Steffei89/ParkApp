import * as dom from '../dom.js';
import { createBooking } from '../services/booking.js';
import { showMessage } from '../ui.js';
import { DEFAULT_PARKING_DURATION } from '../config.js';

export function initGuestView(hostData) {
    // Willkommenstext
    dom.guestHostName.textContent = hostData.hostName;
    
    // 1. "JETZT PARKEN" Button Logik
    dom.guestParkNowBtn.addEventListener('click', async () => {
        const plate = dom.guestPlateInput.value.trim();
        if (!plate) {
            alert("Bitte gib dein Kennzeichen ein.");
            return;
        }

        if(!confirm(`Jetzt Parkplatz für ca. ${DEFAULT_PARKING_DURATION} Stunden buchen?`)) return;

        dom.guestParkNowBtn.disabled = true;
        dom.guestParkNowBtn.textContent = "Buche...";

        const now = new Date();
        const end = new Date(now.getTime() + DEFAULT_PARKING_DURATION * 60 * 60 * 1000); // +4 Stunden

        // "any" = System sucht freien Platz
        const success = await createBooking(now.toISOString(), end.toISOString(), 'any', plate, 'guest-message');

        dom.guestParkNowBtn.disabled = false;
        dom.guestParkNowBtn.textContent = "JETZT PARKEN";

        if (success) {
            showActiveTicket(plate, now);
        }
    });

    // 2. "Reservieren" Button (Schaltet um zur normalen Buchungsmaske, aber vereinfacht)
    dom.guestReserveBtn.addEventListener('click', () => {
        // Wir nutzen die normale Buchungsmaske, passen sie aber für Gäste an
        document.getElementById('bookingSection').style.display = 'block';
        document.getElementById('guestSection').style.display = 'none';
        
        // Verstecke den "Zurück" Button, damit er nicht ins leere Menü kommt
        document.getElementById('back-to-menu-btn-booking').style.display = 'none';
        
        // "Fake" Zurück-Button zum Gast-Screen
        const backBtn = document.createElement('button');
        backBtn.className = "back-button";
        backBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i> Zurück';
        backBtn.onclick = () => {
            document.getElementById('bookingSection').style.display = 'none';
            document.getElementById('guestSection').style.display = 'block';
            backBtn.remove();
            document.getElementById('back-to-menu-btn-booking').style.display = 'flex'; // Reset
        };
        document.getElementById('bookingSection').prepend(backBtn);
    });
}

function showActiveTicket(plate, startTime) {
    dom.guestActionContainer.style.display = 'none';
    dom.guestActiveTicket.style.display = 'block';
    
    dom.ticketStartTime.textContent = startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    // Hier könnte man noch logik einbauen, welcher Platz es genau geworden ist
    // Fürs erste zeigen wir einfach "P1/P2" an oder den Erfolg.
}