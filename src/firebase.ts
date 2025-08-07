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

// Clear problematic Firebase storage on initialization
const clearFirebaseStorage = () => {
  try {
    // Clear IndexedDB storage that might be corrupted
    if ('indexedDB' in window) {
      const request = indexedDB.deleteDatabase('firebaseLocalStorageDb');
      request.onsuccess = () => {
        console.log('Firebase storage cleared successfully');
      };
      request.onerror = () => {
        console.log('Could not clear Firebase storage');
      };
    }
    
    // Clear localStorage Firebase entries
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('firebase')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
  } catch (error) {
    console.log('Error clearing Firebase storage:', error);
  }
};

// Clear storage on app initialization
clearFirebaseStorage();

// Initialize Firebase with error handling
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  console.error('Firebase initialization error:', error);
  // If Firebase fails to initialize, clear storage and retry
  clearFirebaseStorage();
  app = initializeApp(firebaseConfig);
}

// Initialize Firestore and Auth with error handling
let db: any, auth: any;
try {
  db = getFirestore(app);
  auth = getAuth(app);
} catch (error) {
  console.error('Firebase service initialization error:', error);
  // Retry initialization
  db = getFirestore(app);
  auth = getAuth(app);
}

export { db, auth };
export default app; 