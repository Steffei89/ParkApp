import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { 
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut,
    updatePassword, sendPasswordResetEmail, sendEmailVerification, EmailAuthProvider, reauthenticateWithCredential, deleteUser,
    signInAnonymously 
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { 
    getFirestore, doc, setDoc, collection, getDocs, query, where, getDoc, onSnapshot, addDoc, deleteDoc, updateDoc, 
    orderBy, limit, runTransaction, writeBatch, Timestamp, increment, serverTimestamp, deleteField, arrayUnion 
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-messaging.js";

// DEINE ECHTEN DATEN SIND JETZT HIER DRIN:
const firebaseConfig = {
  apiKey: "AIzaSyBF-glZWR6fCAVEf7xREDzHz7R8-yc-AXI",
  authDomain: "parkapp-c6559.firebaseapp.com",
  projectId: "parkapp-c6559",
  storageBucket: "parkapp-c6559.firebasestorage.app",
  messagingSenderId: "1039259740426",
  appId: "1:1039259740426:web:1c753ea4655e8d399c32f3",
  measurementId: "G-ZPNNTQMZQT"
};

// Firebase starten
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const messaging = getMessaging(app);

// Funktionen exportieren, damit andere Dateien sie nutzen können
export { auth, db, messaging };
export { 
    createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updatePassword, 
    sendPasswordResetEmail, sendEmailVerification, EmailAuthProvider, reauthenticateWithCredential, deleteUser,
    signInAnonymously
};
export { getToken, onMessage }; 
export { 
    doc, setDoc, collection, getDocs, query, where, getDoc, onSnapshot, addDoc, deleteDoc, updateDoc, 
    orderBy, limit, runTransaction, writeBatch, Timestamp, increment, serverTimestamp, deleteField, arrayUnion 
};

// --- Helper Funktionen für Datenbank-Pfade ---

// Alle Buchungen (Parkplätze)
export function getBookingsCollectionRef() { return collection(db, "bookings"); }

// Benutzer-Profile (Bewohner)
export function getUserProfileDocRef(uid) { return doc(db, "users", uid); }

// Einladungs-Links für Gäste
export function getInvitesCollectionRef() { return collection(db, "guest_invites"); }

// Allgemeine Einstellungen (Admin)
export function getSettingsDocRef() { return doc(db, 'app_settings', 'config'); }

// Parkdauer-Optionen (z.B. "Kurzparker") - nutzen wir statt WashPrograms
export function getWashProgramsCollectionRef() { return collection(db, "parking_durations"); }
export function getWashProgramDocRef(docId) { return doc(db, "parking_durations", docId); }

// Aktive Timer/Status
export function getActiveTimerDocRef(partei) { return doc(db, "active_timers", partei); }