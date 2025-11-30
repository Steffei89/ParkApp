// js/views/dashboard.js
import * as dom from '../dom.js';
import { createBooking, subscribeToMyBookings, deleteBooking, subscribeToStatus, subscribeToReservationsForDate } from '../services/booking.js';
import { createGuestLink } from '../services/invite.js';
import { showMessage, navigateTo } from '../ui.js';
import { validateLicensePlate } from '../utils.js';
import { setUnsubscriber, getState } from '../state.js';

let selectedDate = new Date();
let selectedTime = new Date();
let durationMinutes = 120;
let cameraStream = null;
let scanningActive = false;
let lastValidPlate = ""; 
let scanBuffer = []; // Puffer für Ergebnisse

export function initDashboardView() {
    document.getElementById('book-btn').addEventListener('click', () => { resetBookingForm(); navigateTo(dom.bookingSection); });
    if(dom.inviteWhatsappBtn) dom.inviteWhatsappBtn.addEventListener('click', () => createGuestLink('whatsapp'));
    if(dom.inviteCopyBtn) dom.inviteCopyBtn.addEventListener('click', () => createGuestLink('copy'));
    document.getElementById('overview-btn').addEventListener('click', () => { initOverviewView(); navigateTo(dom.overviewSection); });
    document.getElementById('profile-btn').addEventListener('click', () => navigateTo(dom.profileSection));
    document.getElementById('back-to-menu-btn-booking').addEventListener('click', () => navigateTo(dom.mainMenu));
    document.getElementById('back-to-menu-btn-overview').addEventListener('click', () => navigateTo(dom.mainMenu));
    document.getElementById('back-to-menu-btn-profile').addEventListener('click', () => navigateTo(dom.mainMenu));

    setupSmartBookingUI();
    setupCameraUI();
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

function setupSmartBookingUI() {
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
    const picker = dom.hiddenDatePicker;
    tabToday.onclick = () => { selectedDate = new Date(); updateDateTabsUI('today'); updateTimeDisplay(); };
    tabTomorrow.onclick = () => { selectedDate = new Date(); selectedDate.setDate(selectedDate.getDate() + 1); updateDateTabsUI('tomorrow'); updateTimeDisplay(); };
    tabPicker.onclick = () => picker.showPicker();
    picker.onchange = () => { if(picker.value) { selectedDate = new Date(picker.value); updateDateTabsUI('picker'); updateTimeDisplay(); } };
    dom.btnSetNow.onclick = () => { selectedTime = new Date(); updateTimeDisplay(); };
    const changeTime = (minutes) => { selectedTime.setMinutes(selectedTime.getMinutes() + minutes); updateTimeDisplay(); };
    setupHoldAction(dom.timeMinus, () => changeTime(-15));
    setupHoldAction(dom.timePlus, () => changeTime(15));
    dom.durationChips.forEach(chip => {
        chip.addEventListener('click', () => {
            durationMinutes = parseInt(chip.dataset.min);
            updateDurationUI();
            updateTimeDisplay();
        });
    });
    dom.bookSubmitBtn.addEventListener('click', async () => {
        const finalStart = new Date(selectedDate);
        finalStart.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
        const finalEnd = new Date(finalStart.getTime() + durationMinutes * 60000);
        if (finalEnd <= finalStart) { showMessage('booking-error', 'Endzeit ungültig.'); return; }
        const startISO = finalStart.toISOString();
        const endISO = finalEnd.toISOString();
        const spot = dom.bookingSpot.value;
        const plate = dom.bookingPlate.value;
        dom.bookSubmitBtn.disabled = true; dom.bookSubmitBtn.textContent = "Buche...";
        const result = await createBooking(startISO, endISO, spot, plate);
        dom.bookSubmitBtn.disabled = false; dom.bookSubmitBtn.textContent = "FERTIG - BUCHEN";
        if (result.success) navigateTo(dom.mainMenu);
    });
}

// --- KAMERA LOGIK ---
function setupCameraUI() {
    dom.scanPlateBtn.addEventListener('click', startCamera);
    dom.closeCameraBtn.addEventListener('click', stopCamera);
    dom.snapBtn.addEventListener('click', manualSnap); 
}

function manualSnap() {
    // Wenn wir einen "Last Valid Plate" haben, nehmen wir das
    if (lastValidPlate) {
        dom.bookingPlate.value = lastValidPlate;
        stopCamera();
    } 
    // Wenn nicht, schauen wir, was gerade im Textfeld steht (auch wenn noch nicht bestätigt)
    else if (dom.scanOverlayText.textContent && dom.scanOverlayText.textContent !== "Suche...") {
        const rawText = dom.scanOverlayText.textContent.replace('?', '');
        if(rawText.length >= 3) {
            dom.bookingPlate.value = rawText;
            stopCamera();
        } else {
            showErrorShake();
        }
    } else {
        showErrorShake();
    }
}

function showErrorShake() {
    const txt = dom.scanStatusText.textContent;
    dom.scanStatusText.textContent = "Nichts erkannt!";
    dom.scanStatusText.style.color = "#ff6b6b";
    setTimeout(() => { dom.scanStatusText.textContent = txt; dom.scanStatusText.style.color = "white"; }, 1000);
}

async function startCamera() {
    try {
        dom.cameraOverlay.classList.remove('hidden');
        dom.scanStatusText.textContent = "Kamera startet...";
        dom.scanOverlayText.textContent = "";
        dom.scanOverlayText.classList.remove('valid');
        lastValidPlate = "";
        scanBuffer = [];

        cameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
        dom.cameraVideo.srcObject = cameraStream;
        dom.cameraVideo.onloadedmetadata = () => dom.cameraVideo.play();
        
        scanningActive = true;
        startScanningLoop();
    } catch (e) {
        console.error(e);
        alert("Kamera Fehler: " + e.message);
        stopCamera();
    }
}

function stopCamera() {
    scanningActive = false;
    dom.cameraOverlay.classList.add('hidden');
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
}

async function startScanningLoop() {
    const { createWorker } = Tesseract;
    // 'eng' lädt schneller und reicht für Blockbuchstaben oft aus. 'deu' ist optional.
    const worker = await createWorker('eng'); 
    
    await worker.setParameters({ 
        tessedit_pageseg_mode: '7', // Single Line Modus
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ0123456789' 
    });

    const canvas = dom.cameraCanvas;
    const ctx = canvas.getContext('2d');
    const video = dom.cameraVideo;

    const scanFrame = async () => {
        if (!scanningActive) { await worker.terminate(); return; }

        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            // Crop Mitte
            const sWidth = video.videoWidth * 0.7;
            const sHeight = video.videoHeight * 0.15;
            const sx = (video.videoWidth - sWidth) / 2;
            const sy = (video.videoHeight * 0.45) - (sHeight / 2);

            canvas.width = sWidth;
            canvas.height = sHeight;
            ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
            
            preprocessImage(canvas); // Bild verbessern

            try {
                const { data: { text, confidence } } = await worker.recognize(canvas);
                
                // Wir zeigen JETZT IMMER an, was er liest, auch wenn er unsicher ist
                const check = validateLicensePlate(text);
                const raw = text.replace(/[^A-Z0-9]/g, '');

                if (check.valid && confidence > 40) { // Toleranz erhöht (niedrigere Confidence)
                    // Voting Logic
                    scanBuffer.push(check.formatted);
                    if (scanBuffer.length > 5) scanBuffer.shift();

                    const counts = {};
                    let maxCount = 0; 
                    let winner = null;
                    scanBuffer.forEach(p => {
                        counts[p] = (counts[p] || 0) + 1;
                        if(counts[p] > maxCount) { maxCount = counts[p]; winner = p; }
                    });

                    // Wenn 2x bestätigt -> Valid
                    if (maxCount >= 2) {
                        dom.scanOverlayText.textContent = winner;
                        dom.scanOverlayText.classList.add('valid');
                        dom.scanStatusText.textContent = "Gefunden! Auslöser drücken.";
                        lastValidPlate = winner;
                    }
                } else {
                    // Feedback: Zeige was er sieht (in Weiß)
                    if (raw.length > 1) {
                        dom.scanOverlayText.classList.remove('valid');
                        dom.scanOverlayText.textContent = raw + "?";
                    } else {
                         dom.scanOverlayText.textContent = "Suche...";
                    }
                }
            } catch (e) {
                console.log(e);
            }
        }
        if (scanningActive) requestAnimationFrame(scanFrame);
    };
    requestAnimationFrame(scanFrame);
}

