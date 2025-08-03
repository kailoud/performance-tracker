import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Clock, Target, CheckCircle, AlertCircle, StopCircle, Plus, Trash2, Download, Calendar, X } from 'lucide-react';
import jsPDF from 'jspdf';

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
  
  // Loss Time tracking
  const [lossTimeEntries, setLossTimeEntries] = useState<LossTimeEntry[]>([]);
  const [selectedLossReason, setSelectedLossReason] = useState('');
  const [lossTimeMinutes, setLossTimeMinutes] = useState('');
  const [showLossTimeForm, setShowLossTimeForm] = useState(false);
  
  // Calendar modal state
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<string>('');

  const lossReasons = [
    'Waiting for Parts', 'Waiting Jobs', 'Cleaning', 'Maintenance', 
    'Machine Error', 'Needle Change', 'Full Track', 'Back Rack', 'Other'
  ];
  
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

  // Initialize selected date if not set
  React.useEffect(() => {
    if (!selectedDate && isLoggedIn) {
      const today = getCurrentDateKey();
      const workingDays = getWorkingDays();
      if (workingDays.includes(today)) {
        setSelectedDate(today);
      } else {
        setSelectedDate(workingDays[0]); // Default to Monday
      }
    }
  }, [isLoggedIn, selectedDate]);

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

  const handleSubmit = () => {
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

    setCompletedJobs(prev => [...prev, newJob]);
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

  const handleLossTimeSubmit = () => {
    if (!selectedLossReason || !lossTimeMinutes) return;

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

    setLossTimeEntries(prev => [...prev, newLossEntry]);
    setSelectedLossReason('');
    setLossTimeMinutes('');
    setShowLossTimeForm(false);
  };

  const deleteLossTimeEntry = (id: number) => {
    setLossTimeEntries(prev => prev.filter(entry => entry.id !== id));
  };

  const finishWorkDay = () => {
    const finishTime = new Date().toLocaleTimeString();
    
    // Save current day as finished
    setAllDailyData(prev => ({
      ...prev,
      [selectedDate]: {
        date: selectedDate,
        completedJobs,
        lossTimeEntries,
        isFinished: true,
        finishTime
      }
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

  const handleLogin = () => {
    if (!loginEmail || !loginName) {
      alert('Please enter both email and name');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(loginEmail)) {
      alert('Please enter a valid email address');
      return;
    }

    setUserEmail(loginEmail);
    setUserName(loginName);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserEmail('');
    setUserName('');
    setLoginEmail('');
    setLoginName('');
    setCompletedJobs([]);
    setLossTimeEntries([]);
    setSelectedDate('');
    setAllDailyData({});
  };

  // Progress data for pie chart
  const progressData = [
    { name: 'Productive Time', value: Math.min(completedMinutes, adjustedTarget), color: '#10b981' },
    { name: 'Remaining', value: Math.max(remainingMinutes, 0), color: '#e5e7eb' }
  ];

  const filteredProgressData = progressData.filter(item => item.value > 0);
  const isTargetReached = completedMinutes >= adjustedTarget;

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
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Your Name</label>
              <input
                type="text"
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="Enter your email address"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <button
              onClick={handleLogin}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Start Tracking
            </button>
          </div>
          
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">🔒 Your data is stored locally during this session only</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <div>
              <img 
                src="/bike.png" 
                alt="Folding Bike Logo" 
                className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
              />
            </div>
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-gray-800">Production Tracker</h1>
              <p className="text-sm sm:text-base text-gray-600">Welcome back, {userName}! 👋</p>
            </div>
          </div>
          <div className="text-right flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm text-gray-500">{userEmail}</p>
              <button onClick={handleLogout} className="text-sm text-red-600 hover:text-red-800 underline">
                Logout
              </button>
            </div>
            {/* Calendar Icon for Historical Data */}
            <button
              onClick={() => setShowCalendarModal(true)}
              className="p-1.5 sm:p-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-600 transition-colors"
              title="View Historical Data"
            >
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            
            {selectedDate && (
              <button
                onClick={finishWorkDay}
                disabled={allDailyData[selectedDate]?.isFinished}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg font-medium transition-colors ${
                  allDailyData[selectedDate]?.isFinished
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {allDailyData[selectedDate]?.isFinished ? 'Day Finished' : 'Finish Work Day'}
              </button>
            )}
            
            {/* Week Reset Button - appears when all working days are finished */}
            {isWeekComplete() && (
              <button
                onClick={resetWeek}
                className="px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors ml-2"
              >
                🎉 Start New Week
              </button>
            )}
          </div>
        </div>

        {/* Date Selection */}
        <div className="mb-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-3">Select Working Day</h3>
          <div className="flex flex-wrap gap-1 sm:gap-2">
            {getWorkingDays().map((date) => {
              const isSelected = selectedDate === date;
              const hasData = allDailyData[date];
              const isToday = date === getCurrentDateKey();
              
              return (
                <button
                  key={date}
                  onClick={() => {
                    if (date !== selectedDate) {
                      setIsSwitchingDate(true);
                      setSelectedDate(date);
                      setTimeout(() => setIsSwitchingDate(false), 100);
                    }
                  }}
                  className={`px-2 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : hasData || isToday
                      ? 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                      : 'bg-white text-gray-500 border-gray-200'
                  } ${isToday ? 'ring-2 ring-yellow-400' : ''} ${
                    hasData ? 'font-semibold' : ''
                  } ${allDailyData[date]?.isFinished ? 'border-green-500 bg-green-50' : ''}`}
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
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Weekly Summary - shows when week is complete */}
        {isWeekComplete() && (
          <div className="mb-6 bg-gradient-to-r from-purple-50 to-indigo-50 p-6 rounded-lg border border-purple-200">
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-6">
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
          <div className="bg-red-50 p-3 sm:p-4 rounded-lg mb-4 border border-red-200">
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
        <div className="mb-6">
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
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
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
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Type item code (e.g., B102823)"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
                />
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
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
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
        <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              Daily Summary - {userName} ({formatDateForDisplay(selectedDate)})
            </h2>
            <button
              onClick={downloadPDF}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Download PDF</span>
            </button>
          </div>
          
          {completedJobs.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-3">✅ Completed Jobs</h3>
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
                    {completedJobs.map((job, index) => (
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

          {lossTimeEntries.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-3 text-red-700">⚠️ Loss Time Entries</h3>
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
                    {lossTimeEntries.map((entry, index) => (
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
    </div>
  );
};

export default ProductionTracker; 