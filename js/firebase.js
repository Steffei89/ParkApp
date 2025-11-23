// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBF-glZWR6fCAVEf7xREDzHz7R8-yc-AXI",
  authDomain: "parkapp-c6559.firebaseapp.com",
  projectId: "parkapp-c6559",
  storageBucket: "parkapp-c6559.firebasestorage.app",
  messagingSenderId: "1039259740426",
  appId: "1:1039259740426:web:1c753ea4655e8d399c32f3",
  measurementId: "G-ZPNNTQMZQT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);