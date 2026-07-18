import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, getFirestore } from "firebase/firestore";

// Configuration from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyA-7yQ6xL-6AWlkqBmdO_8q-akGRmJBAwU",
  authDomain: "contador-636e4.firebaseapp.com",
  projectId: "contador-636e4",
  storageBucket: "contador-636e4.firebasestorage.app",
  messagingSenderId: "188407080116",
  appId: "1:188407080116:web:58403d10f6b3492c51e3e1",
  databaseId: "ai-studio-6c77e31d-faed-4418-831b-b8ad2d4f63d3"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore (with databaseId if available)
export const db = getFirestore(app, firebaseConfig.databaseId || "(default)");
