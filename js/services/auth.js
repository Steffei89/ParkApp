import { 
    auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, 
    sendPasswordResetEmail, sendEmailVerification, setDoc, getUserProfileDocRef 
} from '../firebase.js';
import { showMessage, navigateTo } from '../ui.js';
import * as dom from '../dom.js';
import { setIsRegistering } from '../state.js';

export async function handleRegister() {
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-password-confirm').value;
    const code = document.getElementById('register-invite-code').value;
    const partei = document.getElementById('register-partei').value;

    if (password !== confirm) { showMessage('register-error', 'Passwörter stimmen nicht überein.'); return; }
    if (password.length < 6) { showMessage('register-error', 'Passwort zu kurz (min 6).'); return; }
    if (code !== '1234') { showMessage('register-error', 'Falscher Haus-Code.'); return; } // Simpler Schutz
    if (!partei) { showMessage('register-error', 'Bitte Wohnung wählen.'); return; }

    setIsRegistering(true);
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        // Profil anlegen
        await setDoc(getUserProfileDocRef(cred.user.uid), {
            email: email,
            partei: partei,
            username: email.split('@')[0],
            isAdmin: partei === 'Admin'
        });
        await sendEmailVerification(cred.user);
        await signOut(auth); // Erst verifizieren
        
        document.getElementById('verify-email-address').textContent = email;
        navigateTo(dom.verifyEmailMessage);
    } catch (e) {
        showMessage('register-error', e.message);
        setIsRegistering(false);
    }
}

export async function handleLogin() {
    const email = document.getElementById('login-identifier').value;
    const password = document.getElementById('login-password').value;
    try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        if (!cred.user.emailVerified) {
            showMessage('login-error', 'Bitte erst E-Mail bestätigen.');
            await signOut(auth);
        }
    } catch (e) {
        showMessage('login-error', 'Login fehlgeschlagen. Prüfe Daten.');
    }
}

export async function handleLogout() {
    await signOut(auth);
}