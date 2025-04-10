// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

// Konfiguration (ersetzen mit deinen Daten)
const firebaseConfig = {
  apiKey: "AIzaSyBRUS71ELv2S8icpsDGwA0xkMgMqOnIR7Q",
  authDomain: "true-life-leveling.firebaseapp.com",
  databaseURL: "https://true-life-leveling-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "true-life-leveling",
  storageBucket: "true-life-leveling.firebasestorage.app",
  messagingSenderId: "504663321518",
  appId: "1:504663321518:web:9bc2ad677db241832b763f",
  measurementId: "G-HP24QX7SE8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Globale Nutzer-Referenz
let currentUser = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user || null;
  const status = document.getElementById("authStatus");
  if (status) {
    status.textContent = user ? `Eingeloggt als: ${user.email || "Anonym"}` : "Nicht eingeloggt";
  }
});

// Exportieren
export {
  db,
  auth,
  currentUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs
};
