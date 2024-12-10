import { initializeApp } from "firebase/app"; // New modular import for initializing Firebase
import { getAuth, signInWithPhoneNumber, signInWithEmailAndPassword, createUserWithEmailAndPassword, initializeAuth } from "firebase/auth"; // Import necessary Firebase Auth methods

// Your Firebase configuration object
const firebaseConfig = {
  apiKey: "AIzaSyCBlnJoEJvzX1Lg2zUHzuBIgNMnZWxil6g",
  authDomain: "synq-main-auth.firebaseapp.com",
  projectId: "synq-main-auth",
  storageBucket: "synq-main-auth.firebasestorage.app",
  messagingSenderId: "403608219725",
  appId: "1:403608219725:web:1b3e34875f7ca215c82c04",
  measurementId: "G-P5J5CSWM0Q"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with persistence for React Native
const auth = initializeAuth(app);

export { auth, signInWithPhoneNumber, signInWithEmailAndPassword, createUserWithEmailAndPassword }; // Export auth and necessary methods
