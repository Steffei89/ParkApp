import * as dom from '../dom.js';
import { createBooking, deleteBooking, subscribeToStatus } from '../services/booking.js';
import { showMessage } from '../ui.js';
import { DEFAULT_PARKING_DURATION } from '../config.js';

// Variablen für die Gast-Session
let currentGuestBookingId = null;
let selectedDate = new Date();
let selectedTime = new Date();
let durationMinutes = 120;
let cameraStream = null;
let isSmartBookingInit = false; 
let currentInputTarget = null; // HIER nur einmal definiert

export function initGuestView(hostData) {
    dom.guestHostName.textContent = hostData.hostName;
    
    // 1. Status überwachen (Ampel)
    const unsub = subscribeToStatus((status) => {
        updateGuestStatusUI('guest-status-p1', status.P1);
        updateGuestStatusUI('guest-status-p2', status.P2);
    });
    
    // 2. "Jetzt Parken" Button
    dom.guestParkNowBtn.addEventListener('click', handleParkNow);

    // 3. "Checkout" Button
    dom.guestCheckoutBtn.addEventListener('click', handleCheckout);

    // 4. "Reservieren" Button -> Öffnet Smart Booking
    dom.guestReserveBtn.addEventListener('click', () => {
        if(!isSmartBookingInit) setupGuestSmartBooking();
        resetBookingForm();
        
        // Hinweis: Platzhalter ändern
        if(dom.bookingPlate) dom.bookingPlate.placeholder = "Kennzeichen (Pflicht)";
        
        // Übernehmen, was vielleicht schon im ersten Feld stand
        if(dom.guestPlateInput.value.trim()) {
            dom.bookingPlate.value = dom.guestPlateInput.value.trim();
        }

        // Ansicht wechseln
        document.getElementById('bookingSection').style.display = 'block';
        document.getElementById('guestSection').style.display = 'none';
        
        // Back Button im Booking muss zurück zum Gast-Bereich führen
        const backBtn = document.getElementById('back-to-menu-btn-booking');
        const newBackBtn = backBtn.cloneNode(true);
        backBtn.parentNode.replaceChild(newBackBtn, backBtn);
        newBackBtn.addEventListener('click', () => {
            document.getElementById('bookingSection').style.display = 'none';
            document.getElementById('guestSection').style.display = 'block';
        });
    });

    // 5. Kamera Scanner für Gäste
    if(dom.guestScanBtn) {
        dom.guestScanBtn.addEventListener('click', () => startCamera('guest'));
    }
    
    // Globale Listener (Snap & Close)
    dom.closeCameraBtn.addEventListener('click', stopCamera);
    dom.snapBtn.addEventListener('click', takePictureAndScan);
}

// --- JETZT PARKEN (Startseite) ---
async function handleParkNow() {
    const plate = dom.guestPlateInput.value.trim();
    
    // VALIDIERUNG MIT ROTEM RAHMEN
    if (!plate) {
        showMessage('guest-message', "Bitte erst Kennzeichen eingeben.", 'error');
        
        // Roter Rahmen & Fokus Effekt
        dom.guestPlateInput.focus();
        dom.guestPlateInput.style.transition = "border 0.2s";
        dom.guestPlateInput.style.border = "2px solid var(--danger)";
        // Rahmen nach 2 Sekunden wieder entfernen
        setTimeout(() => dom.guestPlateInput.style.border = "none", 2000);
        return;
    }

    if(!confirm(`Jetzt Parkplatz für ca. ${DEFAULT_PARKING_DURATION} Stunden buchen?`)) return;

    dom.guestParkNowBtn.disabled = true;
    dom.guestParkNowBtn.textContent = "Buche...";

    const now = new Date();
    const end = new Date(now.getTime() + DEFAULT_PARKING_DURATION * 60 * 60 * 1000); 

    const result = await createBooking(now.toISOString(), end.toISOString(), 'any', plate, 'guest-message');

    dom.guestParkNowBtn.disabled = false;
    dom.guestParkNowBtn.textContent = "JETZT PARKEN";

    if (result.success) {
        currentGuestBookingId = result.bookingId;
        showActiveTicket(result.spot, now);
    }
}

async function handleCheckout() {
    if (!currentGuestBookingId) return;
    if (confirm("Parkplatz wieder freigeben?")) {
        const success = await deleteBooking(currentGuestBookingId);
        if (success) {
            alert("Gute Fahrt! Parkplatz ist frei.");
            location.reload(); 
        } else {
            alert("Fehler beim Freigeben.");
        }
    }
}

