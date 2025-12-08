/**
 * Firebase Configuration - The Litmus
 * Handles Firebase initialization for auth and Firestore
 */

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBUwVF2uMtIUTzSssFa8S_3TomgzmRIbyI",
    authDomain: "litmus-daily.firebaseapp.com",
    projectId: "litmus-daily",
    storageBucket: "litmus-daily.firebasestorage.app",
    messagingSenderId: "170403012284",
    appId: "1:170403012284:web:c1d9db4ce155598525bab9"
};

// Initialize Firebase (using compat for vanilla JS)
firebase.initializeApp(firebaseConfig);

// Export services for use in other files
const auth = firebase.auth();
const db = firebase.firestore();

// Configure Google provider
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

// Configure Apple provider
const appleProvider = new firebase.auth.OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

console.log('[Firebase] Initialized successfully');
