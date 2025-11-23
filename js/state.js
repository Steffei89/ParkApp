let currentUser = null;
let isRegistering = false;

// Wir merken uns hier auch globale Listener, um sie beim Ausloggen zu stoppen
let unsubscribers = {};

export const getState = () => ({
    currentUser,
    isRegistering,
    unsubscribers
});

export const setCurrentUser = (user) => { currentUser = user; };
export const setIsRegistering = (val) => { isRegistering = val; };

export function setUnsubscriber(key, unsubFunc) {
    if (unsubscribers[key]) {
        unsubscribers[key](); // Alten Listener stoppen
    }
    unsubscribers[key] = unsubFunc;
}

export function clearAllUnsubscribers() {
    Object.values(unsubscribers).forEach(func => {
        if (func) func();
    });
    unsubscribers = {};
}