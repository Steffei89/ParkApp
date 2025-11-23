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

// --- HILFSFUNKTION: HAUS-CODE PRÜFEN ---
function checkInviteCode() {
    const codeInput = document.getElementById('register-invite-code');
    const wrapper = document.getElementById('partei-selection-wrapper');
    
    if (codeInput && wrapper) {
        // Wenn der Code "1234" ist, zeige das Dropdown
        if (codeInput.value.trim() === '1234') {
            wrapper.classList.remove('hidden');
        } else {
            wrapper.classList.add('hidden');
        }
    }
}

// --- INITIALISIERUNG THEME (Dark/Light) ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Wenn gespeichert 'dark' ist ODER nichts gespeichert ist aber System 'dark' ist:
    if (savedTheme === 'dark' || (!savedTheme && systemDark)) {
        document.body.setAttribute('data-theme', 'dark');
        // Icon = Sonne (um zu hell zu wechseln)
        if(dom.themeIcon) dom.themeIcon.className = 'fa-solid fa-sun clickable';
    } else {
        document.body.setAttribute('data-theme', 'light');
        // Icon = Mond (um zu dunkel zu wechseln)
        if(dom.themeIcon) dom.themeIcon.className = 'fa-solid fa-moon clickable';
    }
}
// Direkt beim Laden ausführen
initTheme();


// --- GLOBALE EVENT LISTENER ---

// Auth Buttons
dom.loginForm.querySelector('#login-btn').addEventListener('click', handleLogin);
dom.registerForm.querySelector('#register-btn').addEventListener('click', handleRegister);
document.getElementById('logout-btn').addEventListener('click', handleLogout);

// Listener für das Eingabefeld (Haus-Code)
document.getElementById('register-invite-code').addEventListener('input', checkInviteCode);

// Navigation zwischen Login/Register
document.getElementById('show-register').addEventListener('click', () => {
    document.getElementById('register-invite-code').value = '';
    document.getElementById('partei-selection-wrapper').classList.add('hidden');
    navigateTo(dom.registerForm);
});
document.getElementById('show-login').addEventListener('click', () => navigateTo(dom.loginForm));
document.getElementById('switch-login').addEventListener('click', () => navigateTo(dom.loginForm));

// Passwort Reset Navigation
document.getElementById('show-reset-password').addEventListener('click', () => navigateTo(dom.resetPasswordForm));
document.getElementById('back-to-login-btn').addEventListener('click', () => navigateTo(dom.loginForm));
document.getElementById('back-to-login-from-verify-btn').addEventListener('click', () => navigateTo(dom.loginForm));

// Header Controls
dom.refreshBtn.addEventListener('click', () => window.location.reload());

// THEME TOGGLE (Verbessert: Mit Speichern)
dom.themeIcon.addEventListener('click', () => {
    const body = document.body;
    // Prüfen was aktuell aktiv ist
    const isCurrentlyDark = body.getAttribute('data-theme') === 'dark';
    
    // Umschalten
    const newTheme = isCurrentlyDark ? 'light' : 'dark';
    body.setAttribute('data-theme', newTheme);
    
    // Im Browser speichern
    localStorage.setItem('theme', newTheme);
    
    // Icon anpassen
    dom.themeIcon.className = isCurrentlyDark ? 'fa-solid fa-moon clickable' : 'fa-solid fa-sun clickable';
});

// Admin Button
const adminBtn = document.getElementById('admin-btn');
if (adminBtn) {
    adminBtn.addEventListener('click', () => {
        initAdminView();
        loadAdminData();
        navigateTo(dom.adminSection);
    });
}

// --- STARTUP LOGIK ---

const urlParams = new URLSearchParams(window.location.search);
const inviteId = urlParams.get('invite');
let isGuestSession = !!inviteId;

if (isGuestSession) {
    dom.loadingOverlay.style.display = 'flex';
}

onAuthStateChanged(auth, async (user) => {
    
    // FALL A: GAST-MODUS (via Link)
    if (isGuestSession) {
        if (!user) {
            await signInAnonymously(auth);
            return; 
        }

        const validation = await validateInvite(inviteId);
        
        if (!validation.valid) {
            alert("Fehler: " + validation.error);
            window.location.href = window.location.pathname; 
            return;
        }

        const hostData = validation.hostData;
        
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
        
        dom.appContainer.style.display = 'block';
        if(dom.headerContainer) dom.headerContainer.style.display = 'none';
        
        initGuestView(hostData);
        navigateTo(dom.guestSection);
        return;
    }

    // FALL B: BEWOHNER (Normal)
    dom.loadingOverlay.style.display = 'none';
    dom.appContainer.style.display = 'block';

    if (user) {
        import('./firebase.js').then(async ({ getDoc, getUserProfileDocRef }) => {
            try {
                const docSnap = await getDoc(getUserProfileDocRef(user.uid));
                if (docSnap.exists()) {
                    const userData = docSnap.data();
                    const appUser = { uid: user.uid, ...user, userData, isGuest: false };
                    
                    setCurrentUser(appUser);
                    updateUserInfoUI(appUser);
                    
                    initDashboardView();
                    loadMyBookings();
                    initStatusWidget();
                    
                    navigateTo(dom.mainMenu);
                } else {
                    console.warn("User ohne Profil gefunden.");
                    handleLogout();
                }
            } catch (e) {
                console.error("Fehler beim Laden des Profils:", e);
            }
        });

    } else {
        clearAllUnsubscribers();
        setCurrentUser(null);
        navigateTo(dom.loginForm);
    }
});