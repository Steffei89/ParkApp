// --- WICHTIG: ALTE SERVICE WORKER LÖSCHEN (Cache-Reset) ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
            registration.unregister();
        }
    });
}

// Normale Imports
import { auth, onAuthStateChanged, signInAnonymously } from './firebase.js';
import * as dom from './dom.js';
import { setCurrentUser, clearAllUnsubscribers } from './state.js';
import { navigateTo, updateUserInfoUI } from './ui.js';
import { handleLogin, handleRegister, handleLogout } from './services/auth.js';
import { validateInvite } from './services/invite.js';
import { initDashboardView, loadMyBookings, initStatusWidget } from './views/dashboard.js';
import { initGuestView } from './views/guest.js';
// WICHTIG: Hier wird die Admin-View importiert. Durch den Cache-Reset oben sollte das jetzt klappen.
import { initAdminView, loadAdminData } from './views/admin.js';

// --- HELPER ---
function checkInviteCode() {
    const codeInput = document.getElementById('register-invite-code');
    const wrapper = document.getElementById('partei-selection-wrapper');
    if (codeInput && wrapper) {
        if (codeInput.value.trim() === '1234') {
            wrapper.classList.remove('hidden');
        } else {
            wrapper.classList.add('hidden');
        }
    }
}

// --- THEME ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && systemDark)) {
        document.body.setAttribute('data-theme', 'dark');
        if(dom.themeIcon) dom.themeIcon.className = 'fa-solid fa-sun clickable';
    } else {
        document.body.setAttribute('data-theme', 'light');
        if(dom.themeIcon) dom.themeIcon.className = 'fa-solid fa-moon clickable';
    }
}
initTheme();

// --- EVENT LISTENER ---
if(dom.loginForm) dom.loginForm.querySelector('#login-btn').addEventListener('click', handleLogin);
if(dom.registerForm) dom.registerForm.querySelector('#register-btn').addEventListener('click', handleRegister);
if(document.getElementById('logout-btn')) document.getElementById('logout-btn').addEventListener('click', handleLogout);

if(document.getElementById('register-invite-code')) {
    document.getElementById('register-invite-code').addEventListener('input', checkInviteCode);
}

document.getElementById('show-register').addEventListener('click', () => {
    document.getElementById('register-invite-code').value = '';
    document.getElementById('partei-selection-wrapper').classList.add('hidden');
    navigateTo(dom.registerForm);
});
document.getElementById('show-login').addEventListener('click', () => navigateTo(dom.loginForm));

document.getElementById('show-reset-password').addEventListener('click', () => navigateTo(dom.resetPasswordForm));
document.getElementById('back-to-login-btn').addEventListener('click', () => navigateTo(dom.loginForm));
document.getElementById('back-to-login-from-verify-btn').addEventListener('click', () => navigateTo(dom.loginForm));

if(dom.refreshBtn) {
    dom.refreshBtn.addEventListener('click', () => window.location.reload());
}

if(dom.themeIcon) {
    dom.themeIcon.addEventListener('click', () => {
        const body = document.body;
        const isDark = body.getAttribute('data-theme') === 'dark';
        const newTheme = isDark ? 'light' : 'dark';
        body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        dom.themeIcon.className = isDark ? 'fa-solid fa-moon clickable' : 'fa-solid fa-sun clickable';
    });
}

const adminBtn = document.getElementById('admin-btn');
if (adminBtn) {
    adminBtn.addEventListener('click', () => {
        initAdminView();
        loadAdminData();
        navigateTo(dom.adminSection);
    });
}

// --- STARTUP ---
const urlParams = new URLSearchParams(window.location.search);
const inviteId = urlParams.get('invite');
let isGuestSession = !!inviteId;

if (isGuestSession && dom.loadingOverlay) dom.loadingOverlay.style.display = 'flex';

onAuthStateChanged(auth, async (user) => {
    if (isGuestSession) {
        if (!user) { await signInAnonymously(auth); return; }
        const validation = await validateInvite(inviteId);
        if (!validation.valid) {
            alert("Fehler: " + validation.error);
            window.location.href = window.location.pathname; return;
        }
        const guestUser = {
            uid: user.uid, isGuest: true,
            userData: { partei: validation.hostData.hostPartei, username: 'Gast', isAdmin: false }
        };
        setCurrentUser(guestUser);
        if(dom.loadingOverlay) dom.loadingOverlay.style.display = 'none';
        dom.appContainer.style.display = 'block';
        if(dom.appHeader) dom.appHeader.style.display = 'none';
        
        initGuestView(validation.hostData);
        navigateTo(dom.guestSection);
        return;
    }

    if(dom.loadingOverlay) dom.loadingOverlay.style.display = 'none';
    dom.appContainer.style.display = 'block';

    if (user) {
        import('./firebase.js').then(async ({ getDoc, getUserProfileDocRef }) => {
            const docSnap = await getDoc(getUserProfileDocRef(user.uid));
            if (docSnap.exists()) {
                const appUser = { uid: user.uid, ...user, userData: docSnap.data(), isGuest: false };
                setCurrentUser(appUser);
                updateUserInfoUI(appUser);
                
                initDashboardView();
                loadMyBookings();
                initStatusWidget();
                
                navigateTo(dom.mainMenu);
            } else {
                handleLogout();
            }
        });
    } else {
        clearAllUnsubscribers();
        setCurrentUser(null);
        navigateTo(dom.loginForm);
    }
});