import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  orderBy,
  onSnapshot,
  serverTimestamp,
  QuerySnapshot,
  DocumentSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  User,
  UserCredential
} from 'firebase/auth';
import { db, auth } from './firebase';

// TypeScript interfaces
interface DailyData {
  date: string;
  completedJobs: CompletedJob[];
  lossTimeEntries: LossTimeEntry[];
  isFinished: boolean;
  finishTime?: string;
  updatedAt?: any;
}

interface CompletedJob {
  itemCode: string;
  lmCode: string;
  quantity: number;
  time: number;
  unitsCompleted: number;
  completionPercentage: number;
  actualMinutes: number;
  timestamp: string;
  id: number;
  actualTimeTaken?: number; // in seconds, optional for timer tracking
}

interface LossTimeEntry {
  reason: string;
  minutes: number;
  timestamp: string;
  id: number;
}

interface UserProfile {
  name: string;
  email: string;
  updatedAt?: any;
}

// Authentication functions
export const signUp = async (email: string, password: string): Promise<User> => {
  try {
    const userCredential: UserCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    throw error;
  }
};

export const signIn = async (email: string, password: string): Promise<User> => {
  try {
    const userCredential: UserCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // Check if user is deleted or blocked
    const userRef = doc(db, 'users', userCredential.user.uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      
      if (userData.isDeleted) {
        // Sign out the user and throw error
        await signOut(auth);
        throw new Error('This account has been deleted. Please sign up again.');
      }
      
      if (userData.isBlocked) {
        // Sign out the user and throw error
        await signOut(auth);
        throw new Error('This account has been blocked. Please contact an administrator.');
      }
    }
    
    return userCredential.user;
  } catch (error) {
    throw error;
  }
};

export const resetPassword = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    throw error;
  }
};

export const signOutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    throw error;
  }
};

export const onAuthChange = (callback: (user: User | null) => void): Unsubscribe => {
  return onAuthStateChanged(auth, callback);
};

// Data functions
export const saveDailyData = async (userId: string, date: string, data: DailyData): Promise<void> => {
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

export const getDailyData = async (userId: string, date: string): Promise<DailyData | null> => {
  try {
    const docRef = doc(db, 'users', userId, 'dailyData', date);
    const docSnap: DocumentSnapshot = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as DailyData;
    } else {
      return null;
    }
  } catch (error) {
    throw error;
  }
};

export const getAllDailyData = async (userId: string): Promise<Record<string, DailyData>> => {
  try {
    const q = query(
      collection(db, 'users', userId, 'dailyData'),
      orderBy('updatedAt', 'desc')
    );
    const querySnapshot: QuerySnapshot = await getDocs(q);
    const data: Record<string, DailyData> = {};
    
    querySnapshot.forEach((doc) => {
      data[doc.id] = doc.data() as DailyData;
    });
    
    return data;
  } catch (error) {
    throw error;
  }
};

export const saveUserProfile = async (userId: string, userData: UserProfile): Promise<void> => {
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

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const docRef = doc(db, 'users', userId);
    const docSnap: DocumentSnapshot = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    } else {
      return null;
    }
  } catch (error) {
    throw error;
  }
};

// Real-time listeners
export const subscribeToDailyData = (userId: string, date: string, callback: (data: DailyData | null) => void): Unsubscribe => {
  const docRef = doc(db, 'users', userId, 'dailyData', date);
  return onSnapshot(docRef, (doc) => {
    if (doc.exists()) {
      callback(doc.data() as DailyData);
    } else {
      callback(null);
    }
  });
};

export const subscribeToAllDailyData = (userId: string, callback: (data: Record<string, DailyData>) => void): Unsubscribe => {
  const q = query(
    collection(db, 'users', userId, 'dailyData'),
    orderBy('updatedAt', 'desc')
  );
  return onSnapshot(q, (querySnapshot: QuerySnapshot) => {
    const data: Record<string, DailyData> = {};
    querySnapshot.forEach((doc) => {
      data[doc.id] = doc.data() as DailyData;
    });
    callback(data);
  });
};

// Admin functions
export const getAllUsers = async (): Promise<Array<{uid: string, email: string, name: string, isBlocked: boolean}>> => {
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users: Array<{uid: string, email: string, name: string, isBlocked: boolean}> = [];
    
    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      // Filter out deleted users
      if (!data.isDeleted) {
        users.push({
          uid: doc.id,
          email: data.email || '',
          name: data.name || '',
          isBlocked: data.isBlocked || false
        });
      }
    });
    
    return users;
  } catch (error) {
    throw error;
  }
};

export const updateUserBlockStatus = async (userId: string, isBlocked: boolean): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, { isBlocked }, { merge: true });
  } catch (error) {
    throw error;
  }
};

export const resetUserDailyData = async (userId: string, date: string): Promise<void> => {
  try {
    const dailyDataRef = doc(db, 'users', userId, 'dailyData', date);
    await setDoc(dailyDataRef, {
      date,
      completedJobs: [],
      lossTimeEntries: [],
      isFinished: false,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    throw error;
  }
};

export const deleteUser = async (userId: string): Promise<void> => {
  try {
    // Delete user profile
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, { isDeleted: true, deletedAt: serverTimestamp() }, { merge: true });
    
    // Note: We're marking the user as deleted rather than completely removing the document
    // This preserves data integrity and allows for potential recovery
  } catch (error) {
    throw error;
  }
}; 