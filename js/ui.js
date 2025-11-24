import * as dom from './dom.js';
import { getState } from './state.js';

export function showMessage(elementId, text, type = 'error') {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = text;
        el.className = `message-box ${type}`;
        el.style.display = 'block';
        setTimeout(() => el.style.display = 'none', 5000);
    } else {
        alert(text);
    }
}

export function navigateTo(targetSection) {
    // Alle Haupt-Container ausblenden
    const sections = [
        dom.loginForm, dom.registerForm, dom.mainMenu, 
        dom.bookingSection, dom.overviewSection, 
        dom.profileSection, dom.adminSection, dom.guestSection,
        dom.resetPasswordForm, dom.verifyEmailMessage
    ];
    
    sections.forEach(sec => {
        if(sec) {
            sec.style.display = 'none';
            sec.classList.remove('active');
        }
    });

    // --- HEADER LOGIK (NEU) ---
    const { currentUser } = getState();
    const isGuest = currentUser && currentUser.isGuest;
    const isAuthPage = (targetSection === dom.loginForm || targetSection === dom.registerForm || targetSection === dom.verifyEmailMessage || targetSection === dom.resetPasswordForm);

    // 1. Header (User Info + Logout) zeigen, wenn eingeloggt und KEIN Gast
    if (dom.appHeader) {
        if (currentUser && !isGuest && !isAuthPage) {
            dom.appHeader.style.display = 'flex';
        } else {
            dom.appHeader.style.display = 'none';
        }
    }

    // 2. Status Widget (Ampel) zeigen wir immer an, außer auf Auth-Pages
    // Auch Gäste dürfen sehen, ob was frei ist (im Gast-Menü ist aber eine eigene Ampel, daher hier evtl ausblenden)
    // Wir blenden es im Gast-Menü aus, weil das Gast-Menü ein eigenes großes Widget hat.
    if (dom.parkingStatusWidget) {
        if (!isAuthPage && !isGuest) {
             dom.parkingStatusWidget.style.display = 'flex';
        } else {
             dom.parkingStatusWidget.style.display = 'none';
        }
    }

    // Ziel anzeigen
    if (targetSection) {
        targetSection.style.display = 'block';
        // Kurze Verzögerung für CSS Animationen
        setTimeout(() => targetSection.classList.add('active'), 10);
    }
}

export function updateUserInfoUI(user) {
    if (user && !user.isGuest) {
        const nameEl = document.getElementById('current-username');
        const roleEl = document.getElementById('current-role');
        
        if (nameEl) nameEl.textContent = user.userData.username || user.userData.email;
        if (roleEl) roleEl.textContent = user.userData.partei;
        
        // Admin Menüpunkt zeigen?
        const adminBtn = document.getElementById('admin-btn');
        if(adminBtn) {
            adminBtn.style.display = (user.userData.partei === 'Admin' || user.userData.isAdmin) ? 'flex' : 'none';
        }
    }
}