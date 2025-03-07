// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBr-Ch7RvJcdMUtvl8QlxsPJeQ0Rttm6zY",
  authDomain: "restaurante-6413a.firebaseapp.com",
  projectId: "restaurante-6413a",
  storageBucket: "restaurante-6413a.firebasestorage.app",
  messagingSenderId: "775075922341",
  appId: "1:775075922341:web:58072a378f513b5562284c",
  measurementId: "G-L11MSRDF92"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app); // Initialize Firebase Auth

export { app, auth }; // Export the initialized app and auth