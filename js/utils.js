// Gibt "YYYY-MM-DD" zurück (für input type="date")
export function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

// Gibt "HH:MM" zurück
export function getCurrentTimeString() {
    const now = new Date();
    return now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

// Berechnet Stunden-Differenz
export function getHoursDifference(start, end) {
    const diffMs = new Date(end) - new Date(start);
    return diffMs / (1000 * 60 * 60);
}

// Prüft, ob sich zwei Zeiträume überschneiden
export function isOverlapping(startA, endA, startB, endB) {
    return new Date(startA) < new Date(endB) && new Date(endA) > new Date(startB);
}