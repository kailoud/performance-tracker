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

// Initialize Firebase with retry logic
let app: any;
let retryCount = 0;
const maxRetries = 3;

const initializeFirebase = () => {
  try {
    app = initializeApp(firebaseConfig);
    console.log('Firebase initialized successfully');
    return app;
  } catch (error) {
    console.error('Firebase initialization error:', error);
    retryCount++;
    
    if (retryCount < maxRetries) {
      console.log(`Retrying Firebase initialization (attempt ${retryCount + 1}/${maxRetries})...`);
      // Wait a bit before retrying
      setTimeout(() => {
        initializeFirebase();
      }, 1000);
    } else {
      console.error('Firebase initialization failed after maximum retries');
      throw error;
    }
  }
};

// Initialize Firebase
app = initializeFirebase();

// Initialize Firestore and Auth with error handling
let db: any, auth: any;

const initializeServices = () => {
  try {
    db = getFirestore(app);
    auth = getAuth(app);
    console.log('Firebase services initialized successfully');
  } catch (error) {
    console.error('Firebase service initialization error:', error);
    // Retry service initialization
    setTimeout(() => {
      try {
        db = getFirestore(app);
        auth = getAuth(app);
        console.log('Firebase services initialized on retry');
      } catch (retryError) {
        console.error('Firebase services initialization failed on retry:', retryError);
      }
    }, 1000);
  }
};

initializeServices();

export { db, auth };
export default app; 