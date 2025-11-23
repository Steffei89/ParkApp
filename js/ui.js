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
        alert(text); // Fallback
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

    // Header Logik
    const { currentUser } = getState();
    const isGuest = currentUser && currentUser.isGuest;
    const isAuthPage = targetSection === dom.loginForm || targetSection === dom.registerForm;

    // Header ausblenden bei Login oder Gast (Gäste haben eigene Ansicht)
    if (dom.headerContainer) {
        dom.headerContainer.style.display = (isAuthPage || isGuest) ? 'none' : 'flex';
    }
    
    // UserInfo Bar zeigen wenn eingeloggt und kein Gast
    if (dom.userInfo) {
        dom.userInfo.style.display = (currentUser && !isGuest && !isAuthPage) ? 'flex' : 'none';
    }

    // Ziel anzeigen
    if (targetSection) {
        targetSection.style.display = 'block';
        setTimeout(() => targetSection.classList.add('active'), 10);
    }
}

export function updateUserInfoUI(user) {
    if (user && !user.isGuest) {
        document.getElementById('current-username').textContent = user.userData.username || user.userData.email;
        document.getElementById('current-role').textContent = user.userData.partei;
        
        // Admin Button zeigen?
        const adminBtn = document.getElementById('admin-btn');
        if(adminBtn) adminBtn.style.display = user.userData.partei === 'Admin' ? 'block' : 'none';
    }
}