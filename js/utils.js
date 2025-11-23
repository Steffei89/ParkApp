// Hilft uns, das aktuelle Datum für Formulare zu bekommen (YYYY-MM-DD)
export function getTodayDateString() {
    const d = new Date();
    const year = d.getFullYear();
    // Monate beginnen bei 0, daher +1. PadStart macht aus "1" eine "01"
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Gibt die aktuelle Uhrzeit als "HH:MM" zurück
export function getCurrentTimeString() {
    const now = new Date();
    return now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

// Berechnet, wie viele Stunden zwischen zwei Zeitpunkten liegen
export function getHoursDifference(startISO, endISO) {
    const start = new Date(startISO);
    const end = new Date(endISO);
    const diffMs = end - start;
    return diffMs / (1000 * 60 * 60);
}

// Die wichtigste Funktion: Prüft, ob sich zwei Parkzeiten überschneiden
// (Damit niemand doppelt bucht)
export function isOverlapping(startA, endA, startB, endB) {
    const sA = new Date(startA);
    const eA = new Date(endA);
    const sB = new Date(startB);
    const eB = new Date(endB);
    
    // Logik: A überschneidet B, wenn A beginnt bevor B endet UND A endet nachdem B beginnt
    return sA < eB && eA > sB;
}

// Formatiert ein Datum schön für die Anzeige (z.B. "24.11.")
export function formatDate(dateInput) {
    const d = new Date(dateInput);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}