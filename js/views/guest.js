import * as dom from '../dom.js';
import { createBooking, deleteBooking } from '../services/booking.js'; // deleteBooking importiert
import { showMessage } from '../ui.js';
import { DEFAULT_PARKING_DURATION } from '../config.js';

let currentGuestBookingId = null; // Wir merken uns die ID der aktuellen Sitzung

export function initGuestView(hostData) {
    dom.guestHostName.textContent = hostData.hostName;
    
    // --- JETZT PARKEN BUTTON ---
    dom.guestParkNowBtn.addEventListener('click', async () => {
        const plate = dom.guestPlateInput.value.trim();
        if (!plate) {
            showMessage('guest-message', "Bitte gib dein Kennzeichen ein.", 'error');
            return;
        }

        // Einfaches Modal wäre schöner, aber confirm ist okay für den Anfang
        if(!confirm(`Jetzt Parkplatz für ca. ${DEFAULT_PARKING_DURATION} Stunden buchen?`)) return;

        dom.guestParkNowBtn.disabled = true;
        dom.guestParkNowBtn.textContent = "Buche...";

        const now = new Date();
        // Endzeit berechnen (+4 Stunden Standard)
        const end = new Date(now.getTime() + DEFAULT_PARKING_DURATION * 60 * 60 * 1000); 

        // Buchung anlegen
        const result = await createBooking(now.toISOString(), end.toISOString(), 'any', plate, 'guest-message');

        dom.guestParkNowBtn.disabled = false;
        dom.guestParkNowBtn.textContent = "JETZT PARKEN";

        if (result.success) {
            // Erfolg! Zeige das Ticket an
            currentGuestBookingId = result.bookingId; // ID speichern für Checkout
            showActiveTicket(result.spot, now);
        }
    });

    // --- CHECKOUT BUTTON (Ich fahre jetzt) ---
    dom.guestCheckoutBtn.addEventListener('click', async () => {
        if (!currentGuestBookingId) return;

        if (confirm("Parkplatz wirklich wieder freigeben?")) {
            const success = await deleteBooking(currentGuestBookingId);
            if (success) {
                alert("Gute Fahrt! Parkplatz ist wieder frei.");
                location.reload(); // Seite neu laden für nächsten Gast
            } else {
                alert("Fehler beim Freigeben.");
            }
        }
    });

    // --- RESERVIEREN BUTTON (Umschalter) ---
    dom.guestReserveBtn.addEventListener('click', () => {
        document.getElementById('bookingSection').style.display = 'block';
        document.getElementById('guestSection').style.display = 'none';
        
        document.getElementById('back-to-menu-btn-booking').style.display = 'none';
        
        const backBtn = document.createElement('button');
        backBtn.className = "back-button";
        backBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i> Zurück';
        backBtn.onclick = () => {
            document.getElementById('bookingSection').style.display = 'none';
            document.getElementById('guestSection').style.display = 'block';
            backBtn.remove();
            document.getElementById('back-to-menu-btn-booking').style.display = 'flex'; 
        };
        document.getElementById('bookingSection').prepend(backBtn);
    });
}

function showActiveTicket(spotId, startTime) {
    dom.guestActionContainer.style.display = 'none';
    dom.guestActiveTicket.style.display = 'block';
    
    // Zeige dem Gast WO er steht (P1 oder P2)
    dom.ticketSpotId.textContent = spotId; 
    dom.ticketStartTime.textContent = startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}