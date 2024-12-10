import { initializeApp } from "firebase/app"; 
import { getAuth, signInWithPhoneNumber, signInWithEmailAndPassword, createUserWithEmailAndPassword, initializeAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCBlnJoEJvzX1Lg2zUHzuBIgNMnZWxil6g",
  authDomain: "synq-main-auth.firebaseapp.com",
  projectId: "synq-main-auth",
  storageBucket: "synq-main-auth.firebasestorage.app",
  messagingSenderId: "403608219725",
  appId: "1:403608219725:web:1b3e34875f7ca215c82c04",
  measurementId: "G-P5J5CSWM0Q"
};

const app = initializeApp(firebaseConfig);
const auth = initializeAuth(app);

export { auth, signInWithPhoneNumber, signInWithEmailAndPassword, createUserWithEmailAndPassword };
