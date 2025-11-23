import { db, addDoc, getDocs, query, where, deleteDoc, doc, onSnapshot, getBookingsCollectionRef, Timestamp } from '../firebase.js';
import { getState } from '../state.js';
import { showMessage } from '../ui.js';
import { isOverlapping } from '../utils.js';

// Buchen
export async function createBooking(start, end, spot, plate, msgId = 'booking-error') {
    const { currentUser } = getState();
    if (!currentUser) return false;

    // 1. Verfügbarkeit prüfen (lokal, idealerweise via Transaction in Production)
    const q = query(getBookingsCollectionRef(), where("endZeit", ">", start)); // Grobfilter
    const snap = await getDocs(q);
    
    const bookings = [];
    snap.forEach(d => bookings.push(d.data()));

    // Filtern nach echtem Overlap
    const overlaps = bookings.filter(b => isOverlapping(start, end, b.startZeit, b.endZeit));

    // Spot-Logik
    if (spot === 'any') {
        // Wenn P1 und P2 im Zeitraum belegt sind -> Fehler
        const p1Busy = overlaps.some(b => b.parkplatzId === 'P1');
        const p2Busy = overlaps.some(b => b.parkplatzId === 'P2');
        if (p1Busy && p2Busy) {
            showMessage(msgId, "Kein Parkplatz frei in diesem Zeitraum.", 'error');
            return false;
        }
        // Auto-Assign: Nimm den freien
        spot = p1Busy ? 'P2' : 'P1';
    } else {
        // Expliziter Spot
        if (overlaps.some(b => b.parkplatzId === spot)) {
            showMessage(msgId, `${spot} ist in diesem Zeitraum belegt.`, 'error');
            return false;
        }
    }

    // 2. Speichern
    try {
        await addDoc(getBookingsCollectionRef(), {
            parkplatzId: spot,
            startZeit: start,
            endZeit: end,
            userId: currentUser.uid,
            partei: currentUser.userData.partei,
            gastName: currentUser.userData.username || 'Gast', // Bei Gästen steht hier "Gast von..."
            kennzeichen: plate || '',
            createdAt: new Date().toISOString()
        });
        showMessage(msgId, `Gebucht: ${spot}`, 'success');
        return true;
    } catch (e) {
        console.error(e);
        showMessage(msgId, "Buchungsfehler.", 'error');
        return false;
    }
}

// Live-Status für Ampel (P1/P2)
export function subscribeToStatus(callback) {
    const now = new Date().toISOString();
    // Wir holen alles was noch nicht vorbei ist
    const q = query(getBookingsCollectionRef(), where("endZeit", ">", now));
    
    return onSnapshot(q, (snap) => {
        const nowReal = new Date();
        let p1 = 'free';
        let p2 = 'free';
        
        snap.forEach(d => {
            const b = d.data();
            // Prüfen ob JETZT gerade belegt
            if (new Date(b.startZeit) <= nowReal && new Date(b.endZeit) > nowReal) {
                if (b.parkplatzId === 'P1') p1 = 'busy';
                if (b.parkplatzId === 'P2') p2 = 'busy';
            }
        });
        callback({ P1: p1, P2: p2 });
    });
}

// Meine Buchungen laden
export function subscribeToMyBookings(callback) {
    const { currentUser } = getState();
    if (!currentUser) return;
    
    const now = new Date().toISOString();
    // Zeige aktuelle und zukünftige
    const q = query(
        getBookingsCollectionRef(), 
        where("userId", "==", currentUser.uid),
        where("endZeit", ">", now) // Nur was noch relevant ist
    );

    return onSnapshot(q, (snap) => {
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        // Client-Sortierung nach Startzeit
        list.sort((a,b) => new Date(a.startZeit) - new Date(b.startZeit));
        callback(list);
    });
}

export async function deleteBooking(id) {
    try {
        await deleteDoc(doc(db, "bookings", id));
        return true;
    } catch(e) {
        console.error(e);
        return false;
    }
}