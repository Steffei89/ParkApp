// Service Worker für Offline-Support registrieren
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('Service Worker OK'))
      .catch((err) => console.error('SW Fehler:', err));
}

import { auth, onAuthStateChanged, signInAnonymously } from './firebase.js';
import * as dom from './dom.js';
import { setCurrentUser, clearAllUnsubscribers } from './state.js';
import { navigateTo, updateUserInfoUI, showMessage } from './ui.js';
import { handleLogin, handleRegister, handleLogout } from './services/auth.js';
import { validateInvite } from './services/invite.js';
import { initDashboardView, loadMyBookings, initStatusWidget } from './views/dashboard.js';
import { initGuestView } from './views/guest.js';
import { initAdminView, loadAdminData } from './views/admin.js';
import { APP_VERSION } from './config.js';

// --- GLOBALE EVENT LISTENER ---

// Auth Buttons
dom.loginForm.querySelector('#login-btn').addEventListener('click', handleLogin);
dom.registerForm.querySelector('#register-btn').addEventListener('click', handleRegister);
document.getElementById('logout-btn').addEventListener('click', handleLogout);

// Navigation zwischen Login/Register
document.getElementById('show-register').addEventListener('click', () => navigateTo(dom.registerForm));
document.getElementById('show-login').addEventListener('click', () => navigateTo(dom.loginForm));
document.getElementById('switch-login').addEventListener('click', () => navigateTo(dom.loginForm));

// Passwort Reset Navigation
document.getElementById('show-reset-password').addEventListener('click', () => navigateTo(dom.resetPasswordForm));
document.getElementById('back-to-login-btn').addEventListener('click', () => navigateTo(dom.loginForm));
document.getElementById('back-to-login-from-verify-btn').addEventListener('click', () => navigateTo(dom.loginForm));

// Header Controls
dom.refreshBtn.addEventListener('click', () => window.location.reload());
dom.themeIcon.addEventListener('click', () => {
    const body = document.body;
    const isDark = body.getAttribute('data-theme') === 'dark';
    body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    // Icon ändern
    dom.themeIcon.className = isDark ? 'fa-solid fa-moon clickable' : 'fa-solid fa-sun clickable';
});

// Admin Button
document.getElementById('admin-btn').addEventListener('click', () => {
    initAdminView();
    loadAdminData();
    navigateTo(dom.adminSection);
});


// --- STARTUP LOGIK ---

// Prüfen ob Gast-Link (Invite)
const urlParams = new URLSearchParams(window.location.search);
const inviteId = urlParams.get('invite');
let isGuestSession = !!inviteId;

if (isGuestSession) {
    dom.loadingOverlay.style.display = 'flex';
}

onAuthStateChanged(auth, async (user) => {
    
    // FALL A: GAST-MODUS
    if (isGuestSession) {
        if (!user) {
            await signInAnonymously(auth);
            return; // Wartet auf Reload mit User
        }

        // Invite prüfen
        const validation = await validateInvite(inviteId);
        
        if (!validation.valid) {
            alert("Fehler: " + validation.error);
            window.location.href = window.location.pathname; // Invite entfernen -> Normaler Login
            return;
        }

        const hostData = validation.hostData;
        
        // Virtueller User für die Session
        const guestUser = {
            uid: user.uid,
            isGuest: true,
            userData: {
                partei: hostData.hostPartei,
                username: 'Gast',
                isAdmin: false
            }
        };
        
        setCurrentUser(guestUser);
        dom.loadingOverlay.style.display = 'none';
        
        // UI anpassen für Gast
        dom.appContainer.style.display = 'block';
        // Header ausblenden für Gäste (eigene Ansicht)
        if(dom.headerContainer) dom.headerContainer.style.display = 'none';
        
        // Gast-View starten
        initGuestView(hostData);
        navigateTo(dom.guestSection);
        return;
    }

    // FALL B: BEWOHNER (Normal)
    dom.loadingOverlay.style.display = 'none';
    dom.appContainer.style.display = 'block';

    if (user) {
        // Bewohner ist eingeloggt
        // Profil laden (hier simulieren wir das Laden, da wir Daten nicht lokal cachen in diesem einfachen Setup)
        // In einer echten App würdest du hier userDoc laden. 
        // Wir verlassen uns auf die Daten, die wir beim Login/Register gesetzt haben oder laden sie kurz nach:
        
        import('./firebase.js').then(async ({ getDoc, getUserProfileDocRef }) => {
            const docSnap = await getDoc(getUserProfileDocRef(user.uid));
            if (docSnap.exists()) {
                const userData = docSnap.data();
                const appUser = { uid: user.uid, ...user, userData, isGuest: false };
                
                setCurrentUser(appUser);
                updateUserInfoUI(appUser);
                
                // Dashboard starten
                initDashboardView();
                loadMyBookings();
                initStatusWidget();
                
                navigateTo(dom.mainMenu);
            } else {
                // User existiert in Auth aber nicht in DB? Logout.
                handleLogout();
            }
        });

    } else {
        // Nicht eingeloggt
        clearAllUnsubscribers();
        setCurrentUser(null);
        navigateTo(dom.loginForm);
    }
});