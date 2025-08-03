import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Clock, Target, CheckCircle, AlertCircle, StopCircle, Plus, Trash2, Download, Calendar, X, LogOut } from 'lucide-react';
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
  deleteUser
} from '../firebaseService';

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
  
  // Loss Time tracking
  const [lossTimeEntries, setLossTimeEntries] = useState<LossTimeEntry[]>([]);
  const [selectedLossReason, setSelectedLossReason] = useState('');
  const [lossTimeMinutes, setLossTimeMinutes] = useState('');
  const [showLossTimeForm, setShowLossTimeForm] = useState(false);
  
  // Calendar modal state
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<string>('');
  
  // Search suggestions state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredItems, setFilteredItems] = useState<ProductionItem[]>([]);

  const lossReasons = [
    'Waiting for Parts', 'Waiting Jobs', 'Cleaning', 'Maintenance', 
    'Machine Error', 'Needle Change', 'Full Track', 'Back Rack', 'Other'
  ];

  // Firebase authentication effect
  useEffect(() => {
    const unsubscribe = onAuthChange((user: any) => {
      if (user) {
        setIsLoggedIn(true);
        setUserEmail(user.email || '');
        setUserId(user.uid);
        loadUserProfile(user.uid);
        loadAllDailyData(user.uid);
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

  // Load all daily data for user
  const loadAllDailyData = async (uid: string) => {
    try {
      const data = await getAllDailyData(uid);
      setAllDailyData(data);
    } catch (error) {
      console.error('Error loading daily data:', error);
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
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const currentTime = hours * 60 + minutes;
    const startTime = 6 * 60 + 55; // 06:55 AM
    const endTime = 16 * 60 + 35; // 16:35 PM (4:35 PM)
    
    return currentTime >= startTime && currentTime <= endTime;
  };

  const isWorkingDay = (date: Date): boolean => {
    const day = date.getDay();
    return day >= 1 && day <= 4; // Monday (1) to Thursday (4)
  };

  const canAccessDate = (dateString: string): boolean => {
    const date = new Date(dateString);
    const today = new Date();
    
    // Check if it's a working day
    if (!isWorkingDay(date)) return false;
    
    // Check if it's today and within working hours
    if (dateString === today.toISOString().split('T')[0]) {
      return isWithinWorkingHours(today);
    }
    
    // For past dates, always allow access
    if (date < today) return true;
    
    // For future dates, only allow if admin or if it's the next working day
    const workingDays = getWorkingDays();
    const todayIndex = workingDays.indexOf(today.toISOString().split('T')[0]);
    const dateIndex = workingDays.indexOf(dateString);
    
    if (todayIndex === -1 || dateIndex === -1) return false;
    
    // Allow access to next day only if current day is finished
    if (dateIndex === todayIndex + 1) {
      const currentDayData = allDailyData[workingDays[todayIndex]];
      return currentDayData?.isFinished || isAdmin;
    }
    
    // For dates beyond next day, only admin can access
    return isAdmin;
  };

  // Update current time every minute
  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setIsWithinWorkingHoursState(isWithinWorkingHours(now));
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
    if (selectedDate) {
      if (allDailyData[selectedDate]) {
        setCompletedJobs(allDailyData[selectedDate].completedJobs);
        setLossTimeEntries(allDailyData[selectedDate].lossTimeEntries);
      } else {
        setCompletedJobs([]);
        setLossTimeEntries([]);
      }
    }
  }, [selectedDate, allDailyData]);

  // Save data when it changes
  React.useEffect(() => {
    if (selectedDate && !isSwitchingDate && (completedJobs.length > 0 || lossTimeEntries.length > 0)) {
      setAllDailyData(prev => ({
        ...prev,
        [selectedDate]: {
          date: selectedDate,
          completedJobs,
          lossTimeEntries,
          isFinished: prev[selectedDate]?.isFinished || false,
          finishTime: prev[selectedDate]?.finishTime
        }
      }));
    }
  }, [completedJobs, lossTimeEntries, selectedDate, isSwitchingDate]);

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
      timestamp: new Date().toLocaleTimeString(),
      id: Date.now()
    };

    const updatedJobs = [...completedJobs, newJob];
    setCompletedJobs(updatedJobs);

    // Save to Firebase
    try {
      const dailyData = {
        date: selectedDate,
        completedJobs: updatedJobs,
        lossTimeEntries,
        isFinished: allDailyData[selectedDate]?.isFinished || false,
        finishTime: allDailyData[selectedDate]?.finishTime
      };
      await saveDailyData(userId, selectedDate, dailyData);
      
      // Update local state
      setAllDailyData(prev => ({
        ...prev,
        [selectedDate]: dailyData
      }));
    } catch (error) {
      console.error('Error saving job:', error);
    }

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
    setSearchInput(item.itemCode);
    setSelectedItem(item.itemCode);
    setShowSuggestions(false);
    setFilteredItems([]);
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

    // Save to Firebase
    try {
      const dailyData = {
        date: selectedDate,
        completedJobs,
        lossTimeEntries: updatedLossEntries,
        isFinished: allDailyData[selectedDate]?.isFinished || false,
        finishTime: allDailyData[selectedDate]?.finishTime
      };
      await saveDailyData(userId, selectedDate, dailyData);
      
      // Update local state
      setAllDailyData(prev => ({
        ...prev,
        [selectedDate]: dailyData
      }));
    } catch (error) {
      console.error('Error saving loss time:', error);
    }

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
      await saveDailyData(userId, selectedDate, dailyData);
      
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
    } catch (error) {
      console.error('Error updating user block status:', error);
    }
  };

  const handleResetUserData = async (userId: string, date: string) => {
    try {
      await resetUserDailyData(userId, date);
      alert(`Data reset for user on ${date}`);
    } catch (error) {
      console.error('Error resetting user data:', error);
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
        window.alert(`User "${userName}" has been deleted successfully.`);
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      window.alert('Error deleting user. Please try again.');
    }
  };

  // User data editing functions
  const handleEditUserData = async (user: {uid: string, email: string, name: string}) => {
    try {
      setIsLoadingUserData(true);
      setSelectedUserForEdit(user);
      
      // Load user's daily data
      const userData = await getAllDailyData(user.uid);
      setEditingUserData(userData);
      
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

  // Load users when admin panel is opened
  React.useEffect(() => {
    if (showAdminPanel && isAdmin) {
      loadAllUsers();
    }
  }, [showAdminPanel, isAdmin, loadAllUsers]);

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
          
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">🔒 Your data is securely stored in the cloud</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-0 sm:p-6 min-h-screen bg-gray-50">
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
                Welcome back, {userName.split(' ').map(n => n[0]).join('')}! 👋
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
            </div>
            
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
                disabled={allDailyData[selectedDate]?.isFinished}
                className={`px-2 py-1 text-xs rounded-lg font-medium transition-colors ${
                  allDailyData[selectedDate]?.isFinished
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
                  <p className="text-xs text-yellow-700">Access is only available between 06:55 AM and 16:35 PM on working days</p>
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
                  onChange={(e) => setSelectedItem(e.target.value)}
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
              disabled={(!selectedItem && !getCurrentItem()) || !completedQuantity}
              className="w-full bg-blue-600 text-white py-2 sm:py-3 px-3 sm:px-4 text-sm sm:text-base rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Log Completion
            </button>

            {/* Loss Time Section */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-medium">Loss Time Tracking</h3>
                <button
                  onClick={() => setShowLossTimeForm(!showLossTimeForm)}
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg flex items-center space-x-1"
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
                      disabled={!selectedLossReason || !lossTimeMinutes}
                      className="bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 disabled:bg-gray-400"
                    >
                      Log Loss Time
                    </button>
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
                        <th className="px-3 py-3 text-left font-medium text-gray-700">Minutes</th>
                        <th className="px-3 py-3 text-left font-medium text-gray-700">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedJobs.map((job, index) => (
                        <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-3 font-medium text-gray-900">{job.itemCode}</td>
                          <td className="px-3 py-3 text-gray-700">{job.lmCode}</td>
                          <td className="px-3 py-3 font-medium text-blue-600">{job.unitsCompleted}</td>
                          <td className="px-3 py-3 text-gray-700">{job.actualMinutes.toFixed(1)}</td>
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
              {/* Date Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Date to View</label>
                <input
                  type="date"
                  value={selectedHistoryDate}
                  onChange={(e) => setSelectedHistoryDate(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              {/* Historical Data Display */}
              {selectedHistoryDate && allDailyData[selectedHistoryDate] && (
                <div className="space-y-6">
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
                    <button
                      onClick={loadAllUsers}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm"
                    >
                      Refresh
                    </button>
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
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleBlockUser(user.uid, !user.isBlocked)}
                                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                    user.isBlocked
                                      ? 'bg-green-600 hover:bg-green-700 text-white'
                                      : 'bg-red-600 hover:bg-red-700 text-white'
                                  }`}
                                >
                                  {user.isBlocked ? 'Unblock' : 'Block'}
                                </button>
                                <button
                                  onClick={() => {
                                    const today = new Date().toISOString().split('T')[0];
                                    if (window.confirm(`Reset ${user.name}'s data for today (${today})?`)) {
                                      handleResetUserData(user.uid, today);
                                    }
                                  }}
                                  className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-xs font-medium transition-colors"
                                >
                                  Reset Today
                                </button>
                                <button
                                  onClick={() => {
                                    const date = window.prompt('Enter date (YYYY-MM-DD) to reset:');
                                    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
                                      if (window.confirm(`Reset ${user.name}'s data for ${date}?`)) {
                                        handleResetUserData(user.uid, date);
                                      }
                                    } else if (date) {
                                      window.alert('Please enter a valid date in YYYY-MM-DD format');
                                    }
                                  }}
                                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
                                >
                                  Reset Date
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(user.uid, user.name)}
                                  className="px-3 py-1 bg-red-800 hover:bg-red-900 text-white rounded text-xs font-medium transition-colors"
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