function showActiveTicket(spotId, startTime) {
    dom.guestActionContainer.style.display = 'none';
    dom.guestActiveTicket.style.display = 'block';
    dom.ticketSpotId.textContent = spotId; 
    dom.ticketStartTime.textContent = startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function updateGuestStatusUI(elementId, status) {
    const el = document.getElementById(elementId);
    const icon = el.querySelector('.status-icon');
    const text = el.querySelector('.status-text');
    
    // Reset classes
    el.className = 'status-card'; 
    
    if (status === 'busy') {
        el.classList.add('busy');
        icon.className = 'status-icon fa-solid fa-car-side';
        text.textContent = 'Belegt';
    } else {
        el.classList.add('free');
        icon.className = 'status-icon fa-solid fa-circle-check';
        text.textContent = 'Frei';
    }
}

// --- SMART BOOKING LOGIC (Reservieren) ---
function setupGuestSmartBooking() {
    isSmartBookingInit = true;
    
    dom.spotCards.forEach(card => {
        card.addEventListener('click', () => {
            dom.spotCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            dom.bookingSpot.value = card.dataset.value;
        });
    });

    const tabToday = document.getElementById('date-tab-today');
    const tabTomorrow = document.getElementById('date-tab-tomorrow');
    const tabPicker = document.getElementById('date-tab-picker');
    const picker = document.getElementById('hidden-date-picker');

    tabToday.onclick = () => { selectedDate = new Date(); updateDateTabsUI('today'); updateTimeDisplay(); };
    tabTomorrow.onclick = () => { selectedDate = new Date(); selectedDate.setDate(selectedDate.getDate() + 1); updateDateTabsUI('tomorrow'); updateTimeDisplay(); };
    tabPicker.onclick = () => picker.showPicker();
    picker.onchange = () => { if(picker.value) { selectedDate = new Date(picker.value); updateDateTabsUI('picker'); updateTimeDisplay(); } };

    document.getElementById('btn-set-now').onclick = () => { selectedTime = new Date(); updateTimeDisplay(); };
    const changeTime = (minutes) => { selectedTime.setMinutes(selectedTime.getMinutes() + minutes); updateTimeDisplay(); };
    setupHoldAction(document.getElementById('time-minus'), () => changeTime(-15));
    setupHoldAction(document.getElementById('time-plus'), () => changeTime(15));

    dom.durationChips.forEach(chip => {
        chip.addEventListener('click', () => {
            durationMinutes = parseInt(chip.dataset.min);
            updateDurationUI();
            updateTimeDisplay();
        });
    });

    // SUBMIT MIT VALIDIERUNG (ROTER RAHMEN)
    dom.bookSubmitBtn.addEventListener('click', async () => {
        const finalStart = new Date(selectedDate);
        finalStart.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
        const finalEnd = new Date(finalStart.getTime() + durationMinutes * 60000);
        
        // Wir prüfen hier das Feld, das der Nutzer gerade sieht (bookingPlate)
        const plate = dom.bookingPlate.value.trim(); 

        if (!plate) {
            showMessage('booking-error', 'Bitte Kennzeichen eingeben (Pflicht).', 'error');
            
            // Roter Rahmen & Fokus Effekt auch hier
            dom.bookingPlate.focus();
            dom.bookingPlate.style.transition = "border 0.2s";
            dom.bookingPlate.style.border = "2px solid var(--danger)";
            setTimeout(() => dom.bookingPlate.style.border = "none", 2000);
            return;
        }

        dom.bookSubmitBtn.disabled = true;
        dom.bookSubmitBtn.textContent = "Buche...";

        const result = await createBooking(finalStart.toISOString(), finalEnd.toISOString(), dom.bookingSpot.value, plate, 'booking-error');
        
        dom.bookSubmitBtn.disabled = false;
        dom.bookSubmitBtn.textContent = "FERTIG";

        if (result.success) {
            document.getElementById('bookingSection').style.display = 'none';
            document.getElementById('guestSection').style.display = 'block';
            currentGuestBookingId = result.bookingId;
            showActiveTicket(result.spot, finalStart);
        }
    });
    
    if(dom.scanPlateBtn) {
        dom.scanPlateBtn.addEventListener('click', () => startCamera('booking'));
    }
}

function resetBookingForm() {
    selectedDate = new Date();
    updateDateTabsUI('today');
    selectedTime = new Date();
    const coeff = 1000 * 60 * 5;
    selectedTime = new Date(Math.ceil(selectedTime.getTime() / coeff) * coeff);
    durationMinutes = 120;
    updateDurationUI();
    updateTimeDisplay();
}

// --- KAMERA LOGIK ---

async function startCamera(mode) {
    if(mode === 'guest') currentInputTarget = dom.guestPlateInput;
    else currentInputTarget = dom.bookingPlate;

    try {
        dom.cameraOverlay.classList.remove('hidden');
        dom.scanStatusText.textContent = "Kamera ausrichten...";
        cameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } 
        });
        dom.cameraVideo.srcObject = cameraStream;
    } catch (e) {
        console.error(e);
        alert("Kamera Fehler.");
        stopCamera();
    }
}

