import { db, addDoc, getDocs, query, where, deleteDoc, doc, onSnapshot, getBookingsCollectionRef } from '../firebase.js';
import { getState } from '../state.js';
import { showMessage } from '../ui.js';
import { isOverlapping } from '../utils.js';

// Buchen
export async function createBooking(start, end, spot, plate, msgId = 'booking-error') {
    const { currentUser } = getState();
    if (!currentUser) return { success: false };

    // Sicherheitscheck: Keine Buchung in der Vergangenheit (5 Min Kulanz)
    const now = new Date();
    const startTime = new Date(start);
    if (startTime < new Date(now.getTime() - 5 * 60000)) {
        showMessage(msgId, "Fehler: Startzeit liegt in der Vergangenheit.", 'error');
        return { success: false };
    }

    // 1. Verfügbarkeit prüfen
    // Wir laden Buchungen, die NACH dem Startzeitpunkt enden (potenzielle Überschneidung)
    const q = query(getBookingsCollectionRef(), where("endZeit", ">", start)); 
    const snap = await getDocs(q);
    
    const bookings = [];
    snap.forEach(d => bookings.push(d.data()));

    // Filtern nach echtem Overlap
    const overlaps = bookings.filter(b => isOverlapping(start, end, b.startZeit, b.endZeit));

    // Spot-Logik (Automatische Zuweisung)
    if (spot === 'any') {
        const p1Busy = overlaps.some(b => b.parkplatzId === 'P1');
        const p2Busy = overlaps.some(b => b.parkplatzId === 'P2');
        
        if (p1Busy && p2Busy) {
            showMessage(msgId, "Kein Parkplatz frei in diesem Zeitraum.", 'error');
            return { success: false };
        }
        // Nimm P1 wenn frei, sonst P2
        spot = !p1Busy ? 'P1' : 'P2';
    } else {
        // Expliziter Spot gewünscht
        if (overlaps.some(b => b.parkplatzId === spot)) {
            showMessage(msgId, `${spot} ist in diesem Zeitraum belegt.`, 'error');
            return { success: false };
        }
    }

    // 2. Speichern
    try {
        const docRef = await addDoc(getBookingsCollectionRef(), {
            parkplatzId: spot,
            startZeit: start,
            endZeit: end,
            userId: currentUser.uid,
            partei: currentUser.userData.partei,
            gastName: currentUser.userData.username || 'Gast',
            kennzeichen: plate || '',
            createdAt: new Date().toISOString()
        });
        
        showMessage(msgId, `Gebucht: ${spot}`, 'success');
        
        // WICHTIG: Wir geben jetzt Erfolgsdaten zurück (Spot & ID)
        return { success: true, spot: spot, bookingId: docRef.id };

    } catch (e) {
        console.error(e);
        showMessage(msgId, "Buchungsfehler (Datenbank).", 'error');
        return { success: false };
    }
}

// Live-Status für Ampel (P1/P2)
export function subscribeToStatus(callback) {
    const now = new Date().toISOString();
    const q = query(getBookingsCollectionRef(), where("endZeit", ">", now));
    
    return onSnapshot(q, (snap) => {
        const nowReal = new Date();
        let p1 = 'free';
        let p2 = 'free';
        
        snap.forEach(d => {
            const b = d.data();
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
    const q = query(
        getBookingsCollectionRef(), 
        where("userId", "==", currentUser.uid),
        where("endZeit", ">", now)
    );

    return onSnapshot(q, (snap) => {
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
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