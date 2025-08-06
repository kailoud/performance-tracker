import React, { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Clock, Target, CheckCircle, AlertCircle, StopCircle, Plus, Trash2, Download, Calendar, X, LogOut, Timer, Play, Pause, Square, QrCode } from 'lucide-react';
import jsPDF from 'jspdf';
import { 
  signIn, 
  signUp, 
  signOutUser, 
  onAuthChange,
  saveDailyData,
  getAllDailyData,
  saveUserProfile,
  getUserProfile,
  getAllUsers,
  updateUserBlockStatus,
  resetUserDailyData,
  deleteUser,
  resetPassword
} from '../firebaseService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Helper function to remove undefined values from objects
const removeUndefinedValues = (obj: any): any => {
  const cleaned: any = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      if (Array.isArray(obj[key])) {
        // For arrays, clean each item
        cleaned[key] = obj[key].map((item: any) => 
          typeof item === 'object' && item !== null 
            ? removeUndefinedValues(item) 
            : item
        ).filter((item: any) => item !== undefined);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        // For objects, recursively clean
        cleaned[key] = removeUndefinedValues(obj[key]);
      } else {
        // For primitive values, just copy if not undefined
        cleaned[key] = obj[key];
      }
    }
  }
  return cleaned;
};

// TypeScript interfaces
interface ProductionItem {
  itemCode: string;
  lmCode: string;
  quantity: number;
  time: number;
}

interface CompletedJob extends ProductionItem {
  unitsCompleted: number;
  completionPercentage: number;
  actualMinutes: number;
  timestamp: string;
  id: number;
  actualTimeTaken?: number; // in seconds, optional for timer tracking
}

interface TimerState {
  isActive: boolean;
  isPaused: boolean;
  startTime: number;
  pausedTime: number;
  elapsedTime: number;
  expectedTime: number; // in minutes
  itemCode: string;
  lmCode: string;
  isVisible: boolean;
}



interface LossTimeEntry {
  reason: string;
  minutes: number;
  timestamp: string;
  id: number;
}

interface DailyData {
  date: string;
  completedJobs: CompletedJob[];
  lossTimeEntries: LossTimeEntry[];
  isFinished: boolean;
  finishTime?: string;
}

