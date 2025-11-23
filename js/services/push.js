// js/services/push.js
import { messaging, getToken, onMessage } from '../firebase.js';

export async function initPushNotifications() {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Push erlaubt.');
            // Hier würde man den Token holen und speichern
        }
    } catch (e) {
        console.log('Push Fehler:', e);
    }
}