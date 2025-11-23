import { db, addDoc, getDoc, doc, serverTimestamp, getInvitesCollectionRef } from '../firebase.js';
import { getState } from '../state.js';

export async function createGuestLink() {
    const { currentUser } = getState();
    if (!currentUser) return;

    try {
        const docRef = await addDoc(getInvitesCollectionRef(), {
            hostUid: currentUser.uid,
            hostPartei: currentUser.userData.partei,
            hostName: currentUser.userData.username || currentUser.userData.email,
            createdAt: serverTimestamp(),
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 48h gültig
        });

        const baseUrl = window.location.origin + window.location.pathname;
        const link = `${baseUrl}?invite=${docRef.id}`;

        await navigator.clipboard.writeText(link);
        alert(`Link kopiert!\n\nSende diesen Link an deinen Gast:\n${link}`);
    } catch (e) {
        console.error(e);
        alert("Fehler beim Erstellen.");
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