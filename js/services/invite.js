import { db, setDoc, getDoc, doc, serverTimestamp, getInvitesCollectionRef } from '../firebase.js';
import { getState } from '../state.js';

export async function createGuestLink(target = 'copy') {
    const { currentUser } = getState();
    if (!currentUser) return;

    try {
        // 1. ID generieren
        const inviteRef = doc(getInvitesCollectionRef());
        
        // 2. Link erstellen
        const baseUrl = window.location.origin + window.location.pathname;
        const link = `${baseUrl}?invite=${inviteRef.id}`;

        // 3. SOFORT kopieren (für Safari)
        await navigator.clipboard.writeText(link);

        // 4. Datenbank Eintrag im Hintergrund
        setDoc(inviteRef, {
            hostUid: currentUser.uid,
            hostPartei: currentUser.userData.partei,
            hostName: currentUser.userData.username || currentUser.userData.email,
            createdAt: serverTimestamp(),
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() 
        });

        // 5. Aktion ausführen
        if (target === 'whatsapp') {
            // WhatsApp öffnen
            const text = `Hier ist dein Parkplatz-Link: ${link}`;
            window.location.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
        } else {
            // Nur Bestätigung
            alert("Link kopiert!");
        }

    } catch (e) {
        console.error(e);
        alert("Fehler beim Erstellen oder Kopieren.");
    }
}

export async function validateInvite(inviteId) {
    try {
        const docRef = doc(db, "guest_invites", inviteId);
        const snap = await getDoc(docRef);
        
        if (!snap.exists()) return { valid: false, error: "Link ungültig." };
        
        const data = snap.data();
        const now = new Date().toISOString();
        
        if (data.expiresAt < now) return { valid: false, error: "Link abgelaufen." };
        
        return { valid: true, hostData: data };
    } catch (e) {
        return { valid: false, error: e.message };
    }
}