function stopCamera() {
    dom.cameraOverlay.classList.add('hidden');
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
}

function preprocessImage(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const val = gray < 100 ? 0 : 255;
        data[i] = data[i + 1] = data[i + 2] = val;
    }
    ctx.putImageData(imageData, 0, 0);
}

// PARSER (Wiederverwendet)
function parseLicensePlate(text) {
    const raw = text.toUpperCase().replace(/[^A-Z0-9\s]/g, '');
    let parts = raw.trim().split(/\s+/);
    
    if (parts.length < 2) {
        const merged = parts.join('');
        const firstNumIdx = merged.search(/\d/);
        if (firstNumIdx > 1) {
            const letters = merged.substring(0, firstNumIdx);
            const numbers = merged.substring(firstNumIdx);
            let city = letters; 
            let mid = "";
            if (letters.length > 3) {
                city = letters.substring(0, 3);
                mid = letters.substring(3);
            }
            if(mid) parts = [city, mid, numbers];
            else parts = [letters, numbers];
        }
    }

    // Helpers
    function fixChars(str, isNum) {
        if (!str) return "";
        let res = str;
        if (isNum) res = res.replace(/O/g, '0').replace(/D/g, '0').replace(/I/g, '1').replace(/L/g, '1').replace(/Z/g, '7').replace(/S/g, '5').replace(/B/g, '8').replace(/G/g, '6');
        else res = res.replace(/0/g, 'O').replace(/1/g, 'I').replace(/8/g, 'B').replace(/5/g, 'S').replace(/4/g, 'A');
        return res;
    }

    if(parts[0]) parts[0] = fixChars(parts[0], false);
    const lastIdx = parts.length - 1;
    if(parts[lastIdx]) parts[lastIdx] = fixChars(parts[lastIdx], true);
    if(parts.length === 3) parts[1] = fixChars(parts[1], false);

    if (parts.length >= 2) {
        return parts.join('-');
    }
    return null;
}

async function takePictureAndScan() {
    if (!cameraStream) return;
    dom.scanStatusText.textContent = "Analysiere...";
    dom.snapBtn.disabled = true;

    const video = dom.cameraVideo;
    const canvas = dom.cameraCanvas;
    
    const sWidth = video.videoWidth * 0.70;
    const sHeight = video.videoHeight * 0.12;
    const sx = (video.videoWidth - sWidth) / 2;
    const sy = (video.videoHeight * 0.45) - (sHeight / 2);

    canvas.width = sWidth * 2;
    canvas.height = sHeight * 2;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
    preprocessImage(canvas);

    try {
        const { createWorker } = Tesseract;
        const worker = await createWorker('deu');
        await worker.setParameters({ tessedit_pageseg_mode: '7', tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ' });
        const { data: { text } } = await worker.recognize(canvas);
        await worker.terminate();

        const result = parseLicensePlate(text);

        if (result && result.length >= 4) {
            if(currentInputTarget) currentInputTarget.value = result;
            stopCamera();
        } else {
             dom.scanStatusText.textContent = `Nicht erkannt. Nochmal!`;
        }
    } catch (e) {
        console.error(e);
    }
    dom.snapBtn.disabled = false;
}

function setupHoldAction(button, action) {
    let interval; let timeout;
    const start = () => { action(); timeout = setTimeout(() => { interval = setInterval(() => { action(); }, 100); }, 400); };
    const stop = () => { clearTimeout(timeout); clearInterval(interval); };
    button.addEventListener('mousedown', start); button.addEventListener('touchstart', (e) => { e.preventDefault(); start(); });
    button.addEventListener('mouseup', stop); button.addEventListener('mouseleave', stop); button.addEventListener('touchend', stop);
}

function updateDateTabsUI(activeType) {
    document.querySelectorAll('.date-tab').forEach(t => t.classList.remove('selected'));
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
    const hh = String(selectedTime.getHours()).padStart(2, '0');
    const mm = String(selectedTime.getMinutes()).padStart(2, '0');
    document.getElementById('display-start-time').textContent = `${hh}:${mm}`;
    const combinedStart = new Date(selectedDate);
    combinedStart.setHours(selectedTime.getHours(), selectedTime.getMinutes());
    const combinedEnd = new Date(combinedStart.getTime() + durationMinutes * 60000);
    const endHH = String(combinedEnd.getHours()).padStart(2, '0');
    const endMM = String(combinedEnd.getMinutes()).padStart(2, '0');
    document.getElementById('display-end-time').textContent = `${endHH}:${endMM}`;
}