const ProductionTracker = () => {
  // Date selection state
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [allDailyData, setAllDailyData] = useState<Record<string, DailyData>>({});
  const [isSwitchingDate, setIsSwitchingDate] = useState(false);
  
  // Time and access control state
  const [isWithinWorkingHoursState, setIsWithinWorkingHoursState] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); // You can set this based on user role
  
  // Admin panel state
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [allUsers, setAllUsers] = useState<Array<{uid: string, email: string, name: string, isBlocked: boolean}>>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  
  // User data editing state
  const [showUserDataEditor, setShowUserDataEditor] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<{uid: string, email: string, name: string} | null>(null);
  const [editingUserData, setEditingUserData] = useState<Record<string, DailyData>>({});
  const [editingSelectedDate, setEditingSelectedDate] = useState<string>('');
  const [isLoadingUserData, setIsLoadingUserData] = useState(false);
  
  // Inline editing state
  const [editingJobId, setEditingJobId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<string>('');
  const [editingValue, setEditingValue] = useState<string>('');
  
  const [completedJobs, setCompletedJobs] = useState<CompletedJob[]>([]);
  const [selectedItem, setSelectedItem] = useState('');
  const [completedQuantity, setCompletedQuantity] = useState('');
  const [searchMode, setSearchMode] = useState('dropdown');
  const [searchInput, setSearchInput] = useState('');
  
  // User authentication state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [loginName, setLoginName] = useState('');
  const [userId, setUserId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  
  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  
  // Loss Time tracking
  const [lossTimeEntries, setLossTimeEntries] = useState<LossTimeEntry[]>([]);
  const [selectedLossReason, setSelectedLossReason] = useState('');
  const [lossTimeMinutes, setLossTimeMinutes] = useState('');
  const [showLossTimeForm, setShowLossTimeForm] = useState(false);
  
  // Timer state
  const [timerState, setTimerState] = useState<TimerState>(() => {
    // Load timer state from localStorage on component mount
    const savedTimer = localStorage.getItem('productionTimer');
    if (savedTimer) {
      const parsed = JSON.parse(savedTimer);
      // Check if timer was active when saved
      if (parsed.isActive && !parsed.isPaused) {
        // Calculate elapsed time since last save
        const timeSinceLastSave = Date.now() - parsed.lastSaveTime;
        return {
          ...parsed,
          elapsedTime: parsed.elapsedTime + timeSinceLastSave,
          isVisible: false // Don't show timer on load, user can open it
        };
      }
      return { ...parsed, isVisible: false };
    }
    return {
      isActive: false,
      isPaused: false,
      startTime: 0,
      pausedTime: 0,
      elapsedTime: 0,
      expectedTime: 0,
      itemCode: '',
      lmCode: '',
      isVisible: false
    };
  });
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Auto-completion notification state
  const [showAutoCompletionModal, setShowAutoCompletionModal] = useState(false);
  const [autoCompletionData, setAutoCompletionData] = useState<any>(null);
  const [autoCompletionUnits, setAutoCompletionUnits] = useState('');
  
  // Browser notification state
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  
  // Banner notification state
  const [showTimeExceededBanner, setShowTimeExceededBanner] = useState(false);
  const [bannerData, setBannerData] = useState<any>(null);
  

  
  // Calendar modal state
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<string>('');
  
  // QR Code modal state
  const [showQRModal, setShowQRModal] = useState(false);
  
  // Network connectivity state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [networkIssues, setNetworkIssues] = useState<string[]>([]);
  
  // Search suggestions state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredItems, setFilteredItems] = useState<ProductionItem[]>([]);
  
  // Data saving state
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveTimeoutId, setSaveTimeoutId] = useState<NodeJS.Timeout | null>(null);
  
  // Data loading state to prevent percentage fluctuation on refresh
  const [isDataLoading, setIsDataLoading] = useState(false);

  const lossReasons = [
    'Waiting for Parts', 'Waiting Jobs', 'Cleaning', 'Maintenance', 
    'Machine Error', 'Needle Change', 'Full Track', 'Back Rack', 'Other'
  ];

  // Firebase authentication effect
  useEffect(() => {
    const unsubscribe = onAuthChange(async (user: any) => {
      if (user) {
        try {
          // Check if user is deleted or blocked
          const userRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            
            if (userData.isDeleted) {
              // Sign out deleted user
              await signOutUser();
              setAuthError('This account has been deleted. Please sign up again.');
              setIsLoggedIn(false);
              setUserEmail('');
              setUserName('');
              setUserId('');
              setAllDailyData({});
              setIsLoading(false);
              return;
            }
            
            if (userData.isBlocked) {
              // Sign out blocked user
              await signOutUser();
              setAuthError('This account has been blocked. Please contact an administrator.');
              setIsLoggedIn(false);
              setUserEmail('');
              setUserName('');
              setUserId('');
              setAllDailyData({});
              setIsLoading(false);
              return;
            }
          }
          
          // User is valid, proceed with login
          setIsLoggedIn(true);
          setUserEmail(user.email || '');
          setUserId(user.uid);
                  loadUserProfile(user.uid);
        loadAllDailyData(user.uid);
        // eslint-disable-next-line react-hooks/exhaustive-deps
        checkActiveTimer(); // Check for active timer on login
        } catch (error) {
          console.error('Error checking user status:', error);
          // If there's an error checking user status, sign out to be safe
          await signOutUser();
          setAuthError('Error verifying account status. Please try again.');
          setIsLoggedIn(false);
          setUserEmail('');
          setUserName('');
          setUserId('');
          setAllDailyData({});
        }
      } else {
        setIsLoggedIn(false);
        setUserEmail('');
        setUserName('');
        setUserId('');
        setAllDailyData({});
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check for active timer on login
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const checkActiveTimer = useCallback(() => {
    const savedTimer = localStorage.getItem('productionTimer');
    if (savedTimer) {
      const parsed = JSON.parse(savedTimer);
      if (parsed.isActive && parsed.itemCode) {
        const elapsedMinutes = parsed.elapsedTime / 60000;
        const expectedMinutes = parsed.expectedTime;
        
        // If timer has exceeded expected time by 1 minute, auto-complete the job
        if (elapsedMinutes >= expectedMinutes + 1) {
          console.log('Timer exceeded expected time by 1 minute, auto-completing job');
          autoCompleteJob(parsed);
        } else {
          // Show notification about active timer
          setTimeout(() => {
            alert(`⏱️ Active timer found for ${parsed.itemCode} - ${parsed.lmCode}\n\nElapsed time: ${Math.floor(elapsedMinutes)}:${Math.floor((elapsedMinutes % 1) * 60).toString().padStart(2, '0')}\n\nClick "Show Timer" to continue tracking.`);
          }, 1000);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load user profile
  const loadUserProfile = async (uid: string) => {
    try {
      const profile = await getUserProfile(uid);
      if (profile) {
        setUserName(profile.name || '');
        
        // Set admin status based on email (you can modify this logic)
        // For now, let's set admin based on specific email addresses
        const adminEmails = ['kailoud639@gmail.com', 'admin@company.com', 'manager@company.com']; // Add your admin emails
        setIsAdmin(adminEmails.includes(profile.email));
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      return permission;
    }
    return 'denied';
  };

  // Show browser notification
  const showBrowserNotification = (title: string, body: string) => {
    if ('Notification' in window && notificationPermission === 'granted') {
      new Notification(title, {
        body: body,
        icon: '/bike.png', // Use the app icon
        badge: '/bike.png',
        tag: 'timer-notification'
      });
    }
  };

  // Show auto-completion modal when timer exceeds expected time
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const triggerAutoCompletionModal = useCallback((timerData: any) => {
    const item = productionData.find(p => p.itemCode === timerData.itemCode);
    if (item) {
      setAutoCompletionData({ ...timerData, item });
      setAutoCompletionUnits(item.quantity.toString()); // Default to full quantity
      setShowAutoCompletionModal(true);
      
      // Show banner notification
      setBannerData({ ...timerData, item });
      setShowTimeExceededBanner(true);
      
      // Show browser notification if page is not visible
      if (document.hidden) {
        showBrowserNotification(
          '⏰ Timer Exceeded',
          `${timerData.itemCode} - ${timerData.lmCode}\nExpected time exceeded by ${Math.round((timerData.elapsedTime / 60000) - timerData.expectedTime)} minutes`
        );
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBrowserNotification]);

  // Handle auto-completion job submission
  const handleAutoCompletionSubmit = () => {
    if (!autoCompletionData || !autoCompletionUnits) return;
    
    const unitsCompleted = parseInt(autoCompletionUnits);
    if (unitsCompleted <= 0) {
      alert('Please enter a valid quantity greater than 0');
      return;
    }

    const item = autoCompletionData.item;
    const completionPercentage = unitsCompleted / item.quantity;
    const actualMinutes = autoCompletionData.expectedTime; // Use expected time as actual
    
    const newJob: CompletedJob = {
      ...item,
      unitsCompleted,
      completionPercentage,
      actualMinutes,
      actualTimeTaken: autoCompletionData.elapsedTime / 1000, // Convert to seconds
      timestamp: new Date().toLocaleTimeString(),
      id: Date.now()
    };

    const updatedJobs = [...completedJobs, newJob];
    setCompletedJobs(updatedJobs);

    // Save to Firebase
    if (userId && selectedDate) {
      const dailyData: any = {
        date: selectedDate,
        completedJobs: updatedJobs,
        lossTimeEntries,
        isFinished: allDailyData[selectedDate]?.isFinished || false
      };
      
      // Only add finishTime if it exists (avoid undefined values)
      const existingFinishTime = allDailyData[selectedDate]?.finishTime;
      if (existingFinishTime) {
        dailyData.finishTime = existingFinishTime;
      }
      
      const cleanedData = removeUndefinedValues(dailyData);
      saveDailyData(userId, selectedDate, cleanedData).then(() => {
        setAllDailyData(prev => ({
          ...prev,
          [selectedDate]: dailyData
        }));
      }).catch(error => {
        console.error('Error completing job:', error);
      });
    }

    // Clear timer state
    setTimerState({
      isActive: false,
      isPaused: false,
      startTime: 0,
      pausedTime: 0,
      elapsedTime: 0,
      expectedTime: 0,
      itemCode: '',
      lmCode: '',
      isVisible: false
    });
    
    // Clear localStorage
    localStorage.removeItem('productionTimer');
    
    // Close modal
    setShowAutoCompletionModal(false);
    setAutoCompletionData(null);
    setAutoCompletionUnits('');
  };

  // Auto-complete job when timer exceeds expected time (legacy function for immediate completion)
  const autoCompleteJob = (timerData: any) => {
    triggerAutoCompletionModal(timerData);
  };

  // Load all daily data for user
  const loadAllDailyData = async (uid: string) => {
    try {
      setIsDataLoading(true);
      const data = await getAllDailyData(uid);
      setAllDailyData(data);
    } catch (error) {
      console.error('Error loading daily data:', error);
    } finally {
      setIsDataLoading(false);
    }
  };
  
  const productionData: ProductionItem[] = [
    { itemCode: "B102823", lmCode: "AHOOK-TI", quantity: 100, time: 33.3 },
    { itemCode: "B105003", lmCode: "AL-SPTQRA-BK", quantity: 12, time: 9 },
    { itemCode: "B100128", lmCode: "BRCALA-B75F", quantity: 100, time: 60 },
    { itemCode: "B100129", lmCode: "BRCALA-B75R", quantity: 100, time: 60 },
    { itemCode: "B100131", lmCode: "BRCALFRONT", quantity: 100, time: 60 },
    { itemCode: "B102031", lmCode: "BRCALREAR", quantity: 100, time: 60 },
    { itemCode: "B104283", lmCode: "BRLEVA-BELL[2]", quantity: 25, time: 20 },
    { itemCode: "B104284", lmCode: "BRLEVA-BELL[2]-BK", quantity: 25, time: 20 },
    { itemCode: "B101833", lmCode: "BRLEVA-L2", quantity: 40, time: 25 },
    { itemCode: "B101834", lmCode: "BRLEVA-L2-BK", quantity: 40, time: 25 },
    { itemCode: "B104292", lmCode: "BRLEVA-R3[2]", quantity: 40, time: 55 },
    { itemCode: "B104293", lmCode: "BRLEVA-R3[2]-BK", quantity: 40, time: 55 },
    { itemCode: "B103941", lmCode: "Cateye-volt500-pk", quantity: 40, time: 55 },
    { itemCode: "B101984", lmCode: "CHPUA", quantity: 120, time: 90 },
    { itemCode: "B101838", lmCode: "CHPULEGA", quantity: 60, time: 12 },
    { itemCode: "B101999", lmCode: "CTA", quantity: 50, time: 125 },
    { itemCode: "B102000", lmCode: "CTADR", quantity: 50, time: 70 },
    { itemCode: "B109610", lmCode: "CTE-VOLT60-PK", quantity: 40, time: 55 },
    { itemCode: "B100236", lmCode: "E-BRCALFRONT", quantity: 100, time: 60 },
    { itemCode: "B100237", lmCode: "E-BRCALREAR", quantity: 100, time: 60 },
    { itemCode: "B101965", lmCode: "E-BRPADA-LH", quantity: 100, time: 35 },
    { itemCode: "B101964", lmCode: "E-BRPADA-RH", quantity: 100, time: 35 },
    { itemCode: "B103660", lmCode: "E-RLAMSOLO[2]-PF-L", quantity: 40, time: 80 },
    { itemCode: "B103594", lmCode: "E-RLAMSOLO[2]-PF-RR", quantity: 40, time: 80 },
    { itemCode: "B101810", lmCode: "E-RLAMSOLO-BKA", quantity: 40, time: 80 },
    { itemCode: "B110615", lmCode: "G-BRLEVA-8SPD", quantity: 25, time: 77.4 },
    { itemCode: "B102032", lmCode: "GCABLEGA", quantity: 120, time: 140 },
    { itemCode: "B113992", lmCode: "G-Cateye-DE-PAC", quantity: 30, time: 58.31 },
    { itemCode: "B103898", lmCode: "G-CTA", quantity: 30, time: 58.31 },
    { itemCode: "B106307", lmCode: "GE-CTADR", quantity: 40, time: 33 },
    { itemCode: "B113409", lmCode: "GE-F-LIGHT-PAC", quantity: 50, time: 33.25 },
    { itemCode: "B113431", lmCode: "G-HECTO-500-PAC", quantity: 30, time: 88.35 },
    { itemCode: "B111305", lmCode: "G-HRA-KIT", quantity: 50, time: 35 },
    { itemCode: "B114172", lmCode: "G-Lamp-DE-PAC", quantity: 100, time: 33.52 },
    { itemCode: "B103967", lmCode: "G-MGRRA", quantity: 25, time: 21.7 },
    { itemCode: "B110261", lmCode: "G-RFCLIPDISC", quantity: 150, time: 22.5 },
    { itemCode: "B113434", lmCode: "G-SADLAMP-150-PAC", quantity: 80, time: 121.204 },
    { itemCode: "B103858", lmCode: "G-SHA", quantity: 24, time: 50 },
    { itemCode: "B114148", lmCode: "G-Shimano-Airline-Kit", quantity: 100, time: 50 },
    { itemCode: "B101835", lmCode: "GTRIGB3A", quantity: 50, time: 50 },
    { itemCode: "B101949", lmCode: "HBC-SPR-A", quantity: 120, time: 24 },
    { itemCode: "B101891", lmCode: "HCA", quantity: 45, time: 18 },
    { itemCode: "B104151", lmCode: "HCA[2]-BK-CE", quantity: 45, time: 18 },
    { itemCode: "B104152", lmCode: "HCA[2]-BK-PPE", quantity: 45, time: 18 },
    { itemCode: "B101992", lmCode: "HCA-AL-BK", quantity: 45, time: 10 },
    { itemCode: "B101938", lmCode: "HCA-AL-SV", quantity: 45, time: 10 },
    { itemCode: "B101893", lmCode: "HCA-BK", quantity: 45, time: 18 },
    { itemCode: "B101903", lmCode: "HCLEVA", quantity: 100, time: 60 },
    { itemCode: "B112507", lmCode: "LO-WHEEL-REF", quantity: 50, time: 37 },
    { itemCode: "B102003", lmCode: "LSDA", quantity: 180, time: 23 },
    { itemCode: "B112509", lmCode: "MED-WHEEL-REF-OR", quantity: 100, time: 70.5 },
    { itemCode: "B101991", lmCode: "MGFA[2]-BK", quantity: 60, time: 35 },
    { itemCode: "B101787", lmCode: "MGFA[2]-SV", quantity: 60, time: 25 },
    { itemCode: "B103607", lmCode: "MGFA[3]-P", quantity: 60, time: 35 },
    { itemCode: "B111530", lmCode: "MGFA[4]-PE/CE", quantity: 60, time: 35 },
    { itemCode: "B101735", lmCode: "MGRLA-BK", quantity: 60, time: 65 },
    { itemCode: "B101789", lmCode: "MGRLA-SV", quantity: 60, time: 48 },
    { itemCode: "B101737", lmCode: "MGROLA-BK", quantity: 120, time: 54 },
    { itemCode: "B101920", lmCode: "MGROLA-SV", quantity: 60, time: 27 },
    { itemCode: "B103618", lmCode: "MGRRA[2]-P", quantity: 50, time: 65 },
    { itemCode: "B101918", lmCode: "MGRRA-BK", quantity: 50, time: 65 },
    { itemCode: "B101917", lmCode: "MGRRA-SV", quantity: 50, time: 50 },
    { itemCode: "B101918A", lmCode: "RCW[2]", quantity: 15, time: 40 },
    { itemCode: "B101948", lmCode: "RCW[2]-BK", quantity: 15, time: 40 },
    { itemCode: "B103029", lmCode: "REF-AUX", quantity: 100, time: 50 },
    { itemCode: "B103709", lmCode: "REFBKTA-BKA-RR[2]-P", quantity: 60, time: 30 },
    { itemCode: "B101800", lmCode: "REFBKTA-F", quantity: 60, time: 25 },
    { itemCode: "B101805", lmCode: "REFBKTA-F-CATEYE", quantity: 70, time: 49 },
    { itemCode: "B102073", lmCode: "REFBKTA-RNR-BK", quantity: 60, time: 30 },
    { itemCode: "B102072", lmCode: "REFBKTA-RNR-SV", quantity: 60, time: 30 },
    { itemCode: "B102082", lmCode: "REFBKTA-RR-BK", quantity: 60, time: 30 },
    { itemCode: "B101922", lmCode: "RFCLIPPDISCA", quantity: 120, time: 20 },
    { itemCode: "B103616", lmCode: "RLAMSOLO-BAT-BKA[2]-P", quantity: 30, time: 18 },
    { itemCode: "B102076", lmCode: "RLAMSOLO-BAT-BKA-NR-BK", quantity: 50, time: 30 },
    { itemCode: "B102075", lmCode: "RLAMSOLO-BAT-BKA-NR-SV", quantity: 50, time: 30 },
    { itemCode: "B102084", lmCode: "RLAMSOLO-BAT-BKA-R", quantity: 50, time: 30 },
    { itemCode: "B102079", lmCode: "RLAMSOLO-DYNG-BKA-NR-BK", quantity: 40, time: 60 },
    { itemCode: "B102078", lmCode: "RLAMSOLO-DYNG-BKA-NR-SV", quantity: 40, time: 60 },
    { itemCode: "B102080", lmCode: "RLAMSOLO-DYNG-BKA-R-SV", quantity: 40, time: 60 },
    { itemCode: "B102096", lmCode: "RVMGRB-BK", quantity: 1, time: 1.8 },
    { itemCode: "B102095", lmCode: "RVMGRB-SV", quantity: 1, time: 1.8 },
    { itemCode: "B104302", lmCode: "SADBRK-MA[2]-BK", quantity: 14, time: 24 },
    { itemCode: "B101906", lmCode: "SCQRA", quantity: 80, time: 46.6 },
    { itemCode: "B101829", lmCode: "SPQRA-BK", quantity: 50, time: 15 },
    { itemCode: "B101769", lmCode: "SP6PA-BK", quantity: 50, time: 15 },
    { itemCode: "B101840", lmCode: "SPRTUBDRZ", quantity: 60, time: 13.2 },
    { itemCode: "B107485", lmCode: "SPTCBA[3]-BKE", quantity: 45, time: 35 },
    { itemCode: "B103030", lmCode: "SPTPA[2]-BK", quantity: 50, time: 15 },
    { itemCode: "B101772", lmCode: "SPTQRA[2]", quantity: 45, time: 35 },
    { itemCode: "B101773", lmCode: "SPTQRA[2]-BK", quantity: 45, time: 35 },
    { itemCode: "B103414", lmCode: "UL-BRLEVA-L4-BK", quantity: 40, time: 25 },
    { itemCode: "B103447", lmCode: "UL-CTA", quantity: 40, time: 60 },
    { itemCode: "B103368", lmCode: "UL-CTADR", quantity: 40, time: 35 },
    { itemCode: "B103412", lmCode: "UL-HCA", quantity: 48, time: 30 },
    { itemCode: "B102781", lmCode: "UL-MGFA[3]-CA", quantity: 60, time: 35 },
    { itemCode: "B103720", lmCode: "UL-MGRA-BK-STEEL", quantity: 1, time: 1.7 },
    { itemCode: "B102787", lmCode: "UL-MGRA-BK-TI", quantity: 1, time: 1.7 },
    { itemCode: "B102785", lmCode: "UL-MGRBA-BK", quantity: 50, time: 55 },
    { itemCode: "B103673", lmCode: "UL-REFBKTA-RNR-BK", quantity: 50, time: 30 },
    { itemCode: "B102610", lmCode: "UL-RFCLIPPDISCA", quantity: 150, time: 22.5 },
    { itemCode: "B103457", lmCode: "UL-RLAMSOLO-BAT-L-BK", quantity: 25, time: 20 },
    { itemCode: "B103438", lmCode: "UL-SHA", quantity: 24, time: 50 },
    { itemCode: "WHEELS", lmCode: "W-01 - W-52", quantity: 30, time: 65 },
    { itemCode: "N/A", lmCode: "HUB-F", quantity: 30, time: 55 },
    { itemCode: "B103026", lmCode: "WHEEL-REF", quantity: 100, time: 70.5 },
    { itemCode: "B112505", lmCode: "WHEEL-REF-OR", quantity: 100, time: 70.5 }
  ];

  const TARGET_MINUTES = 525;

  // Time and access control functions
  const isWithinWorkingHours = (date: Date): boolean => {
    // TEMPORARILY DISABLED FOR TESTING - Always return true
    return true;
    
    // Original logic (commented out for testing):
    // const hours = date.getHours();
    // const minutes = date.getMinutes();
    // const currentTime = hours * 60 + minutes;
    // const startTime = 6 * 60 + 55; // 06:55 AM
    // const endTime = 16 * 60 + 35; // 16:35 PM (4:35 PM)
    // return currentTime >= startTime && currentTime <= endTime;
  };

  const isWorkingDay = (date: Date): boolean => {
    // TEMPORARILY DISABLED FOR TESTING - Always return true
    return true;
    
    // Original logic (commented out for testing):
    // const day = date.getDay();
    // return day >= 1 && day <= 4; // Monday (1) to Thursday (4)
  };

  const canAccessDate = (dateString: string): boolean => {
    // TEMPORARILY DISABLED FOR TESTING - Always allow access to all dates
    return true;
    
    // Original logic (commented out for testing):
    // const date = new Date(dateString);
    // const today = new Date();
    // const todayString = today.toISOString().split('T')[0];
    // 
    // // Check if it's a working day
    // if (!isWorkingDay(date)) return false;
    // 
    // // Admin can access all dates
    // if (isAdmin) return true;
    // 
    // // For past dates, always allow access
    // if (date < today) return true;
    // 
    // // For today, only allow access during working hours
    // if (dateString === todayString) {
    //   return isWithinWorkingHours(today);
    // }
    // 
    // // For future dates, implement sequential access
    // const workingDays = getWorkingDays();
    // const todayIndex = workingDays.indexOf(todayString);
    // const dateIndex = workingDays.indexOf(dateString);
    // 
    // if (todayIndex === -1 || dateIndex === -1) return false;
    // 
    // // Only allow access to the next sequential working day
    // if (dateIndex === todayIndex + 1) {
    //   // Check if current day is finished
    //   const currentDayData = allDailyData[workingDays[todayIndex]];
    //   if (currentDayData?.isFinished) {
    //     // Current day is finished, allow access to next day during working hours
    //     return isWithinWorkingHours(today);
    //   }
    //   return false; // Current day not finished, no access to next day
    // }
    // 
    // // For dates beyond the next sequential day, no access
    // return false;
  };

  // Update current time every minute
  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const isWorkingDayToday = isWorkingDay(now);
      const isWithinHours = isWithinWorkingHours(now);
      setIsWithinWorkingHoursState(isWorkingDayToday && isWithinHours);
    };
    
    updateTime(); // Initial call
    const interval = setInterval(updateTime, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);

  // Helper functions for date management
  const getWorkingDays = (): string[] => {
    const today = new Date();
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - today.getDay() + 1); // Monday
    
    const workingDays: string[] = [];
    for (let i = 0; i < 4; i++) { // Monday to Thursday
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      workingDays.push(date.toISOString().split('T')[0]);
    }
    return workingDays;
  };

  const formatDateForDisplay = (dateString: string): string => {
    const date = new Date(dateString);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return `${dayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}`;
  };

  const getCurrentDateKey = (): string => {
    return new Date().toISOString().split('T')[0];
  };

  // Check if the current week is complete (all working days finished)
  const isWeekComplete = (): boolean => {
    const workingDays = getWorkingDays();
    return workingDays.every(day => allDailyData[day]?.isFinished);
  };

  // Get the current week's data for summary
  const getCurrentWeekData = () => {
    const workingDays = getWorkingDays();
    const weekData = workingDays.map(day => allDailyData[day]).filter(Boolean);
    
    const totalCompletedMinutes = weekData.reduce((sum, day) => 
      sum + day.completedJobs.reduce((jobSum, job) => jobSum + job.actualMinutes, 0), 0
    );
    
    const totalLossTime = weekData.reduce((sum, day) => 
      sum + day.lossTimeEntries.reduce((entrySum, entry) => entrySum + entry.minutes, 0), 0
    );
    
    const totalJobs = weekData.reduce((sum, day) => sum + day.completedJobs.length, 0);
    
    return {
      totalCompletedMinutes,
      totalLossTime,
      totalJobs,
      daysCompleted: weekData.length
    };
  };

  // Reset function to start a new week
  const resetWeek = () => {
    const workingDays = getWorkingDays();
    const nextWeekStart = new Date(workingDays[0]);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7); // Move to next Monday
    
    const nextWeekDays: string[] = [];
    for (let i = 0; i < 4; i++) {
      const date = new Date(nextWeekStart);
      date.setDate(nextWeekStart.getDate() + i);
      nextWeekDays.push(date.toISOString().split('T')[0]);
    }
    
    // Clear current week data and switch to next week
    setAllDailyData(prev => {
      const newData = { ...prev };
      workingDays.forEach(day => {
        delete newData[day];
      });
      return newData;
    });
    
    // Switch to the first day of next week
    setSelectedDate(nextWeekDays[0]);
    setCompletedJobs([]);
    setLossTimeEntries([]);
    setSelectedItem('');
    setCompletedQuantity('');
    setSearchInput('');
    setSelectedLossReason('');
    setLossTimeMinutes('');
    setShowLossTimeForm(false);
    
    alert(`Week completed! Starting new week: ${formatDateForDisplay(nextWeekDays[0])} to ${formatDateForDisplay(nextWeekDays[3])}`);
  };

  // Initialize selected date if not set and handle automatic week progression
  React.useEffect(() => {
    if (!selectedDate && isLoggedIn) {
      const today = getCurrentDateKey();
      const workingDays = getWorkingDays();
      
      // Check if current week is complete and we should move to next week
      const isCurrentWeekComplete = workingDays.every(day => allDailyData[day]?.isFinished);
      const isCurrentWeekInProgress = workingDays.some(day => allDailyData[day] && !allDailyData[day].isFinished);
      
      if (isCurrentWeekComplete && !isCurrentWeekInProgress) {
        // Move to next week
        const nextWeekStart = new Date(workingDays[0]);
        nextWeekStart.setDate(nextWeekStart.getDate() + 7);
        
        const nextWeekDays: string[] = [];
        for (let i = 0; i < 4; i++) {
          const date = new Date(nextWeekStart);
          date.setDate(nextWeekStart.getDate() + i);
          nextWeekDays.push(date.toISOString().split('T')[0]);
        }
        
        setSelectedDate(nextWeekDays[0]);
      } else if (workingDays.includes(today)) {
        setSelectedDate(today);
      } else {
        setSelectedDate(workingDays[0]); // Default to Monday
      }
    }
  }, [isLoggedIn, selectedDate, allDailyData]);

  // Load data for selected date
  React.useEffect(() => {
    if (selectedDate && !isDataLoading) {
      if (allDailyData[selectedDate]) {
        setCompletedJobs(allDailyData[selectedDate].completedJobs);
        setLossTimeEntries(allDailyData[selectedDate].lossTimeEntries);
      } else {
        setCompletedJobs([]);
        setLossTimeEntries([]);
      }
    }
  }, [selectedDate, allDailyData, isDataLoading]);

  // Save data when it changes (with debouncing)
  React.useEffect(() => {
    if (selectedDate && !isSwitchingDate && !isDataLoading && userId && (completedJobs.length > 0 || lossTimeEntries.length > 0)) {
      // Clear any existing timeout
      if (saveTimeoutId) {
        clearTimeout(saveTimeoutId);
      }

      // Debounce the save operation
      const timeoutId = setTimeout(() => {
        // Create new data structure without depending on allDailyData inside effect
        setAllDailyData(prev => {
          const currentData = prev[selectedDate];
          const dailyData: any = {
            date: selectedDate,
            completedJobs,
            lossTimeEntries,
            isFinished: currentData?.isFinished || false
          };

          // Only add finishTime if it exists (avoid undefined values)
          if (currentData?.finishTime) {
            dailyData.finishTime = currentData.finishTime;
          }

          // Save to Firebase automatically with status indicator
          setIsSaving(true);
          const cleanedData = removeUndefinedValues(dailyData);
          saveDailyData(userId, selectedDate, cleanedData)
            .then(() => {
              setLastSaved(new Date());
              setIsSaving(false);
            })
            .catch(error => {
              console.error('Error auto-saving data:', error);
              setIsSaving(false);
            });

          return {
            ...prev,
            [selectedDate]: dailyData
          };
        });
      }, 1000); // 1 second delay

      setSaveTimeoutId(timeoutId);

      // Cleanup function
      return () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };
    }
  }, [completedJobs, lossTimeEntries, selectedDate, isSwitchingDate, isDataLoading, userId, saveTimeoutId]);

  const completedMinutes = completedJobs.reduce((sum, job) => sum + job.actualMinutes, 0);
  const lossTimeTotal = lossTimeEntries.reduce((sum, entry) => sum + entry.minutes, 0);
  const adjustedTarget = TARGET_MINUTES - lossTimeTotal; // Reduce target by loss time
  const completedPercentage = adjustedTarget > 0 ? Math.min((completedMinutes / adjustedTarget) * 100, 100) : 100;
  const remainingMinutes = Math.max(adjustedTarget - completedMinutes, 0);

  const handleSubmit = async () => {
    if (!userId || !selectedDate) return;
    
    let item;
    
    if (searchMode === 'dropdown') {
      item = productionData.find(p => p.itemCode === selectedItem);
    } else {
      item = productionData.find(p => p.itemCode.toUpperCase() === searchInput.toUpperCase());
      if (!item) {
        alert('Item code not found. Please check the code and try again.');
        return;
      }
    }
    
    if (!item || !completedQuantity) return;

    const unitsCompleted = parseInt(completedQuantity);
    if (unitsCompleted <= 0) {
      alert('Please enter a valid quantity greater than 0');
      return;
    }

    const completionPercentage = unitsCompleted / item.quantity;
    const actualMinutes = item.time * completionPercentage;

    const newJob: CompletedJob = {
      ...item,
      unitsCompleted,
      completionPercentage,
      actualMinutes,
      actualTimeTaken: timerState.isActive ? timerState.elapsedTime / 1000 : undefined,
      timestamp: new Date().toLocaleTimeString(),
      id: Date.now()
    };

    const updatedJobs = [...completedJobs, newJob];
    setCompletedJobs(updatedJobs);

    // Update local state immediately for better UX
    setAllDailyData(prev => ({
      ...prev,
      [selectedDate]: {
        date: selectedDate,
        completedJobs: updatedJobs,
        lossTimeEntries,
        isFinished: prev[selectedDate]?.isFinished || false,
        finishTime: prev[selectedDate]?.finishTime
      }
    }));

    // The debounced auto-save will handle Firebase saving

    setSelectedItem('');
    setCompletedQuantity('');
    setSearchInput('');
  };

  const getCurrentItem = (): ProductionItem | null => {
    if (searchMode === 'dropdown' && selectedItem) {
      return productionData.find(p => p.itemCode === selectedItem) || null;
    } else if (searchMode === 'search' && searchInput) {
      return productionData.find(p => p.itemCode.toUpperCase() === searchInput.toUpperCase()) || null;
    }
    return null;
  };

  // Handle search input changes
  const handleSearchInputChange = (value: string) => {
    setSearchInput(value);
    
    if (value.trim() === '') {
      setFilteredItems([]);
      setShowSuggestions(false);
      return;
    }
    
    const filtered = productionData.filter(item => 
      item.itemCode.toUpperCase().includes(value.toUpperCase()) ||
      item.lmCode.toUpperCase().includes(value.toUpperCase())
    );
    
    setFilteredItems(filtered);
    setShowSuggestions(filtered.length > 0);
    
    // Auto-select if exact match is found
    const exactMatch = productionData.find(item => 
      item.itemCode.toUpperCase() === value.toUpperCase()
    );
    
    if (exactMatch) {
      setSelectedItem(exactMatch.itemCode);
      setShowSuggestions(false);
    } else {
      setSelectedItem('');
    }
  };

  // Handle item selection from suggestions
  const handleItemSelect = (item: ProductionItem) => {
    console.log('Item selected:', item); // Debug log
    setSearchInput(item.itemCode);
    setSelectedItem(item.itemCode);
    setShowSuggestions(false);
    setFilteredItems([]);
    
    // Only show timer popup during working hours or if admin
    if (isWithinWorkingHoursState || isAdmin) {
      // Show timer popup for the selected item
      setTimerState(prev => {
        console.log('Setting timer state:', { ...prev, isVisible: true, expectedTime: item.time, itemCode: item.itemCode, lmCode: item.lmCode }); // Debug log
        return {
          ...prev,
          isVisible: true,
          expectedTime: item.time,
          itemCode: item.itemCode,
          lmCode: item.lmCode,
          isActive: false,
          isPaused: false,
          startTime: 0,
          pausedTime: 0,
          elapsedTime: 0
        };
      });
    }
  };

  // Handle dropdown item selection
  const handleDropdownSelect = (itemCode: string) => {
    console.log('Dropdown item selected:', itemCode); // Debug log
    setSelectedItem(itemCode);
    
    if (itemCode) {
      const item = productionData.find(p => p.itemCode === itemCode);
      if (item) {
        console.log('Found item for dropdown:', item); // Debug log
        // Only show timer popup during working hours or if admin
        if (isWithinWorkingHoursState || isAdmin) {
          // Show timer popup for the selected item
          setTimerState(prev => {
            console.log('Setting timer state from dropdown:', { ...prev, isVisible: true, expectedTime: item.time, itemCode: item.itemCode, lmCode: item.lmCode }); // Debug log
            return {
              ...prev,
              isVisible: true,
              expectedTime: item.time,
              itemCode: item.itemCode,
              lmCode: item.lmCode,
              isActive: false,
              isPaused: false,
              startTime: 0,
              pausedTime: 0,
              elapsedTime: 0
            };
          });
        }
      }
    }
  };

  const handleLossTimeSubmit = async () => {
    if (!selectedLossReason || !lossTimeMinutes || !userId || !selectedDate) return;

    const minutes = parseInt(lossTimeMinutes);
    if (minutes <= 0) {
      alert('Please enter a valid time greater than 0');
      return;
    }

    const newLossEntry: LossTimeEntry = {
      reason: selectedLossReason,
      minutes: minutes,
      timestamp: new Date().toLocaleTimeString(),
      id: Date.now()
    };

    const updatedLossEntries = [...lossTimeEntries, newLossEntry];
    setLossTimeEntries(updatedLossEntries);

    // Update local state immediately for better UX
    setAllDailyData(prev => ({
      ...prev,
      [selectedDate]: {
        date: selectedDate,
        completedJobs,
        lossTimeEntries: updatedLossEntries,
        isFinished: prev[selectedDate]?.isFinished || false,
        finishTime: prev[selectedDate]?.finishTime
      }
    }));

    // The debounced auto-save will handle Firebase saving

    setSelectedLossReason('');
    setLossTimeMinutes('');
    setShowLossTimeForm(false);
  };

  const deleteLossTimeEntry = (id: number) => {
    setLossTimeEntries(prev => prev.filter(entry => entry.id !== id));
  };

  const finishWorkDay = async () => {
    if (!userId || !selectedDate) return;
    
    const finishTime = new Date().toLocaleTimeString();
    
    const dailyData = {
      date: selectedDate,
      completedJobs,
      lossTimeEntries,
      isFinished: true,
      finishTime
    };

    // Save to Firebase
    try {
      const cleanedData = removeUndefinedValues(dailyData);
      await saveDailyData(userId, selectedDate, cleanedData);
      
      // Update local state
      setAllDailyData(prev => ({
        ...prev,
        [selectedDate]: dailyData
      }));

      // Find next working day
      const workingDays = getWorkingDays();
      const currentIndex = workingDays.indexOf(selectedDate);
      const nextDay = workingDays[currentIndex + 1] || workingDays[0]; // Loop back to Monday if it's Thursday

      // Switch to next day and reset data
      setSelectedDate(nextDay);
      setCompletedJobs([]);
      setLossTimeEntries([]);
      setSelectedItem('');
      setCompletedQuantity('');
      setSearchInput('');
      setSelectedLossReason('');
      setLossTimeMinutes('');
      setShowLossTimeForm(false);

      // Show success message
      alert(`Work day finished! Data saved for ${formatDateForDisplay(selectedDate)}. Switched to ${formatDateForDisplay(nextDay)}.`);
    } catch (error) {
      console.error('Error finishing work day:', error);
    }
  };

  const downloadHistoricalPDF = async (dateString: string, dailyData: DailyData) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    
    // Title
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Production Tracker - Historical Data', pageWidth / 2, 30, { align: 'center' });
    
    // Date
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    const reportDate = formatDateForDisplay(dateString);
    pdf.text(`Date: ${reportDate}`, margin, 45);
    pdf.text(`User: ${userName}`, margin, 55);
    pdf.text(`Email: ${userEmail}`, margin, 65);
    
    let yPosition = 85;
    
    // Summary Statistics
    const completedMinutes = dailyData.completedJobs.reduce((sum, job) => sum + job.actualMinutes, 0);
    const lossTimeTotal = dailyData.lossTimeEntries.reduce((sum, entry) => sum + entry.minutes, 0);
    const adjustedTarget = TARGET_MINUTES - lossTimeTotal;
    const completedPercentage = adjustedTarget > 0 ? Math.min((completedMinutes / adjustedTarget) * 100, 100) : 100;
    
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Daily Summary', margin, yPosition);
    yPosition += 15;
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Target Minutes: ${TARGET_MINUTES}`, margin, yPosition);
    yPosition += 8;
    pdf.text(`Completed Minutes: ${completedMinutes.toFixed(1)}`, margin, yPosition);
    yPosition += 8;
    pdf.text(`Loss Time: ${lossTimeTotal} minutes`, margin, yPosition);
    yPosition += 8;
    pdf.text(`Adjusted Target: ${adjustedTarget} minutes`, margin, yPosition);
    yPosition += 8;
    pdf.text(`Progress: ${completedPercentage.toFixed(1)}%`, margin, yPosition);
    yPosition += 8;
    
    // Add finish status if applicable
    if (dailyData.isFinished) {
      pdf.text(`Status: Work Day Finished at ${dailyData.finishTime}`, margin, yPosition);
      yPosition += 8;
    }
    yPosition += 15;
    
    // Completed Jobs
    if (dailyData.completedJobs.length > 0) {
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Completed Jobs', margin, yPosition);
      yPosition += 10;
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      
      // Table headers
      const headers = ['Item Code', 'LM Code', 'Units', 'Minutes', 'Time'];
      const colWidths = [35, 50, 25, 25, 30];
      let xPos = margin;
      
      headers.forEach((header, index) => {
        pdf.setFont('helvetica', 'bold');
        pdf.text(header, xPos, yPosition);
        xPos += colWidths[index];
      });
      yPosition += 8;
      
      // Table data
      dailyData.completedJobs.forEach((job, index) => {
        if (yPosition > pageHeight - 40) {
          pdf.addPage();
          yPosition = 30;
        }
        
        xPos = margin;
        pdf.setFont('helvetica', 'normal');
        pdf.text(job.itemCode, xPos, yPosition);
        xPos += colWidths[0];
        pdf.text(job.lmCode, xPos, yPosition);
        xPos += colWidths[1];
        pdf.text(job.unitsCompleted.toString(), xPos, yPosition);
        xPos += colWidths[2];
        pdf.text(job.actualMinutes.toFixed(1), xPos, yPosition);
        xPos += colWidths[3];
        pdf.text(job.timestamp, xPos, yPosition);
        
        yPosition += 6;
      });
      yPosition += 10;
    }
    
    // Loss Time Entries
    if (dailyData.lossTimeEntries.length > 0) {
      if (yPosition > pageHeight - 40) {
        pdf.addPage();
        yPosition = 30;
      }
      
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Loss Time Entries', margin, yPosition);
      yPosition += 10;
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      
      // Table headers
      const headers = ['Reason', 'Minutes Lost', 'Time'];
      const colWidths = [80, 30, 30];
      let xPos = margin;
      
      headers.forEach((header, index) => {
        pdf.setFont('helvetica', 'bold');
        pdf.text(header, xPos, yPosition);
        xPos += colWidths[index];
      });
      yPosition += 8;
      
      // Table data
      dailyData.lossTimeEntries.forEach((entry, index) => {
        if (yPosition > pageHeight - 40) {
          pdf.addPage();
          yPosition = 30;
        }
        
        xPos = margin;
        pdf.setFont('helvetica', 'normal');
        pdf.text(entry.reason, xPos, yPosition);
        xPos += colWidths[0];
        pdf.text(entry.minutes.toString(), xPos, yPosition);
        xPos += colWidths[1];
        pdf.text(entry.timestamp, xPos, yPosition);
        
        yPosition += 6;
      });
    }
    
    // Save the PDF
    pdf.save(`production-tracker-${dateString}.pdf`);
  };

  const downloadPDF = async () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    
    // Title
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Production Tracker - Daily Summary', pageWidth / 2, 30, { align: 'center' });
    
    // Date
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    const reportDate = formatDateForDisplay(selectedDate);
    pdf.text(`Date: ${reportDate}`, margin, 45);
    pdf.text(`User: ${userName}`, margin, 55);
    pdf.text(`Email: ${userEmail}`, margin, 65);
    
    let yPosition = 85;
    
    // Summary Statistics
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Daily Summary', margin, yPosition);
    yPosition += 15;
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Target Minutes: ${TARGET_MINUTES}`, margin, yPosition);
    yPosition += 8;
    pdf.text(`Completed Minutes: ${completedMinutes.toFixed(1)}`, margin, yPosition);
    yPosition += 8;
    pdf.text(`Loss Time: ${lossTimeTotal} minutes`, margin, yPosition);
    yPosition += 8;
    pdf.text(`Adjusted Target: ${adjustedTarget} minutes`, margin, yPosition);
    yPosition += 8;
    pdf.text(`Progress: ${completedPercentage.toFixed(1)}%`, margin, yPosition);
    yPosition += 8;
    
    // Add finish status if applicable
    if (allDailyData[selectedDate]?.isFinished) {
      pdf.text(`Status: Work Day Finished at ${allDailyData[selectedDate].finishTime}`, margin, yPosition);
      yPosition += 8;
    }
    yPosition += 15;
    
    // Completed Jobs
    if (completedJobs.length > 0) {
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Completed Jobs', margin, yPosition);
      yPosition += 10;
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      
      // Table headers
      const headers = ['Item Code', 'LM Code', 'Units', 'Minutes', 'Time'];
      const colWidths = [35, 50, 25, 25, 30];
      let xPos = margin;
      
      headers.forEach((header, index) => {
        pdf.setFont('helvetica', 'bold');
        pdf.text(header, xPos, yPosition);
        xPos += colWidths[index];
      });
      yPosition += 8;
      
      // Table data
      completedJobs.forEach((job, index) => {
        if (yPosition > pageHeight - 40) {
          pdf.addPage();
          yPosition = 30;
        }
        
        xPos = margin;
        pdf.setFont('helvetica', 'normal');
        pdf.text(job.itemCode, xPos, yPosition);
        xPos += colWidths[0];
        pdf.text(job.lmCode, xPos, yPosition);
        xPos += colWidths[1];
        pdf.text(job.unitsCompleted.toString(), xPos, yPosition);
        xPos += colWidths[2];
        pdf.text(job.actualMinutes.toFixed(1), xPos, yPosition);
        xPos += colWidths[3];
        pdf.text(job.timestamp, xPos, yPosition);
        
        yPosition += 6;
      });
      yPosition += 10;
    }
    
    // Loss Time Entries
    if (lossTimeEntries.length > 0) {
      if (yPosition > pageHeight - 40) {
        pdf.addPage();
        yPosition = 30;
      }
      
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Loss Time Entries', margin, yPosition);
      yPosition += 10;
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      
      // Table headers
      const headers = ['Reason', 'Minutes Lost', 'Time'];
      const colWidths = [80, 40, 40];
      let xPos = margin;
      
      headers.forEach((header, index) => {
        pdf.setFont('helvetica', 'bold');
        pdf.text(header, xPos, yPosition);
        xPos += colWidths[index];
      });
      yPosition += 8;
      
      // Table data
      lossTimeEntries.forEach((entry, index) => {
        if (yPosition > pageHeight - 40) {
          pdf.addPage();
          yPosition = 30;
        }
        
        xPos = margin;
        pdf.setFont('helvetica', 'normal');
        pdf.text(entry.reason, xPos, yPosition);
        xPos += colWidths[0];
        pdf.text(entry.minutes.toString(), xPos, yPosition);
        xPos += colWidths[1];
        pdf.text(entry.timestamp, xPos, yPosition);
        
        yPosition += 6;
      });
    }
    
    // Footer
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }
    
    // Download the PDF
    const fileName = `production_summary_${userName}_${selectedDate}.pdf`;
    pdf.save(fileName);
  };

  const downloadWeeklyPDF = async () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    
    // Title
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Production Tracker - Weekly Summary', pageWidth / 2, 30, { align: 'center' });
    
    // Week info
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    const workingDays = getWorkingDays();
    const weekStart = formatDateForDisplay(workingDays[0]);
    const weekEnd = formatDateForDisplay(workingDays[3]);
    pdf.text(`Week: ${weekStart} to ${weekEnd}`, margin, 45);
    pdf.text(`User: ${userName}`, margin, 55);
    pdf.text(`Email: ${userEmail}`, margin, 65);
    
    let yPosition = 85;
    
    // Weekly Summary Stats
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Weekly Summary', margin, yPosition);
    yPosition += 15;
    
    const weekData = getCurrentWeekData();
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Total Minutes: ${weekData.totalCompletedMinutes.toFixed(1)}`, margin, yPosition);
    yPosition += 8;
    pdf.text(`Total Jobs: ${weekData.totalJobs}`, margin, yPosition);
    yPosition += 8;
    pdf.text(`Total Loss Time: ${weekData.totalLossTime} minutes`, margin, yPosition);
    yPosition += 8;
    pdf.text(`Days Completed: ${weekData.daysCompleted}/4`, margin, yPosition);
    yPosition += 15;
    
    // Daily Breakdown Table
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Daily Breakdown', margin, yPosition);
    yPosition += 10;
    
    // Table headers
    const headers = ['Day', 'Minutes', 'Jobs', 'Loss Time', 'Percentage', 'Status'];
    const colWidths = [35, 25, 20, 25, 30, 25];
    let xPos = margin;
    
    pdf.setFontSize(10);
    headers.forEach((header, index) => {
      pdf.setFont('helvetica', 'bold');
      pdf.text(header, xPos, yPosition);
      xPos += colWidths[index];
    });
    yPosition += 8;
    
    // Table data for each day
    workingDays.forEach((date, index) => {
      const dayData = allDailyData[date];
      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday'];
      
      if (yPosition > pageHeight - 40) {
        pdf.addPage();
        yPosition = 30;
      }
      
      xPos = margin;
      pdf.setFont('helvetica', 'normal');
      
      // Day name
      pdf.text(dayNames[index], xPos, yPosition);
      xPos += colWidths[0];
      
      if (dayData) {
        const completedMinutes = dayData.completedJobs.reduce((sum, job) => sum + job.actualMinutes, 0);
        const lossTime = dayData.lossTimeEntries.reduce((sum, entry) => sum + entry.minutes, 0);
        const adjustedTarget = TARGET_MINUTES - lossTime;
        const percentage = adjustedTarget > 0 ? Math.min((completedMinutes / adjustedTarget) * 100, 100) : 100;
        
        // Minutes
        pdf.text(completedMinutes.toFixed(1), xPos, yPosition);
        xPos += colWidths[1];
        
        // Jobs
        pdf.text(dayData.completedJobs.length.toString(), xPos, yPosition);
        xPos += colWidths[2];
        
        // Loss Time
        pdf.text(lossTime.toString(), xPos, yPosition);
        xPos += colWidths[3];
        
        // Percentage with color coding
        const percentageText = `${percentage.toFixed(1)}%`;
        pdf.text(percentageText, xPos, yPosition);
        
        // Color coding based on percentage
        if (percentage < 56) {
          pdf.setTextColor(220, 38, 38); // Red for below 56%
        } else if (percentage < 70) {
          pdf.setTextColor(245, 158, 11); // Yellow for 56-69%
        } else if (percentage < 86) {
          pdf.setTextColor(132, 204, 22); // Yellowish green for 70-85%
        } else {
          pdf.setTextColor(34, 197, 94); // Green for 86%+
        }
        pdf.text(percentageText, xPos, yPosition);
        pdf.setTextColor(0, 0, 0); // Reset to black
        xPos += colWidths[4];
        
        // Status
        pdf.text(dayData.isFinished ? '✓ Finished' : '○ Pending', xPos, yPosition);
      } else {
        // No data for this day
        pdf.text('0.0', xPos, yPosition);
        xPos += colWidths[1];
        pdf.text('0', xPos, yPosition);
        xPos += colWidths[2];
        pdf.text('0', xPos, yPosition);
        xPos += colWidths[3];
        pdf.text('0.0%', xPos, yPosition);
        xPos += colWidths[4];
        pdf.text('○ No Data', xPos, yPosition);
      }
      
      yPosition += 6;
    });
    
    // Color Legend
    yPosition += 10;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Percentage Color Legend:', margin, yPosition);
    yPosition += 8;
    
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(220, 38, 38); // Red
    pdf.text('• Below 56%: Red', margin, yPosition);
    yPosition += 6;
    pdf.setTextColor(245, 158, 11); // Yellow
    pdf.text('• 56% - 69%: Yellow', margin, yPosition);
    yPosition += 6;
    pdf.setTextColor(132, 204, 22); // Yellowish green
    pdf.text('• 70% - 85%: Yellowish Green', margin, yPosition);
    yPosition += 6;
    pdf.setTextColor(34, 197, 94); // Green
    pdf.text('• 86% and above: Green', margin, yPosition);
    pdf.setTextColor(0, 0, 0); // Reset to black
    
    // Footer
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }
    
    // Download the PDF
    const fileName = `weekly_summary_${userName}_${workingDays[0]}_to_${workingDays[3]}.pdf`;
    pdf.save(fileName);
  };

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) {
      setAuthError('Please enter email and password');
      return;
    }
    
    if (isSignUp && !loginName) {
      setAuthError('Please enter your name to create an account');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(loginEmail)) {
      setAuthError('Please enter a valid email address');
      return;
    }

    if (loginPassword.length < 6) {
      setAuthError('Password must be at least 6 characters long');
      return;
    }

    try {
      setAuthError('');
      setIsLoading(true);
      
      console.log('Starting authentication...', { isSignUp, loginEmail, loginName });
      
      if (isSignUp) {
        // Create new account
        console.log('Creating account with password');
        const user = await signUp(loginEmail, loginPassword);
        console.log('Account created:', user);
        await saveUserProfile(user.uid, { name: loginName, email: loginEmail });
        console.log('User profile saved');
      } else {
        // Sign in existing user
        console.log('Signing in with password');
        await signIn(loginEmail, loginPassword);
        console.log('Sign in successful');
      }
      
      setLoginEmail('');
      setLoginName('');
      setLoginPassword('');
      setIsSignUp(false);
    } catch (error: any) {
      console.error('Authentication error:', error);
      setAuthError(error.message || 'Authentication failed');
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail) {
      setForgotPasswordMessage('Please enter your email address');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forgotPasswordEmail)) {
      setForgotPasswordMessage('Please enter a valid email address');
      return;
    }

    try {
      setForgotPasswordMessage('');
      setIsResettingPassword(true);
      
      await resetPassword(forgotPasswordEmail);
      setForgotPasswordMessage('Password reset email sent! Check your inbox and spam folder.');
      setForgotPasswordEmail('');
      
      // Auto-hide the message after 5 seconds
      setTimeout(() => {
        setForgotPasswordMessage('');
        setShowForgotPassword(false);
      }, 5000);
      
    } catch (error: any) {
      console.error('Password reset error:', error);
      setForgotPasswordMessage(error.message || 'Failed to send reset email. Please try again.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Admin panel functions
  const loadAllUsers = React.useCallback(async () => {
    if (!isAdmin) return;
    
    try {
      setIsLoadingUsers(true);
      const users = await getAllUsers();
      setAllUsers(users);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [isAdmin]);

  const handleBlockUser = async (userId: string, isBlocked: boolean) => {
    try {
      await updateUserBlockStatus(userId, isBlocked);
      // Refresh users list
      await loadAllUsers();
      alert(`✅ User ${isBlocked ? 'blocked' : 'unblocked'} successfully`);
    } catch (error) {
      console.error('Error updating user block status:', error);
      alert(`❌ Error updating user status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleResetUserData = async (userId: string, date: string) => {
    try {
      await resetUserDailyData(userId, date);
      alert(`✅ Data successfully reset for user on ${date}`);
      // Refresh the users list to reflect any changes
      await loadAllUsers();
    } catch (error) {
      console.error('Error resetting user data:', error);
      alert(`❌ Error resetting user data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    try {
      const confirmed = window.confirm(
        `Are you sure you want to delete user "${userName}"?\n\n` +
        `This action will:\n` +
        `• Mark the user as deleted\n` +
        `• Remove them from the user list\n` +
        `• Preserve their data for potential recovery\n\n` +
        `This action cannot be undone easily.`
      );
      
      if (confirmed) {
        await deleteUser(userId);
        // Refresh the users list
        await loadAllUsers();
        window.alert(`✅ User "${userName}" has been deleted successfully.`);
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      window.alert(`❌ Error deleting user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // User data editing functions
  const handleEditUserData = async (user: {uid: string, email: string, name: string}) => {
    try {
      setIsLoadingUserData(true);
      setSelectedUserForEdit(user);
      
      // Load user's daily data
      const userData = await getAllDailyData(user.uid);
      setEditingUserData(userData as Record<string, DailyData>);
      
      // Set to today's date or first available date
      const today = new Date().toISOString().split('T')[0];
      const availableDates = Object.keys(userData);
      setEditingSelectedDate(availableDates.includes(today) ? today : (availableDates[0] || today));
      
      setShowUserDataEditor(true);
    } catch (error) {
      console.error('Error loading user data:', error);
      window.alert('Error loading user data. Please try again.');
    } finally {
      setIsLoadingUserData(false);
    }
  };

  const handleSaveUserData = async () => {
    if (!selectedUserForEdit || !editingSelectedDate) return;
    
    try {
      const currentData = editingUserData[editingSelectedDate];
      if (currentData) {
        await saveDailyData(selectedUserForEdit.uid, editingSelectedDate, currentData);
        window.alert('User data saved successfully!');
      }
    } catch (error) {
      console.error('Error saving user data:', error);
      window.alert('Error saving user data. Please try again.');
    }
  };

  const handleDeleteJob = (jobId: number) => {
    if (!selectedUserForEdit || !editingSelectedDate) return;
    
    const currentData = editingUserData[editingSelectedDate];
    if (currentData) {
      const updatedJobs = currentData.completedJobs.filter(job => job.id !== jobId);
      setEditingUserData(prev => ({
        ...prev,
        [editingSelectedDate]: {
          ...currentData,
          completedJobs: updatedJobs
        }
      }));
    }
  };

  const handleDeleteLossTime = (entryId: number) => {
    if (!selectedUserForEdit || !editingSelectedDate) return;
    
    const currentData = editingUserData[editingSelectedDate];
    if (currentData) {
      const updatedLossTime = currentData.lossTimeEntries.filter(entry => entry.id !== entryId);
      setEditingUserData(prev => ({
        ...prev,
        [editingSelectedDate]: {
          ...currentData,
          lossTimeEntries: updatedLossTime
        }
      }));
    }
  };

  // Inline editing functions
  const startEditing = (jobId: number, field: string, currentValue: string | number) => {
    setEditingJobId(jobId);
    setEditingField(field);
    setEditingValue(currentValue.toString());
  };

  const saveEdit = () => {
    if (!selectedUserForEdit || !editingSelectedDate || editingJobId === null) return;
    
    const currentData = editingUserData[editingSelectedDate];
    if (currentData) {
      const updatedJobs = currentData.completedJobs.map(job => {
        if (job.id === editingJobId) {
          const updatedJob = { ...job };
          
          switch (editingField) {
            case 'itemCode':
              updatedJob.itemCode = editingValue;
              break;
            case 'lmCode':
              updatedJob.lmCode = editingValue;
              break;
            case 'unitsCompleted':
              const units = parseInt(editingValue);
              if (!isNaN(units) && units > 0) {
                updatedJob.unitsCompleted = units;
                // Recalculate completion percentage and actual minutes
                const item = productionData.find(p => p.itemCode === updatedJob.itemCode);
                if (item) {
                  updatedJob.completionPercentage = units / item.quantity;
                  updatedJob.actualMinutes = item.time * updatedJob.completionPercentage;
                }
              }
              break;
            case 'actualMinutes':
              const minutes = parseFloat(editingValue);
              if (!isNaN(minutes) && minutes >= 0) {
                updatedJob.actualMinutes = minutes;
              }
              break;
          }
          
          return updatedJob;
        }
        return job;
      });
      
      setEditingUserData(prev => ({
        ...prev,
        [editingSelectedDate]: {
          ...currentData,
          completedJobs: updatedJobs
        }
      }));
    }
    
    // Reset editing state
    setEditingJobId(null);
    setEditingField('');
    setEditingValue('');
  };

  const cancelEdit = () => {
    setEditingJobId(null);
    setEditingField('');
    setEditingValue('');
  };

  // Timer functions
  const startTimer = () => {
    if (!timerState.isActive) {
      // Only allow timer operations during working hours or if admin
      if (!isWithinWorkingHoursState && !isAdmin) {
        alert('Timer can only be used during working hours (06:55 AM - 16:35 PM, Monday to Thursday)');
        return;
      }
      
      // Request notification permission when starting timer
      if (notificationPermission === 'default') {
        requestNotificationPermission();
      }
      
      const now = Date.now();
      setTimerState(prev => ({
        ...prev,
        isActive: true,
        startTime: now,
        elapsedTime: prev.elapsedTime // Keep existing elapsed time if resuming
      }));
      
      const interval = setInterval(() => {
        setTimerState(prev => ({
          ...prev,
          elapsedTime: Date.now() - prev.startTime
        }));
      }, 100);
      
      setTimerInterval(interval);
    }
  };

  const pauseTimer = () => {
    if (timerState.isActive && !timerState.isPaused) {
      // Only allow timer operations during working hours or if admin
      if (!isWithinWorkingHoursState && !isAdmin) {
        alert('Timer can only be used during working hours (06:55 AM - 16:35 PM, Monday to Thursday)');
        return;
      }
      
      setTimerState(prev => ({
        ...prev,
        isPaused: true,
        pausedTime: prev.elapsedTime
      }));
      if (timerInterval) {
        clearInterval(timerInterval);
        setTimerInterval(null);
      }
    }
  };

  const resumeTimer = () => {
    if (timerState.isActive && timerState.isPaused) {
      // Only allow timer operations during working hours or if admin
      if (!isWithinWorkingHoursState && !isAdmin) {
        alert('Timer can only be used during working hours (06:55 AM - 16:35 PM, Monday to Thursday)');
        return;
      }
      
      const now = Date.now();
      setTimerState(prev => ({
        ...prev,
        isPaused: false,
        startTime: now - prev.pausedTime
      }));
      
      const interval = setInterval(() => {
        setTimerState(prev => ({
          ...prev,
          elapsedTime: Date.now() - prev.startTime
        }));
      }, 100);
      
      setTimerInterval(interval);
    }
  };

  const stopTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
    
    const actualTimeTaken = timerState.elapsedTime / 1000; // Convert to seconds
    
    // Create completed job with actual time taken
    const item = productionData.find(p => p.itemCode === timerState.itemCode);
    if (item) {
      const unitsCompleted = parseInt(completedQuantity) || item.quantity;
      const completionPercentage = unitsCompleted / item.quantity;
      const actualMinutes = actualTimeTaken / 60; // Convert seconds to minutes
      
      const newJob: CompletedJob = {
        ...item,
        unitsCompleted,
        completionPercentage,
        actualMinutes,
        actualTimeTaken,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now()
      };

      const updatedJobs = [...completedJobs, newJob];
      setCompletedJobs(updatedJobs);

      // Save to Firebase
      if (userId && selectedDate) {
        const dailyData: any = {
          date: selectedDate,
          completedJobs: updatedJobs,
          lossTimeEntries,
          isFinished: allDailyData[selectedDate]?.isFinished || false
        };
        
        // Only add finishTime if it exists (avoid undefined values)
        const existingFinishTime = allDailyData[selectedDate]?.finishTime;
        if (existingFinishTime) {
          dailyData.finishTime = existingFinishTime;
        }
        
        const cleanedData = removeUndefinedValues(dailyData);
        saveDailyData(userId, selectedDate, cleanedData).then(() => {
          setAllDailyData(prev => ({
            ...prev,
            [selectedDate]: dailyData
          }));
        }).catch(error => {
          console.error('Error saving job:', error);
        });
      }
    }
    
    // Reset timer state
    setTimerState({
      isActive: false,
      isPaused: false,
      startTime: 0,
      pausedTime: 0,
      elapsedTime: 0,
      expectedTime: 0,
      itemCode: '',
      lmCode: '',
      isVisible: false
    });
    
    // Clear localStorage when timer is completed
    localStorage.removeItem('productionTimer');
    
    // Reset form
    setSelectedItem('');
    setCompletedQuantity('');
    setSearchInput('');
  };

  const closeTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
    
    setTimerState(prev => ({
      ...prev,
      isVisible: false
    }));
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [timerInterval]);

  // Save timer state to localStorage whenever it changes
  const saveTimerState = (state: TimerState) => {
    const timerToSave = {
      ...state,
      lastSaveTime: Date.now()
    };
    localStorage.setItem('productionTimer', JSON.stringify(timerToSave));
  };

  // Debug timer state changes and save to localStorage
  useEffect(() => {
    console.log('Timer state changed:', timerState);
    saveTimerState(timerState);
  }, [timerState]);

  // Handle page visibility changes to save timer state
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && timerState.isActive) {
        // Page is hidden (user switched tabs or closed browser), save timer state
        console.log('Page hidden, saving timer state');
        saveTimerState(timerState);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also save timer state before page unload
    const handleBeforeUnload = () => {
      if (timerState.isActive) {
        console.log('Page unloading, saving timer state');
        saveTimerState(timerState);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [timerState]);

  // Periodic check for timers that exceed expected time by exactly 1 minute
  useEffect(() => {
    if (timerState.isActive && !timerState.isPaused) {
      const checkInterval = setInterval(() => {
        const elapsedMinutes = timerState.elapsedTime / 60000;
        const expectedMinutes = timerState.expectedTime;
        
        // Trigger auto-completion when timer exceeds expected time by exactly 1 minute
        if (elapsedMinutes >= expectedMinutes + 1) {
          console.log('Timer exceeded expected time by 1 minute, showing auto-completion modal');
          // Show notification popup
          if (!showAutoCompletionModal) {
            triggerAutoCompletionModal(timerState);
          }
          clearInterval(checkInterval);
        }
      }, 5000); // Check every 5 seconds for more precise timing
      
      return () => clearInterval(checkInterval);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerState.isActive, timerState.isPaused, timerState.elapsedTime, timerState.expectedTime, showAutoCompletionModal, triggerAutoCompletionModal]);









  // Load users when admin panel is opened
  React.useEffect(() => {
    if (showAdminPanel && isAdmin) {
      loadAllUsers();
    }
  }, [showAdminPanel, isAdmin, loadAllUsers]);

  // Network connectivity monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setNetworkIssues([]);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setNetworkIssues(['You are currently offline']);
    };

    // Test network connectivity and detect potential blocking
    const testConnectivity = async () => {
      if (!navigator.onLine) {
        setIsOnline(false);
        setNetworkIssues(['You are currently offline']);
        return;
      }

      const issues: string[] = [];
      
      try {
        // Test basic connectivity to a reliable service
        await fetch('https://httpbin.org/get', { 
          method: 'GET',
          mode: 'no-cors',
          cache: 'no-cache'
        });
        // If we get here, basic connectivity works
      } catch (error) {
        issues.push('Network connectivity issues detected');
      }

      // Check if we're on a restricted network
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        issues.push('Running on localhost - share your IP address for external access');
      }

      setNetworkIssues(issues);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initial connectivity test
    testConnectivity();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Progress data for pie chart
  const progressData = [
    { name: 'Productive Time', value: Math.min(completedMinutes, adjustedTarget), color: '#10b981' },
    { name: 'Remaining', value: Math.max(remainingMinutes, 0), color: '#e5e7eb' }
  ];

  const filteredProgressData = progressData.filter(item => item.value > 0);
  const isTargetReached = completedMinutes >= adjustedTarget;

  // Show loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If not logged in, show login screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="mb-4">
              <img 
                src="/bike.png" 
                alt="Folding Bike Logo" 
                className="mx-auto w-16 h-16 sm:w-20 sm:h-20 object-contain"
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Production Tracker</h1>
            <p className="text-sm sm:text-base text-gray-600">Track your daily 525-minute production target</p>
          </div>
          
          {authError && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {authError}
            </div>
          )}
          
          <div className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your Name</label>
                <input
                  type="text"
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="Enter your email address"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 mt-1">
                {isSignUp ? "Create a password for your account (min 6 chars)" : "Enter your password"}
              </p>
              {!isSignUp && (
                <button
                  onClick={() => setShowForgotPassword(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                  disabled={isLoading}
                >
                  Forgot your password?
                </button>
              )}
            </div>
            
            <button
              onClick={handleLogin}
              disabled={isLoading || (isSignUp && !loginName) || !loginEmail || !loginPassword}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Loading...' : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
            
            <div className="text-center">
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  if (!isSignUp) {
                    // When switching to sign-in mode, clear the name field
                    setLoginName('');
                  }
                }}
                className="text-blue-600 hover:text-blue-700 text-sm"
                disabled={isLoading}
              >
                {isSignUp ? 'Already have an account? Sign In' : 'New user? Create Account'}
              </button>
            </div>
          </div>
          
          {/* Forgot Password Form */}
          {showForgotPassword && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Reset Password</h3>
                <button
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotPasswordEmail('');
                    setForgotPasswordMessage('');
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {forgotPasswordMessage && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${
                  forgotPasswordMessage.includes('sent') 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {forgotPasswordMessage}
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                  <input
                    type="email"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={isResettingPassword}
                  />
                </div>
                
                <button
                  onClick={handleForgotPassword}
                  disabled={isResettingPassword || !forgotPasswordEmail}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResettingPassword ? 'Sending...' : 'Send Reset Email'}
                </button>
              </div>
            </div>
          )}
          
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">🔒 Your data is securely stored in the cloud</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-0 sm:p-6 min-h-screen bg-gray-50">
      {/* Time Exceeded Banner */}
      {showTimeExceededBanner && bannerData && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white p-2 sm:p-4 shadow-lg">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="text-lg sm:text-2xl">⏰</div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm sm:text-base truncate">
                  Timer Exceeded: {bannerData.itemCode} - {bannerData.lmCode}
                </div>
                <div className="text-xs sm:text-sm opacity-90">
                  Expected: {bannerData.expectedTime} min | 
                  Actual: {Math.floor(bannerData.elapsedTime / 60000)}:{Math.floor((bannerData.elapsedTime % 60000) / 1000).toString().padStart(2, '0')} | 
                  Over by: {Math.round((bannerData.elapsedTime / 60000) - bannerData.expectedTime)} min
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setShowTimeExceededBanner(false);
                  setBannerData(null);
                }}
                className="px-2 py-1 sm:px-3 bg-red-700 hover:bg-red-800 rounded text-xs sm:text-sm"
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  setShowTimeExceededBanner(false);
                  setBannerData(null);
                  setShowAutoCompletionModal(true);
                }}
                className="px-3 py-1 sm:px-4 bg-white text-red-600 hover:bg-gray-100 rounded font-medium text-xs sm:text-sm"
              >
                Complete Job
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-3" />
            <div>
              <h3 className="font-semibold text-red-800">You're currently offline</h3>
              <p className="text-sm text-red-600 mt-1">
                Your data will be saved locally and synced when you're back online.
                Check your internet connection or try switching to mobile data.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Network Issues Banner */}
      {networkIssues.length > 0 && isOnline && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-600 mr-3" />
            <div>
              <h3 className="font-semibold text-yellow-800">Network connectivity issues detected</h3>
              <p className="text-sm text-yellow-600 mt-1">
                Some features may not work properly. Click the QR code button for troubleshooting tips.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-none sm:rounded-lg shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div>
              <img 
                src="/bike.png" 
                alt="Folding Bike Logo" 
                className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
              />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold text-gray-800">Production Tracker</h1>
              <p className="text-xs sm:text-sm text-gray-600">
                Welcome back, {userName.substring(0, 3).toUpperCase()}! 👋
                {isAdmin && (
                  <button
                    onClick={() => setShowAdminPanel(!showAdminPanel)}
                    className="ml-2 text-purple-600 font-medium hover:text-purple-800 underline cursor-pointer"
                    title="Admin Panel"
                  >
                    (Admin)
                  </button>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center justify-between sm:justify-end space-x-2 sm:space-x-3">
            <div className="text-left sm:text-right">
              <p className="text-xs sm:text-sm text-gray-500">{userEmail.split('@')[0]}@...</p>
              <button onClick={handleLogout} className="text-xs sm:text-sm text-red-600 hover:text-red-800 underline">
                Logout
              </button>
              {/* Network Status Indicator */}
              {networkIssues.length > 0 && (
                <div className="text-xs text-yellow-600 mt-1">
                  ⚠️ Network issues
                </div>
              )}
              {!isOnline && (
                <div className="text-xs text-red-600 mt-1">
                  🔴 Offline
                </div>
              )}
              {/* Save Status Indicator */}
              {isSaving ? (
                <div className="text-xs text-blue-600 mt-1 animate-pulse">
                  💾 Saving...
                </div>
              ) : lastSaved && (
                <div className="text-xs text-green-600 mt-1 transition-opacity duration-300">
                  ✅ Saved {lastSaved.toLocaleTimeString()}
                </div>
              )}
            </div>
            
            {/* QR Code Button */}
            <button
              onClick={() => setShowQRModal(true)}
              className="p-1.5 rounded-lg bg-green-100 hover:bg-green-200 text-green-600 transition-colors"
              title="Show QR Code for Mobile Access"
            >
              <QrCode className="h-4 w-4" />
            </button>
            
            {/* Calendar Icon for Historical Data */}
            <button
              onClick={() => setShowCalendarModal(true)}
              className="p-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-600 transition-colors"
              title="View Historical Data"
            >
              <Calendar className="h-4 w-4" />
            </button>
            
            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 transition-colors"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
            
            {selectedDate && (
              <button
                onClick={finishWorkDay}
                disabled={allDailyData[selectedDate]?.isFinished || (!isWithinWorkingHoursState && !isAdmin)}
                className={`px-2 py-1 text-xs rounded-lg font-medium transition-colors ${
                  allDailyData[selectedDate]?.isFinished || (!isWithinWorkingHoursState && !isAdmin)
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {allDailyData[selectedDate]?.isFinished ? 'Finished' : 'Finish Day'}
              </button>
            )}
            
            {/* Week Reset Button - appears when all working days are finished */}
            {isWeekComplete() && (
              <button
                onClick={resetWeek}
                className="px-2 py-1 text-xs rounded-lg font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors"
              >
                🎉 New Week
              </button>
            )}
          </div>
        </div>

        {/* Date Selection */}
        <div className="mb-4 sm:mb-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-3">Select Working Day</h3>
          
          {/* Time Access Warning */}
          {!isWithinWorkingHoursState && (
            <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Outside Working Hours</p>
                  <p className="text-xs text-yellow-700">Access is only available between 06:55 AM and 16:35 PM, Monday to Thursday</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex flex-wrap gap-1 sm:gap-2">
            {getWorkingDays().map((date) => {
              const isSelected = selectedDate === date;
              const hasData = allDailyData[date];
              const isToday = date === getCurrentDateKey();
              const canAccess = canAccessDate(date);
              
              return (
                <button
                  key={date}
                  onClick={() => {
                    if (date !== selectedDate && canAccess) {
                      setIsSwitchingDate(true);
                      setSelectedDate(date);
                      setTimeout(() => setIsSwitchingDate(false), 100);
                    }
                  }}
                  disabled={!canAccess}
                  className={`px-2 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : hasData || isToday
                      ? 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                      : 'bg-white text-gray-500 border-gray-200'
                  } ${isToday ? 'ring-2 ring-yellow-400' : ''} ${
                    hasData ? 'font-semibold' : ''
                  } ${allDailyData[date]?.isFinished ? 'border-green-500 bg-green-50' : ''} ${
                    !canAccess ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <div className="text-xs sm:text-sm">
                    {formatDateForDisplay(date)}
                  </div>
                  {hasData ? (
                    <div className="text-xs mt-1">
                      {allDailyData[date].completedJobs.length} jobs
                      {allDailyData[date].isFinished && (
                        <span className="text-green-600 font-bold"> ✓</span>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs mt-1 text-gray-400">
                      Not started
                    </div>
                  )}
                  {isToday && !hasData && (
                    <div className="text-xs mt-1 text-yellow-600 font-medium">
                      Today
                    </div>
                  )}
                  {!canAccess && (
                    <div className="text-xs mt-1 text-red-600 font-medium">
                      {isAdmin ? 'Admin Only' : 'Locked'}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Weekly Summary - shows when week is complete */}
        {isWeekComplete() && (
          <div className="mb-4 sm:mb-6 bg-gradient-to-r from-purple-50 to-indigo-50 p-4 sm:p-6 rounded-none sm:rounded-lg border border-purple-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-purple-800">🎉 Week Complete!</h3>
              <div className="text-sm text-purple-600">
                All {getWorkingDays().length} working days finished
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <div className="text-2xl font-bold text-purple-600">
                  {getCurrentWeekData().totalCompletedMinutes.toFixed(1)}
                </div>
                <div className="text-sm text-purple-600">Total Minutes</div>
              </div>
              
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <div className="text-2xl font-bold text-purple-600">
                  {getCurrentWeekData().totalJobs}
                </div>
                <div className="text-sm text-purple-600">Total Jobs</div>
              </div>
              
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <div className="text-2xl font-bold text-purple-600">
                  {getCurrentWeekData().totalLossTime}
                </div>
                <div className="text-sm text-purple-600">Loss Time</div>
              </div>
              
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <div className="text-2xl font-bold text-purple-600">
                  {getCurrentWeekData().daysCompleted}
                </div>
                <div className="text-sm text-purple-600">Days Completed</div>
              </div>
            </div>
            
            <div className="mt-4 text-center">
              <p className="text-purple-700 mb-2">Ready to start a new week?</p>
              <button
                onClick={resetWeek}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                🚀 Start New Week
              </button>
            </div>
          </div>
        )}
        
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
            <div className="flex items-center">
              <Target className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 mr-2 sm:mr-3" />
              <div>
                <p className="text-xs sm:text-sm text-blue-600">Target</p>
                <p className="text-lg sm:text-xl font-bold text-blue-800">{TARGET_MINUTES} min</p>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 p-3 sm:p-4 rounded-lg">
            <div className="flex items-center">
              <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 mr-2 sm:mr-3" />
              <div>
                <p className="text-xs sm:text-sm text-green-600">Completed</p>
                <p className="text-lg sm:text-xl font-bold text-green-800">{completedMinutes.toFixed(1)} min</p>
              </div>
            </div>
          </div>
          
          <div className="bg-yellow-50 p-3 sm:p-4 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-600 mr-2 sm:mr-3" />
              <div>
                <p className="text-xs sm:text-sm text-yellow-600">Remaining</p>
                <p className="text-lg sm:text-xl font-bold text-yellow-800">{remainingMinutes.toFixed(1)} min</p>
              </div>
            </div>
          </div>
          
          <div className="bg-purple-50 p-3 sm:p-4 rounded-lg">
            <div className="flex items-center">
              <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 mr-2 sm:mr-3" />
              <div>
                <p className="text-xs sm:text-sm text-purple-600">Progress</p>
                <p className="text-lg sm:text-xl font-bold text-purple-800">{completedPercentage.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Loss Time Alert */}
        {lossTimeTotal > 0 && (
          <div className="bg-red-50 p-3 sm:p-4 rounded-none sm:rounded-lg mb-4 border border-red-200">
            <div className="flex items-center">
              <StopCircle className="h-6 w-6 sm:h-8 sm:w-8 text-red-600 mr-2 sm:mr-3" />
              <div>
                <p className="text-xs sm:text-sm text-red-600">Loss Time Today</p>
                <p className="text-lg sm:text-xl font-bold text-red-800">{lossTimeTotal} min</p>
                <p className="text-xs text-red-500">Adjusted Target: {adjustedTarget} minutes (was {TARGET_MINUTES})</p>
              </div>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="mb-4 sm:mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs sm:text-sm font-medium text-gray-700">Daily Progress</span>
            {allDailyData[selectedDate]?.isFinished && (
              <span className="text-xs sm:text-sm font-medium text-green-600 flex items-center">
                ✓ Work Day Finished at {allDailyData[selectedDate].finishTime}
              </span>
            )}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3">
            <div 
              className={`h-2 sm:h-3 rounded-full transition-all duration-300 ${
                allDailyData[selectedDate]?.isFinished ? 'bg-green-600' : 'bg-blue-600'
              }`}
              style={{ width: `${completedPercentage}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Input Form */}
        <div className="bg-white rounded-none sm:rounded-lg shadow-lg p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">Log Completed Work</h2>
          
          <div className="space-y-4">
            {/* Search Mode Toggle */}
            <div className="flex space-x-2 sm:space-x-4 mb-4">
              <button
                onClick={() => {setSearchMode('dropdown'); setSearchInput(''); setSelectedItem('');}}
                className={`px-2 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-lg ${searchMode === 'dropdown' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                📋 Dropdown
              </button>
              <button
                onClick={() => {setSearchMode('search'); setSelectedItem(''); setSearchInput('');}}
                className={`px-2 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-lg ${searchMode === 'search' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                🔍 Quick Search
              </button>

            </div>

            {/* Item Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Item Code</label>
              
              {searchMode === 'dropdown' ? (
                <select
                  value={selectedItem}
                  onChange={(e) => handleDropdownSelect(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select an item...</option>
                  {productionData.map(item => (
                    <option key={item.itemCode} value={item.itemCode}>
                      {item.itemCode} - {item.lmCode}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => handleSearchInputChange(e.target.value)}
                    onFocus={() => searchInput.trim() !== '' && setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    placeholder="Type item code (e.g., B102823)"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
                    autoComplete="off"
                  />
                  
                  {/* Search Suggestions Dropdown */}
                  {showSuggestions && filteredItems.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredItems.map((item, index) => (
                        <button
                          key={index}
                          onClick={() => handleItemSelect(item)}
                          className="w-full px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">{item.itemCode}</div>
                          <div className="text-sm text-gray-600">{item.lmCode}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* No results message */}
                  {showSuggestions && searchInput.trim() !== '' && filteredItems.length === 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                      <div className="px-3 py-2 text-sm text-gray-500">
                        No items found for "{searchInput}"
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Item Info Display */}
            {getCurrentItem() && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Target Quantity:</span> {getCurrentItem()?.quantity} units
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Target Time:</span> {getCurrentItem()?.time} minutes
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">LM Code:</span> {getCurrentItem()?.lmCode}
                </p>
              </div>
            )}

            {/* Quantity Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Units Completed</label>
              <input
                type="number"
                value={completedQuantity}
                onChange={(e) => setCompletedQuantity(e.target.value)}
                placeholder="Enter units completed"
                min="0"
                step="1"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={(!selectedItem && !getCurrentItem()) || !completedQuantity || (!isWithinWorkingHoursState && !isAdmin)}
              className="w-full bg-blue-600 text-white py-2 sm:py-3 px-3 sm:px-4 text-sm sm:text-base rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors disabled:opacity-50 disabled:transform disabled:scale-95"
            >
              Log Completion
            </button>
            
            {/* Show Timer Button - only visible if there's an active timer */}
            {timerState.isActive && timerState.itemCode && (
              <button
                onClick={() => setTimerState(prev => ({ ...prev, isVisible: true }))}
                className="w-full mt-2 bg-green-600 text-white py-2 sm:py-3 px-3 sm:px-4 text-sm sm:text-base rounded-lg hover:bg-green-700 transition-colors"
              >
                ⏱️ Show Active Timer
              </button>
            )}
            
            {/* Time restriction warning for non-admin users */}
            {(!isWithinWorkingHoursState && !isAdmin) && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mr-2" />
                  <span className="text-xs text-yellow-700">
                    Logging is only available during working hours (06:55 AM - 16:35 PM, Monday to Thursday) for non-admin users
                  </span>
                </div>
              </div>
            )}

            {/* Loss Time Section */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-medium">Loss Time Tracking</h3>
                <button
                  onClick={() => setShowLossTimeForm(!showLossTimeForm)}
                  disabled={!isWithinWorkingHoursState && !isAdmin}
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg flex items-center space-x-1 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:transform disabled:scale-95 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Loss Time</span>
                </button>
              </div>

              {showLossTimeForm && (
                <div className="bg-red-50 p-4 rounded-lg space-y-3 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Reason for Loss Time</label>
                    <select
                      value={selectedLossReason}
                      onChange={(e) => setSelectedLossReason(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    >
                      <option value="">Select reason...</option>
                      {lossReasons.map(reason => (
                        <option key={reason} value={reason}>{reason}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Time Lost (minutes)</label>
                    <input
                      type="number"
                      value={lossTimeMinutes}
                      onChange={(e) => setLossTimeMinutes(e.target.value)}
                      placeholder="Enter minutes lost"
                      min="1"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={handleLossTimeSubmit}
                      disabled={!selectedLossReason || !lossTimeMinutes || (!isWithinWorkingHoursState && !isAdmin)}
                      className="bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:opacity-50 disabled:transform disabled:scale-95 disabled:cursor-not-allowed transition-colors"
                    >
                      Log Loss Time
                    </button>
                    
                    {/* Time restriction warning for loss time */}
                    {(!isWithinWorkingHoursState && !isAdmin) && (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center">
                          <AlertCircle className="h-4 w-4 text-yellow-600 mr-2" />
                          <span className="text-xs text-yellow-700">
                            Loss time logging is only available during working hours (06:55 AM - 16:35 PM, Monday to Thursday) for non-admin users
                          </span>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => setShowLossTimeForm(false)}
                      className="bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {lossTimeEntries.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-700">Recent Loss Time:</h4>
                  {lossTimeEntries.slice(-3).reverse().map(entry => (
                    <div key={entry.id} className="flex justify-between items-center bg-red-50 p-2 rounded border">
                      <div>
                        <span className="font-medium text-red-700">{entry.reason}</span>
                        <span className="text-sm text-gray-600 ml-2">({entry.minutes} min at {entry.timestamp})</span>
                      </div>
                      <button
                        onClick={() => deleteLossTimeEntry(entry.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Progress Chart */}
        <div className="bg-white rounded-none sm:rounded-lg shadow-lg p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">Progress Status</h2>
          
          {isDataLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <div className="text-gray-600">Loading data...</div>
              </div>
            </div>
          ) : (
            <>
              <div className="h-64 relative">
                {isTargetReached && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="text-center">
                      <div className="text-6xl mb-2">🎉</div>
                      <div className="text-2xl font-bold text-yellow-500">TARGET REACHED!</div>
                    </div>
                  </div>
                )}
                
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={isTargetReached ? [{ name: 'Completed', value: adjustedTarget, color: '#10b981' }] : filteredProgressData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={100}
                      startAngle={90}
                      endAngle={450}
                      paddingAngle={0}
                      dataKey="value"
                    >
                      {(isTargetReached ? [{ name: 'Completed', value: adjustedTarget, color: '#10b981' }] : filteredProgressData).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${Number(value).toFixed(1)} min`, 'Time']} />
                    {!isTargetReached && <Legend />}
                  </PieChart>
                </ResponsiveContainer>
                
                {!isTargetReached && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-700">{completedPercentage.toFixed(1)}%</div>
                      <div className="text-sm text-gray-500">Complete</div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mt-4 text-center">
                <p className="text-base sm:text-lg font-semibold text-gray-700">
                  {completedMinutes.toFixed(1)} / {adjustedTarget} minutes
                  {lossTimeTotal > 0 && <span className="text-xs sm:text-sm text-red-600"> (Target reduced by {lossTimeTotal} min)</span>}
                </p>
                <p className="text-xs sm:text-sm text-gray-500">{completedJobs.length} tasks completed</p>
                {lossTimeTotal > 0 && (
                  <p className="text-xs sm:text-sm text-red-600 font-medium">{lossTimeTotal} minutes lost time</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

              {/* Jobs Summary */}
        {(completedJobs.length > 0 || lossTimeEntries.length > 0) && (
          <div className="bg-white rounded-none sm:rounded-lg shadow-lg p-6 sm:p-8 mt-4 sm:mt-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 space-y-3 sm:space-y-0">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-800">
                  Daily Summary
                </h2>
                <p className="text-sm text-gray-600">
                  {userName} • {formatDateForDisplay(selectedDate)}
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={downloadPDF}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 text-sm rounded-lg flex items-center space-x-1.5 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Daily</span>
                </button>
                <button
                  onClick={downloadWeeklyPDF}
                  className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 text-sm rounded-lg flex items-center space-x-1.5 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Weekly</span>
                </button>
              </div>
            </div>
            
            {completedJobs.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center mb-4">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  <h3 className="text-base sm:text-lg font-medium text-gray-800">Completed Jobs</h3>
                  <span className="ml-2 text-sm text-gray-500">({completedJobs.length} jobs)</span>
                </div>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full table-auto text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 py-3 text-left font-medium text-gray-700">Item Code</th>
                        <th className="px-3 py-3 text-left font-medium text-gray-700">LM Code</th>
                        <th className="px-3 py-3 text-left font-medium text-gray-700">Units</th>
                        <th className="px-3 py-3 text-left font-medium text-gray-700">Timer</th>
                        <th className="px-3 py-3 text-left font-medium text-gray-700">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedJobs.map((job, index) => (
                        <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-3 font-medium text-gray-900">{job.itemCode}</td>
                          <td className="px-3 py-3 text-gray-700">{job.lmCode}</td>
                          <td className="px-3 py-3 font-medium text-blue-600">{job.unitsCompleted}</td>
                          <td className="px-3 py-3 text-xs text-gray-500">
                            {job.actualTimeTaken ? (
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                job.actualTimeTaken / 60 <= job.time 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {Math.floor(job.actualTimeTaken / 60)}:{Math.floor(job.actualTimeTaken % 60).toString().padStart(2, '0')}
                              </span>
                            ) : (
                              <span className="text-gray-400">Manual</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-500">{job.timestamp}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {lossTimeEntries.length > 0 && (
              <div>
                <div className="flex items-center mb-4">
                  <div className="w-2 h-2 bg-red-500 rounded-full mr-3"></div>
                  <h3 className="text-base sm:text-lg font-medium text-gray-800">Loss Time Entries</h3>
                  <span className="ml-2 text-sm text-gray-500">({lossTimeEntries.length} entries)</span>
                </div>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full table-auto text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-red-50">
                        <th className="px-3 py-3 text-left font-medium text-gray-700">Reason</th>
                        <th className="px-3 py-3 text-left font-medium text-gray-700">Minutes Lost</th>
                        <th className="px-3 py-3 text-left font-medium text-gray-700">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lossTimeEntries.map((entry, index) => (
                        <tr key={index} className="border-b border-gray-100 hover:bg-red-50">
                          <td className="px-3 py-3 font-medium text-red-700">{entry.reason}</td>
                          <td className="px-3 py-3 text-red-600 font-medium">{entry.minutes}</td>
                          <td className="px-3 py-3 text-xs text-gray-500">{entry.timestamp}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      
      {/* Timer Modal */}
      {timerState.isVisible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">⏱️ Job Timer</h2>
              <button
                onClick={closeTimer}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-6 w-6 text-gray-600" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="text-center mb-6">
                <Timer className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  {timerState.itemCode} - {timerState.lmCode}
                </h3>
                <p className="text-sm text-gray-600">
                  Expected Time: {timerState.expectedTime} minutes
                </p>
              </div>
              
              {/* Timer Display */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6 text-center">
                <div className="text-4xl font-mono font-bold text-blue-600 mb-2">
                  {Math.floor(timerState.elapsedTime / 60000).toString().padStart(2, '0')}:
                  {Math.floor((timerState.elapsedTime % 60000) / 1000).toString().padStart(2, '0')}
                </div>
                <p className="text-sm text-gray-600">Elapsed Time</p>
                
                {/* Time Status */}
                {timerState.elapsedTime > 0 && (
                  <div className="mt-2">
                    {timerState.elapsedTime / 60000 > timerState.expectedTime + 1 ? (
                      <div className="text-red-600 text-sm font-medium">
                        ⚠️ Over expected time by {Math.round((timerState.elapsedTime / 60000) - timerState.expectedTime)} minutes
                        <br />
                        <span className="text-xs">Auto-completion modal will open</span>
                      </div>
                    ) : timerState.elapsedTime / 60000 > timerState.expectedTime ? (
                      <div className="text-orange-600 text-sm font-medium">
                        ⚠️ Over expected time by {Math.round((timerState.elapsedTime / 60000) - timerState.expectedTime)} minutes
                        <br />
                        <span className="text-xs">Modal will open in {Math.max(0, Math.ceil(60 - ((timerState.elapsedTime / 60000 - timerState.expectedTime) * 60)))} seconds</span>
                      </div>
                    ) : timerState.elapsedTime / 60000 > timerState.expectedTime * 0.8 ? (
                      <div className="text-yellow-600 text-sm font-medium">
                        ⏰ Approaching expected time ({Math.round(timerState.expectedTime - (timerState.elapsedTime / 60000))} minutes remaining)
                      </div>
                    ) : (
                      <div className="text-green-600 text-sm font-medium">
                        ✅ Within expected time
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Timer Controls */}
              <div className="flex justify-center space-x-4 mb-6">
                {!timerState.isActive ? (
                  <button
                    onClick={startTimer}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
                  >
                    <Play className="h-5 w-5" />
                    <span>Start Timer</span>
                  </button>
                ) : timerState.isPaused ? (
                  <button
                    onClick={resumeTimer}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                  >
                    <Play className="h-5 w-5" />
                    <span>Resume</span>
                  </button>
                ) : (
                  <button
                    onClick={pauseTimer}
                    className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center space-x-2"
                  >
                    <Pause className="h-5 w-5" />
                    <span>Pause</span>
                  </button>
                )}
                
                {timerState.isActive && (
                  <button
                    onClick={stopTimer}
                    className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2"
                  >
                    <Square className="h-5 w-5" />
                    <span>Complete Job</span>
                  </button>
                )}
              </div>
              
              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Progress</span>
                  <span>
                    {Math.round((timerState.elapsedTime / 60000) / timerState.expectedTime * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      timerState.elapsedTime / 60000 > timerState.expectedTime 
                        ? 'bg-red-600' 
                        : 'bg-blue-600'
                    }`}
                    style={{ 
                      width: `${Math.min((timerState.elapsedTime / 60000) / timerState.expectedTime * 100, 100)}%` 
                    }}
                  ></div>
                </div>
              </div>
              
              <div className="text-center text-sm text-gray-600">
                <p>Timer tracks time from item selection to completion</p>
                <p className="text-xs text-gray-500 mt-1">
                  You can close this and log manually, or use the timer to track actual time
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Completion Modal */}
      {showAutoCompletionModal && autoCompletionData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm sm:max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 sm:p-6 border-b">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">⏰ Time Exceeded</h2>
              <button
                onClick={() => {
                  setShowAutoCompletionModal(false);
                  setAutoCompletionData(null);
                  setAutoCompletionUnits('');
                }}
                className="p-1 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600" />
              </button>
            </div>
            
            <div className="p-4 sm:p-6">
              <div className="text-center mb-4 sm:mb-6">
                <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">⏱️</div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-2">
                  {autoCompletionData.itemCode} - {autoCompletionData.lmCode}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 mb-2">
                  Expected: {autoCompletionData.expectedTime} min
                </p>
                <p className="text-xs sm:text-sm text-red-600 font-medium">
                  ⚠️ Over by {Math.round((autoCompletionData.elapsedTime / 60000) - autoCompletionData.expectedTime)} min
                </p>
              </div>
              
              {/* Units Input */}
              <div className="mb-4 sm:mb-6">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Units Completed
                </label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    value={autoCompletionUnits}
                    onChange={(e) => setAutoCompletionUnits(e.target.value)}
                    placeholder="Enter units"
                    min="0"
                    max={autoCompletionData.item.quantity}
                    className="flex-1 p-2 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <button
                    onClick={() => setAutoCompletionUnits(autoCompletionData.item.quantity.toString())}
                    className="px-3 sm:px-4 py-2 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    100%
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Target: {autoCompletionData.item.quantity} units
                </p>
              </div>
              
              {/* Timer Info */}
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
                <div className="text-center">
                  <div className="text-xl sm:text-2xl font-mono font-bold text-blue-600 mb-1">
                    {Math.floor(autoCompletionData.elapsedTime / 60000)}:{Math.floor((autoCompletionData.elapsedTime % 60000) / 1000).toString().padStart(2, '0')}
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600">Total Time Elapsed</p>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex space-x-2 sm:space-x-3">
                <button
                  onClick={handleAutoCompletionSubmit}
                  className="flex-1 bg-green-600 text-white py-2 sm:py-3 px-3 sm:px-4 rounded-lg hover:bg-green-700 font-medium text-sm"
                >
                  ✅ Complete Job
                </button>
                <button
                  onClick={() => {
                    setShowAutoCompletionModal(false);
                    setAutoCompletionData(null);
                    setAutoCompletionUnits('');
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 sm:py-3 px-3 sm:px-4 rounded-lg hover:bg-gray-400 font-medium text-sm"
                >
                  Cancel
                </button>
              </div>
              
              <div className="mt-3 sm:mt-4 text-center text-xs sm:text-sm text-gray-600">
                <p>Job will be logged with expected time as actual time</p>
                <p className="text-xs text-gray-500 mt-1">
                  Real elapsed time will be recorded in timer data
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-800">📱 Scan QR Code</h2>
              <button
                onClick={() => setShowQRModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-6 w-6 text-gray-600" />
              </button>
            </div>
            
            <div className="p-6 text-center">
              <p className="text-gray-600 mb-4">
                Scan this QR code with your phone to access the Production Tracker
              </p>
              
              {/* QR Code Image */}
              <div className="flex justify-center mb-4">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.origin)}&bgcolor=ffffff&color=000000&qzone=1&margin=0`}
                  alt="QR Code for Production Tracker"
                  className="border border-gray-200 rounded-lg"
                />
              </div>
              
              <div className="text-sm text-gray-500 mb-4">
                <p className="font-medium">Current URL:</p>
                <p className="break-all text-blue-600">{window.location.origin}</p>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-800 mb-2">📝 Instructions:</h3>
                <ol className="text-left text-sm text-blue-700 space-y-1">
                  <li>1. Open your phone's camera app</li>
                  <li>2. Point it at the QR code above</li>
                  <li>3. Tap the notification that appears</li>
                  <li>4. Access the Production Tracker on your phone!</li>
                </ol>
              </div>
              
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-semibold text-yellow-800 mb-2">⚠️ WiFi Network Blocking the Site?</h4>
                <div className="text-xs text-yellow-700 space-y-2">
                  <p><strong>Quick fixes to try:</strong></p>
                  <ul className="space-y-1 pl-4">
                    <li>• Use your phone's <strong>mobile data</strong> instead of WiFi</li>
                    <li>• Try accessing via <strong>HTTPS</strong>: {window.location.origin.replace('http:', 'https:')}</li>
                    <li>• Create a mobile hotspot from your phone</li>
                    <li>• Use a different WiFi network if available</li>
                  </ul>
                  
                  <div className="mt-3 pt-2 border-t border-yellow-300">
                    <p><strong>For IT/Admin teams:</strong></p>
                    <ul className="space-y-1 pl-4">
                      <li>• Whitelist domain: <code className="bg-yellow-100 px-1 rounded">{window.location.hostname}</code></li>
                      <li>• Allow ports: 80 (HTTP), 443 (HTTPS), 3000 (dev)</li>
                      <li>• Check firewall/content filter settings</li>
                      <li>• Verify DNS resolution is working</li>
                    </ul>
                  </div>
                  
                  {networkIssues.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-yellow-300">
                      <p><strong>Detected issues:</strong></p>
                      <ul className="space-y-1 pl-4">
                        {networkIssues.map((issue, index) => (
                          <li key={index}>• {issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-xs text-green-700">
                  💡 <strong>Tip:</strong> You can bookmark the site on your phone for quick access later!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Modal for Historical Data */}
      {showCalendarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-800">📅 Historical Data</h2>
              <button
                onClick={() => {
                  setShowCalendarModal(false);
                  setSelectedHistoryDate('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-6 w-6 text-gray-600" />
              </button>
            </div>
            
            <div className="p-6">
              {/* Calendar Grid */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">Select Date to View</label>
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {/* Day Headers */}
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                    <div key={day} className="text-center text-xs sm:text-sm font-medium text-gray-500 p-2">
                      {day}
                    </div>
                  ))}
                  
                  {/* Calendar Days */}
                  {(() => {
                    const currentWeekStart = new Date();
                    currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay() + 1); // Monday
                    
                    const days = [];
                    for (let i = 0; i < 7; i++) {
                      const date = new Date(currentWeekStart);
                      date.setDate(currentWeekStart.getDate() + i);
                      const dateString = date.toISOString().split('T')[0];
                      const hasData = allDailyData[dateString];
                      const isAccessible = canAccessDate(dateString);
                      const isSelected = selectedHistoryDate === dateString;
                      const isToday = dateString === new Date().toISOString().split('T')[0];
                      
                      days.push(
                        <button
                          key={dateString}
                          onClick={() => {
                            if (isAccessible) {
                              setSelectedHistoryDate(dateString);
                            }
                          }}
                          disabled={!isAccessible}
                          className={`
                            p-2 sm:p-3 text-xs sm:text-sm rounded-lg transition-all duration-200
                            ${isSelected 
                              ? 'bg-blue-600 text-white font-semibold' 
                              : isAccessible 
                                ? hasData 
                                  ? 'bg-green-100 hover:bg-green-200 text-green-800 font-medium cursor-pointer' 
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer'
                                : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                            }
                            ${isToday ? 'ring-2 ring-blue-300' : ''}
                          `}
                          title={isAccessible ? `View data for ${formatDateForDisplay(dateString)}` : 'Date not accessible'}
                        >
                          <div className="text-center">
                            <div className="font-medium">{date.getDate()}</div>
                            {hasData && (
                              <div className="text-xs mt-1">
                                <span className="inline-block w-1 h-1 bg-green-500 rounded-full"></span>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    }
                    return days;
                  })()}
                </div>
              </div>
              
              {/* Historical Data Display */}
              {selectedHistoryDate && allDailyData[selectedHistoryDate] && (
                <div className="space-y-6">
                  {/* Download PDF Button */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        const dailyData = allDailyData[selectedHistoryDate];
                        if (dailyData) {
                          downloadHistoricalPDF(selectedHistoryDate, dailyData);
                        }
                      }}
                      className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      <span className="hidden sm:inline">Download PDF</span>
                      <span className="sm:hidden">PDF</span>
                    </button>
                  </div>
                  
                  {/* Summary Stats */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-3">📊 {formatDateForDisplay(selectedHistoryDate)} Summary</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {allDailyData[selectedHistoryDate].completedJobs.reduce((sum, job) => sum + job.actualMinutes, 0).toFixed(1)}
                        </div>
                        <div className="text-sm text-gray-600">Minutes</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {allDailyData[selectedHistoryDate].completedJobs.length}
                        </div>
                        <div className="text-sm text-gray-600">Jobs</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {allDailyData[selectedHistoryDate].lossTimeEntries.reduce((sum, entry) => sum + entry.minutes, 0)}
                        </div>
                        <div className="text-sm text-gray-600">Loss Time</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {(() => {
                            const completedMinutes = allDailyData[selectedHistoryDate].completedJobs.reduce((sum, job) => sum + job.actualMinutes, 0);
                            const lossTime = allDailyData[selectedHistoryDate].lossTimeEntries.reduce((sum, entry) => sum + entry.minutes, 0);
                            const adjustedTarget = TARGET_MINUTES - lossTime;
                            const percentage = adjustedTarget > 0 ? Math.min((completedMinutes / adjustedTarget) * 100, 100) : 100;
                            return percentage.toFixed(1);
                          })()}%
                        </div>
                        <div className="text-sm text-gray-600">Achieved</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          {allDailyData[selectedHistoryDate].isFinished ? '✓' : '○'}
                        </div>
                        <div className="text-sm text-gray-600">Status</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Completed Jobs */}
                  {allDailyData[selectedHistoryDate].completedJobs.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3">✅ Completed Jobs</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full table-auto text-sm">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="px-4 py-2 text-left">Item Code</th>
                              <th className="px-4 py-2 text-left">LM Code</th>
                              <th className="px-4 py-2 text-left">Units</th>
                              <th className="px-4 py-2 text-left">Minutes</th>
                              <th className="px-4 py-2 text-left">Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allDailyData[selectedHistoryDate].completedJobs.map((job, index) => (
                              <tr key={index} className="border-b border-gray-100">
                                <td className="px-4 py-2 font-medium">{job.itemCode}</td>
                                <td className="px-4 py-2">{job.lmCode}</td>
                                <td className="px-4 py-2 font-medium text-blue-600">{job.unitsCompleted}</td>
                                <td className="px-4 py-2">{job.actualMinutes.toFixed(1)}</td>
                                <td className="px-4 py-2 text-xs">{job.timestamp}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  
                  {/* Loss Time Entries */}
                  {allDailyData[selectedHistoryDate].lossTimeEntries.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-red-700">⚠️ Loss Time Entries</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full table-auto text-sm">
                          <thead>
                            <tr className="bg-red-50">
                              <th className="px-4 py-2 text-left">Reason</th>
                              <th className="px-4 py-2 text-left">Minutes Lost</th>
                              <th className="px-4 py-2 text-left">Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allDailyData[selectedHistoryDate].lossTimeEntries.map((entry, index) => (
                              <tr key={index} className="border-b border-gray-100">
                                <td className="px-4 py-2 font-medium text-red-700">{entry.reason}</td>
                                <td className="px-4 py-2 text-red-600">{entry.minutes}</td>
                                <td className="px-4 py-2 text-xs">{entry.timestamp}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  
                  {/* Finish Time */}
                  {allDailyData[selectedHistoryDate].isFinished && (
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h3 className="text-lg font-semibold text-green-700 mb-2">🏁 Work Day Finished</h3>
                      <p className="text-green-600">
                        Completed at: {allDailyData[selectedHistoryDate].finishTime}
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* No Data Message */}
              {selectedHistoryDate && !allDailyData[selectedHistoryDate] && (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">📅</div>
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">No Data Available</h3>
                  <p className="text-gray-500">
                    No production data was recorded for {formatDateForDisplay(selectedHistoryDate)}
                  </p>
                </div>
              )}
              
              {/* Instructions */}
              {!selectedHistoryDate && (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">📅</div>
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">Select a Date</h3>
                  <p className="text-gray-500">
                    Choose a date above to view historical production data
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Admin Panel Modal */}
      {showAdminPanel && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-800">👑 Admin Panel</h2>
              <button
                onClick={() => setShowAdminPanel(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-6 w-6 text-gray-600" />
              </button>
            </div>
            
            <div className="p-6">
              {isLoadingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  <span className="ml-3 text-gray-600">Loading users...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-800">User Management</h3>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          const today = new Date().toISOString().split('T')[0];
                          if (window.confirm(`🔄 Reset ALL users' data for today (${today})?\n\nThis will affect ${allUsers.length} users.`)) {
                            allUsers.forEach(user => handleResetUserData(user.uid, today));
                          }
                        }}
                        className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded-lg text-sm"
                        title="Reset today's data for all users"
                      >
                        🔄 Reset All Today
                      </button>
                      <button
                        onClick={loadAllUsers}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm"
                      >
                        🔄 Refresh
                      </button>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full table-auto text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Email</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allUsers.map((user) => (
                          <tr key={user.uid} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                            <td className="px-4 py-3 text-gray-700">
                              <button
                                onClick={() => handleEditUserData(user)}
                                className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                                title="Click to edit user data"
                              >
                                {user.email}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                user.isBlocked 
                                  ? 'bg-red-100 text-red-800' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {user.isBlocked ? 'Blocked' : 'Active'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                <button
                                  onClick={() => handleBlockUser(user.uid, !user.isBlocked)}
                                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                    user.isBlocked
                                      ? 'bg-green-600 hover:bg-green-700 text-white'
                                      : 'bg-red-600 hover:bg-red-700 text-white'
                                  }`}
                                >
                                  {user.isBlocked ? '✅ Unblock' : '🚫 Block'}
                                </button>
                                <button
                                  onClick={() => {
                                    const today = new Date().toISOString().split('T')[0];
                                    if (window.confirm(`🔄 Reset ${user.name}'s data for today (${today})?`)) {
                                      handleResetUserData(user.uid, today);
                                    }
                                  }}
                                  className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-xs font-medium transition-colors"
                                  title="Reset today's data for this user"
                                >
                                  🔄 Today
                                </button>
                                <button
                                  onClick={() => {
                                    const date = window.prompt('📅 Enter date (YYYY-MM-DD) to reset:');
                                    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
                                      if (window.confirm(`🔄 Reset ${user.name}'s data for ${date}?`)) {
                                        handleResetUserData(user.uid, date);
                                      }
                                    } else if (date) {
                                      window.alert('❌ Please enter a valid date in YYYY-MM-DD format');
                                    }
                                  }}
                                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
                                  title="Reset data for a specific date"
                                >
                                  📅 Date
                                </button>
                                <button
                                  onClick={() => {
                                    const dates = ['Monday', 'Tuesday', 'Wednesday', 'Thursday'];
                                    const thisWeek = dates.map((_, i) => {
                                      const d = new Date();
                                      const monday = new Date(d.setDate(d.getDate() - d.getDay() + 1));
                                      return new Date(monday.getTime() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                                    });
                                    if (window.confirm(`🗓️ Reset ${user.name}'s data for the entire current week?\n\nDates: ${thisWeek.join(', ')}`)) {
                                      thisWeek.forEach(date => handleResetUserData(user.uid, date));
                                    }
                                  }}
                                  className="px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs font-medium transition-colors"
                                  title="Reset all data for current week"
                                >
                                  🗓️ Week
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(user.uid, user.name)}
                                  className="px-2 py-1 bg-red-800 hover:bg-red-900 text-white rounded text-xs font-medium transition-colors"
                                  title="Delete user permanently"
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {allUsers.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No users found
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* User Data Editor Modal */}
      {showUserDataEditor && selectedUserForEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-800">
                📝 Edit Data for {selectedUserForEdit.name}
              </h2>
              <button
                onClick={() => setShowUserDataEditor(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-6 w-6 text-gray-600" />
              </button>
            </div>
            
            <div className="p-6">
              {isLoadingUserData ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600">Loading user data...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Date Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
                    <select
                      value={editingSelectedDate}
                      onChange={(e) => setEditingSelectedDate(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {Object.keys(editingUserData).map(date => (
                        <option key={date} value={date}>
                          {formatDateForDisplay(date)}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Current Data Display */}
                  {editingSelectedDate && editingUserData[editingSelectedDate] && (
                    <div className="space-y-6">
                      {/* Completed Jobs */}
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Completed Jobs</h3>
                        {editingUserData[editingSelectedDate].completedJobs.length > 0 ? (
                          <div className="overflow-x-auto border border-gray-200 rounded-lg">
                            <table className="w-full table-auto text-sm">
                              <thead>
                                <tr className="bg-gray-50">
                                  <th className="px-4 py-3 text-left font-medium text-gray-700">Item Code</th>
                                  <th className="px-4 py-3 text-left font-medium text-gray-700">LM Code</th>
                                  <th className="px-4 py-3 text-left font-medium text-gray-700">Units</th>
                                  <th className="px-4 py-3 text-left font-medium text-gray-700">Minutes</th>
                                  <th className="px-4 py-3 text-left font-medium text-gray-700">Time</th>
                                  <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {editingUserData[editingSelectedDate].completedJobs.map((job, index) => (
                                  <tr key={job.id} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-gray-900">
                                      {editingJobId === job.id && editingField === 'itemCode' ? (
                                        <div className="flex items-center space-x-2">
                                          <input
                                            type="text"
                                            value={editingValue}
                                            onChange={(e) => setEditingValue(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') saveEdit();
                                              if (e.key === 'Escape') cancelEdit();
                                            }}
                                            className="w-24 px-2 py-1 border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                                            autoFocus
                                          />
                                          <button
                                            onClick={saveEdit}
                                            className="text-green-600 hover:text-green-800 text-xs"
                                            title="Save"
                                          >
                                            ✓
                                          </button>
                                          <button
                                            onClick={cancelEdit}
                                            className="text-red-600 hover:text-red-800 text-xs"
                                            title="Cancel"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => startEditing(job.id, 'itemCode', job.itemCode)}
                                          className="hover:bg-blue-50 px-2 py-1 rounded text-left w-full"
                                          title="Click to edit"
                                        >
                                          {job.itemCode}
                                        </button>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">
                                      {editingJobId === job.id && editingField === 'lmCode' ? (
                                        <div className="flex items-center space-x-2">
                                          <input
                                            type="text"
                                            value={editingValue}
                                            onChange={(e) => setEditingValue(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') saveEdit();
                                              if (e.key === 'Escape') cancelEdit();
                                            }}
                                            className="w-24 px-2 py-1 border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                                            autoFocus
                                          />
                                          <button
                                            onClick={saveEdit}
                                            className="text-green-600 hover:text-green-800 text-xs"
                                            title="Save"
                                          >
                                            ✓
                                          </button>
                                          <button
                                            onClick={cancelEdit}
                                            className="text-red-600 hover:text-red-800 text-xs"
                                            title="Cancel"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => startEditing(job.id, 'lmCode', job.lmCode)}
                                          className="hover:bg-blue-50 px-2 py-1 rounded text-left w-full"
                                          title="Click to edit"
                                        >
                                          {job.lmCode}
                                        </button>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-blue-600">
                                      {editingJobId === job.id && editingField === 'unitsCompleted' ? (
                                        <div className="flex items-center space-x-2">
                                          <input
                                            type="number"
                                            value={editingValue}
                                            onChange={(e) => setEditingValue(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') saveEdit();
                                              if (e.key === 'Escape') cancelEdit();
                                            }}
                                            className="w-16 px-2 py-1 border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                                            autoFocus
                                          />
                                          <button
                                            onClick={saveEdit}
                                            className="text-green-600 hover:text-green-800 text-xs"
                                            title="Save"
                                          >
                                            ✓
                                          </button>
                                          <button
                                            onClick={cancelEdit}
                                            className="text-red-600 hover:text-red-800 text-xs"
                                            title="Cancel"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => startEditing(job.id, 'unitsCompleted', job.unitsCompleted)}
                                          className="hover:bg-blue-50 px-2 py-1 rounded text-left w-full"
                                          title="Click to edit"
                                        >
                                          {job.unitsCompleted}
                                        </button>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">
                                      {editingJobId === job.id && editingField === 'actualMinutes' ? (
                                        <div className="flex items-center space-x-2">
                                          <input
                                            type="number"
                                            step="0.1"
                                            value={editingValue}
                                            onChange={(e) => setEditingValue(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') saveEdit();
                                              if (e.key === 'Escape') cancelEdit();
                                            }}
                                            className="w-16 px-2 py-1 border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                                            autoFocus
                                          />
                                          <button
                                            onClick={saveEdit}
                                            className="text-green-600 hover:text-green-800 text-xs"
                                            title="Save"
                                          >
                                            ✓
                                          </button>
                                          <button
                                            onClick={cancelEdit}
                                            className="text-red-600 hover:text-red-800 text-xs"
                                            title="Cancel"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => startEditing(job.id, 'actualMinutes', job.actualMinutes)}
                                          className="hover:bg-blue-50 px-2 py-1 rounded text-left w-full"
                                          title="Click to edit"
                                        >
                                          {job.actualMinutes.toFixed(1)}
                                        </button>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-500">{job.timestamp}</td>
                                    <td className="px-4 py-3">
                                      <button
                                        onClick={() => handleDeleteJob(job.id)}
                                        className="text-red-600 hover:text-red-800 text-xs font-medium"
                                        title="Delete this job"
                                      >
                                        🗑️ Delete
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-gray-500 text-center py-4">No completed jobs for this date</p>
                        )}
                      </div>
                      
                      {/* Loss Time Entries */}
                      <div>
                        <h3 className="text-lg font-semibold mb-4 text-red-700">Loss Time Entries</h3>
                        {editingUserData[editingSelectedDate].lossTimeEntries.length > 0 ? (
                          <div className="overflow-x-auto border border-gray-200 rounded-lg">
                            <table className="w-full table-auto text-sm">
                              <thead>
                                <tr className="bg-red-50">
                                  <th className="px-4 py-3 text-left font-medium text-gray-700">Reason</th>
                                  <th className="px-4 py-3 text-left font-medium text-gray-700">Minutes Lost</th>
                                  <th className="px-4 py-3 text-left font-medium text-gray-700">Time</th>
                                  <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {editingUserData[editingSelectedDate].lossTimeEntries.map((entry, index) => (
                                  <tr key={entry.id} className="border-b border-gray-100 hover:bg-red-50">
                                    <td className="px-4 py-3 font-medium text-red-700">{entry.reason}</td>
                                    <td className="px-4 py-3 text-red-600 font-medium">{entry.minutes}</td>
                                    <td className="px-4 py-3 text-xs text-gray-500">{entry.timestamp}</td>
                                    <td className="px-4 py-3">
                                      <button
                                        onClick={() => handleDeleteLossTime(entry.id)}
                                        className="text-red-600 hover:text-red-800 text-xs font-medium"
                                        title="Delete this loss time entry"
                                      >
                                        🗑️ Delete
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-gray-500 text-center py-4">No loss time entries for this date</p>
                        )}
                      </div>
                      
                      {/* Summary */}
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-semibold mb-2">Summary for {formatDateForDisplay(editingSelectedDate)}</h4>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Completed Minutes:</span>
                            <span className="ml-2 text-blue-600">
                              {editingUserData[editingSelectedDate].completedJobs.reduce((sum, job) => sum + job.actualMinutes, 0).toFixed(1)}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Loss Time:</span>
                            <span className="ml-2 text-red-600">
                              {editingUserData[editingSelectedDate].lossTimeEntries.reduce((sum, entry) => sum + entry.minutes, 0)} minutes
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Status:</span>
                            <span className={`ml-2 ${editingUserData[editingSelectedDate].isFinished ? 'text-green-600' : 'text-yellow-600'}`}>
                              {editingUserData[editingSelectedDate].isFinished ? 'Finished' : 'In Progress'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Save Button */}
                      <div className="flex justify-end space-x-3">
                        <button
                          onClick={() => setShowUserDataEditor(false)}
                          className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveUserData}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {editingSelectedDate && !editingUserData[editingSelectedDate] && (
                    <div className="text-center py-8 text-gray-500">
                      No data available for {formatDateForDisplay(editingSelectedDate)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      

      

    </div>
  );
};

export default ProductionTracker; 