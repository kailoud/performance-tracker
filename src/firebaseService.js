import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { db, auth } from './firebase';

// Authentication functions
export const signUp = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    throw error;
  }
};

export const signIn = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    throw error;
  }
};

export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

// Data functions
export const saveDailyData = async (userId, date, data) => {
  try {
    const docRef = doc(db, 'users', userId, 'dailyData', date);
    await setDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    throw error;
  }
};

export const getDailyData = async (userId, date) => {
  try {
    const docRef = doc(db, 'users', userId, 'dailyData', date);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      return null;
    }
  } catch (error) {
    throw error;
  }
};

export const getAllDailyData = async (userId) => {
  try {
    const q = query(
      collection(db, 'users', userId, 'dailyData'),
      orderBy('updatedAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const data = {};
    
    querySnapshot.forEach((doc) => {
      data[doc.id] = doc.data();
    });
    
    return data;
  } catch (error) {
    throw error;
  }
};

export const saveUserProfile = async (userId, userData) => {
  try {
    const docRef = doc(db, 'users', userId);
    await setDoc(docRef, {
      ...userData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    throw error;
  }
};

export const getUserProfile = async (userId) => {
  try {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      return null;
    }
  } catch (error) {
    throw error;
  }
};

// Real-time listeners
export const subscribeToDailyData = (userId, date, callback) => {
  const docRef = doc(db, 'users', userId, 'dailyData', date);
  return onSnapshot(docRef, (doc) => {
    if (doc.exists()) {
      callback(doc.data());
    } else {
      callback(null);
    }
  });
};

export const subscribeToAllDailyData = (userId, callback) => {
  const q = query(
    collection(db, 'users', userId, 'dailyData'),
    orderBy('updatedAt', 'desc')
  );
  return onSnapshot(q, (querySnapshot) => {
    const data = {};
    querySnapshot.forEach((doc) => {
      data[doc.id] = doc.data();
    });
    callback(data);
  });
}; 