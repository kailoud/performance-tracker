import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD1m-ujx2qua2LnyAiN1zXZLs98AHh-URo",
  authDomain: "performance-trackerapp.firebaseapp.com",
  databaseURL: "https://performance-trackerapp-default-rtdb.europe-w",
  projectId: "performance-trackerapp",
  storageBucket: "performance-trackerapp.firebasestorage.app",
  messagingSenderId: "389701249735",
  appId: "1:389701249735:web:6cf82df4a485617a2eace2",
  measurementId: "G-YY78TD4HMN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore and Auth
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app; 