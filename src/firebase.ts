import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD1m-ujx2qua2LnyAiN1zXZLs98AHh-URo",
  authDomain: "performance-trackerapp.firebaseapp.com",
  databaseURL: "https://performance-trackerapp-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "performance-trackerapp",
  storageBucket: "performance-trackerapp.firebasestorage.app",
  messagingSenderId: "389701249735",
  appId: "1:389701249735:web:6cf82df4a485617a2eace2",
  measurementId: "G-YY78TD4HMN"
};

// Test network connectivity
const testConnectivity = async () => {
  try {
    await fetch('https://www.google.com', { 
      method: 'HEAD',
      mode: 'no-cors'
    });
    console.log('Network connectivity test passed');
    return true;
  } catch (error) {
    console.error('Network connectivity test failed:', error);
    return false;
  }
};

// Initialize Firebase with simple error handling
let app: any;
let db: any, auth: any;

try {
  // Test connectivity first
  testConnectivity();
  
  // Initialize Firebase
  app = initializeApp(firebaseConfig);
  console.log('Firebase initialized successfully');
  
  // Initialize services
  db = getFirestore(app);
  auth = getAuth(app);
  console.log('Firebase services initialized successfully');
  
} catch (error) {
  console.error('Firebase initialization error:', error);
  // Create a minimal app instance for fallback
  try {
    app = initializeApp(firebaseConfig, 'fallback');
    db = getFirestore(app);
    auth = getAuth(app);
    console.log('Firebase initialized with fallback');
  } catch (fallbackError) {
    console.error('Firebase fallback initialization failed:', fallbackError);
  }
}

export { db, auth };
export default app; 