// Verbesserte Bildverarbeitung: Nur Graustufen + Kontrast (kein hartes Schwarz-Weiß)
function preprocessImage(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Kontrast erhöhen & Graustufen
    for (let i = 0; i < data.length; i += 4) {
        // Einfache Graustufe
        let gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
        
        // Leichter Kontrast-Boost: Dunkles dunkler, Helles heller
        // Aber nicht komplett binär (0 oder 255), das war das Problem.
        if (gray < 80) gray = gray * 0.5;
        else if (gray > 150) gray = Math.min(255, gray * 1.2);
        
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
    }
    ctx.putImageData(imageData, 0, 0);
}

// UI Helpers (unverändert)
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
export function loadMyBookings() {
    const unsub = subscribeToMyBookings((bookings) => {
        dom.myBookingsList.innerHTML = '';
        if (bookings.length === 0) { dom.myBookingsList.innerHTML = '<p class="small-text text-center">Keine aktiven Reservierungen.</p>'; return; }
        bookings.forEach(b => {
            const start = new Date(b.startZeit);
            const end = new Date(b.endZeit);
            const dateStr = start.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
            const timeStr = `${start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - ${end.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
            const div = document.createElement('div');
            div.className = 'booking-item';
            div.innerHTML = `<div><strong style="color:var(--primary)">${b.parkplatzId}</strong> <span style="font-weight:500">${dateStr}</span> <span class="small-text">${timeStr}</span><br><span class="small-text">${b.kennzeichen || 'Gast'}</span></div><button class="button-small button-danger delete-btn" style="width:auto; padding:5px 10px;" data-id="${b.id}"><i class="fa-solid fa-trash"></i></button>`;
            div.querySelector('.delete-btn').addEventListener('click', async (e) => { if(confirm("Reservierung löschen?")) { await deleteBooking(e.target.closest('button').dataset.id); } });
            dom.myBookingsList.appendChild(div);
        });
    });
    setUnsubscriber('myBookings', unsub);
}
export function initStatusWidget() {
    const unsub = subscribeToStatus((status) => { updateSpotUI('status-p1', status.P1); updateSpotUI('status-p2', status.P2); });
    setUnsubscriber('statusWidget', unsub);
}
function updateSpotUI(elementId, status) {
    const el = document.getElementById(elementId);
    const icon = el.querySelector('.status-icon');
    if (status === 'busy') { el.className = 'parking-spot-pill busy'; icon.className = 'fa-solid fa-car-side status-icon'; }
    else { el.className = 'parking-spot-pill free'; icon.className = 'fa-solid fa-circle-check status-icon'; }
}
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