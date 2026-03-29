// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCUaYXcMCDwg-3-i8bMfxme7ehZA_Xbzp4",
  authDomain: "fir-eef36.firebaseapp.com",
  projectId: "fir-eef36",
  storageBucket: "fir-eef36.firebasestorage.app",
  messagingSenderId: "642908470848",
  appId: "1:642908470848:web:4efdde7f2e7b5ab1af29a5",
  measurementId: "G-ZWVE21L4CX"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);