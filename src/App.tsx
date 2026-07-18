import React, { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, query, where, getDocs, orderBy, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import { 
  Home, 
  ArrowUpRight, 
  ArrowDownLeft, 
  FileText, 
  User as UserIcon, 
  Sparkles, 
  Camera, 
  RefreshCw,
  X
} from "lucide-react";
import Auth from "./components/Auth";
import Dashboard from "./components/Dashboard";
import TransactionsLists from "./components/TransactionsLists";
import Reports from "./components/Reports";
import Profile from "./components/Profile";
import VoiceAssistant from "./components/VoiceAssistant";
import ReceiptScanner from "./components/ReceiptScanner";
import { Transaction, Goal, RecurrentExpense } from "./types";
import { checkSmartAlerts } from "./notifications";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("contador_ia_dark");
    return saved ? saved === "true" : true; // Default to dark mode for fintech premium look
  });

  const [activeTab, setActiveTab] = useState<string>("Início");
  
  // App data states
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [recurrentExpenses, setRecurrentExpenses] = useState<RecurrentExpense[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Modals
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);

  // Toggle theme
  const toggleDarkMode = () => {
    const newVal = !darkMode;
    setDarkMode(newVal);
    localStorage.setItem("contador_ia_dark", String(newVal));
  };

  // State for mock device status bar clock
  const [currentTime, setCurrentTime] = useState("");
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      setCurrentTime(`${hours}:${minutes}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000 * 30);
    return () => clearInterval(interval);
  }, []);

  // Auth observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Sync / Fetch data
  const fetchData = async () => {
    if (!user) return;
    setDataLoading(true);
    try {
      // 1. Transactions realtime / initial fetch
      const tQuery = query(
        collection(db, "transactions"), 
        where("userId", "==", user.uid)
      );
      
      const tSnap = await getDocs(tQuery);
      const tList = tSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Transaction));
      
      // Sort client-side by createdAt desc (fallback to date)
      tList.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.date ? new Date(a.date).getTime() : 0);
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.date ? new Date(b.date).getTime() : 0);
        return timeB - timeA;
      });
      setTransactions(tList);

      // 2. Goals
      const gQuery = query(
        collection(db, "goals"),
        where("userId", "==", user.uid)
      );
      const gSnap = await getDocs(gQuery);
      const gList = gSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Goal));
      setGoals(gList);

      // 3. Recurrent Expenses
      const rQuery = query(
        collection(db, "recurrentExpenses"),
        where("userId", "==", user.uid)
      );
      const rSnap = await getDocs(rQuery);
      const rList = rSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as RecurrentExpense));
      setRecurrentExpenses(rList);
    } catch (err) {
      console.error("Error loading Firestore collections:", err);
    } finally {
      setDataLoading(false);
    }
  };

  // Realtime updates subscription for transactions
  useEffect(() => {
    if (!user) return;

    const tQuery = query(
      collection(db, "transactions"), 
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(tQuery, (snapshot) => {
      const tList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Transaction));
      
      // Sort client-side by createdAt desc (fallback to date)
      tList.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.date ? new Date(a.date).getTime() : 0);
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.date ? new Date(b.date).getTime() : 0);
        return timeB - timeA;
      });
      setTransactions(tList);
    }, (error) => {
      console.error("Error in transactions onSnapshot:", error);
    });

    return unsubscribe;
  }, [user]);

  // Realtime goals subscription
  useEffect(() => {
    if (!user) return;

    const gQuery = query(
      collection(db, "goals"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(gQuery, (snapshot) => {
      const gList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Goal));
      setGoals(gList);
    });

    return unsubscribe;
  }, [user]);

  // Realtime recurrentExpenses subscription
  useEffect(() => {
    if (!user) return;

    const rQuery = query(
      collection(db, "recurrentExpenses"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(rQuery, (snapshot) => {
      const rList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as RecurrentExpense));
      setRecurrentExpenses(rList);
    });

    return unsubscribe;
  }, [user]);

  // Run Smart Notifications check
  useEffect(() => {
    if (!user || dataLoading) return;
    
    // Slight delay to allow data to load and settle
    const timer = setTimeout(() => {
      checkSmartAlerts(recurrentExpenses, goals);
    }, 2500);

    return () => clearTimeout(timer);
  }, [recurrentExpenses, goals, user, dataLoading]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white">
        <div className="w-16 h-16 bg-purple-600 rounded-3xl flex items-center justify-center shadow-lg shadow-purple-600/35 animate-bounce mb-4">
          <Sparkles className="w-8 h-8 text-white animate-spin" />
        </div>
        <p className="text-sm font-semibold tracking-wide">Meu Contador IA</p>
        <p className="text-xs text-zinc-500 mt-1">Carregando carteira digital...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen w-full bg-[#0F172A] flex items-center justify-center font-sans select-none p-0 md:p-6 lg:p-8 overflow-x-hidden">
        {/* Mobile Simulator Frame */}
        <div className={`w-full h-screen md:h-[780px] md:max-w-[385px] md:rounded-[3rem] md:shadow-2xl relative flex flex-col md:border-[12px] md:border-[#1E293B] overflow-hidden transition-all duration-200 ${
          darkMode ? "bg-[#0F172A] text-slate-100" : "bg-[#F8FAFC] text-slate-900"
        }`}>
          {/* Status Bar Area */}
          <div className={`hidden md:flex h-10 justify-between items-center px-8 pt-4 shrink-0 select-none ${
            darkMode ? "text-slate-400" : "text-slate-500"
          }`}>
            <span className="text-xs font-bold font-sans">{currentTime || "9:41"}</span>
            <div className="flex gap-1.5 items-center">
              <div className="flex gap-0.5 items-end h-3">
                <div className={`w-1 h-1 rounded-sm ${darkMode ? "bg-slate-400" : "bg-slate-700"}`}></div>
                <div className={`w-1 h-1.5 rounded-sm ${darkMode ? "bg-slate-400" : "bg-slate-700"}`}></div>
                <div className={`w-1 h-2 rounded-sm ${darkMode ? "bg-slate-400" : "bg-slate-700"}`}></div>
                <div className={`w-1 h-2.5 rounded-sm ${darkMode ? "bg-slate-400" : "bg-slate-700"}`}></div>
              </div>
              <span className="text-[10px] font-bold">5G</span>
              <div className={`w-5 h-2.5 rounded-sm border ${darkMode ? "border-slate-500" : "border-slate-700"} p-0.5 flex items-center`}>
                <div className={`h-full w-4/5 rounded-2xs ${darkMode ? "bg-slate-400" : "bg-slate-800"}`}></div>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto no-scrollbar">
            <Auth darkMode={darkMode} />
          </div>
        </div>

        {/* Side Info Panel on Desktop */}
        <div className="hidden lg:flex flex-col justify-center max-w-sm ml-12 text-left shrink-0">
          <div className="inline-block self-start bg-indigo-500/10 text-indigo-400 px-4 py-1.5 rounded-full text-xs font-bold mb-4 tracking-widest uppercase">
            PWA Financeiro
          </div>
          <h1 className="text-4xl font-black text-white mb-6 leading-tight tracking-tight">
            Meu Contador IA
          </h1>
          <p className="text-slate-400 mb-8 leading-relaxed font-medium text-sm">
            Gestão financeira profissional na palma da mão. Controle despesas, receitas e investimentos apenas usando sua voz.
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-450 dark:text-indigo-400 font-extrabold text-xs shrink-0">✓</div>
              <p className="text-slate-300 text-sm font-bold">Inteligência Artificial Gemini</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-450 dark:text-indigo-400 font-extrabold text-xs shrink-0">✓</div>
              <p className="text-slate-300 text-sm font-bold">Sincronização Cloud Firestore</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-450 dark:text-indigo-400 font-extrabold text-xs shrink-0">✓</div>
              <p className="text-slate-300 text-sm font-bold">Interface Mobile First Moderna</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#0F172A] flex items-center justify-center font-sans select-none p-0 md:p-6 lg:p-8 overflow-x-hidden">
      
      {/* Mobile Simulator Frame */}
      <div className={`w-full h-screen md:h-[780px] md:max-w-[385px] md:rounded-[3rem] md:shadow-2xl relative flex flex-col md:border-[12px] md:border-[#1E293B] overflow-hidden transition-all duration-200 ${
        darkMode ? "bg-[#0F172A] text-slate-100" : "bg-[#F8FAFC] text-slate-900"
      }`}>
        
        {/* Status Bar Area (Visible on simulator/desktop screens) */}
        <div className={`hidden md:flex h-10 justify-between items-center px-8 pt-4 shrink-0 select-none ${
          darkMode ? "text-slate-400" : "text-slate-500"
        }`}>
          <span className="text-xs font-bold font-sans">{currentTime || "9:41"}</span>
          <div className="flex gap-1.5 items-center">
            <div className="flex gap-0.5 items-end h-3">
              <div className={`w-1 h-1 rounded-sm ${darkMode ? "bg-slate-400" : "bg-slate-700"}`}></div>
              <div className={`w-1 h-1.5 rounded-sm ${darkMode ? "bg-slate-400" : "bg-slate-700"}`}></div>
              <div className={`w-1 h-2 rounded-sm ${darkMode ? "bg-slate-400" : "bg-slate-700"}`}></div>
              <div className={`w-1 h-2.5 rounded-sm ${darkMode ? "bg-slate-400" : "bg-slate-700"}`}></div>
            </div>
            <span className="text-[10px] font-bold">5G</span>
            <div className={`w-5 h-2.5 rounded-sm border ${darkMode ? "border-slate-500" : "border-slate-700"} p-0.5 flex items-center`}>
              <div className={`h-full w-4/5 rounded-2xs ${darkMode ? "bg-slate-400" : "bg-slate-800"}`}></div>
            </div>
          </div>
        </div>

        {/* Upper Header / Greeting */}
        <header className={`px-6 py-4 border-b flex justify-between items-center z-10 shrink-0 ${
          darkMode ? "bg-slate-950/20 border-slate-900" : "bg-white border-slate-100 shadow-xs"
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-black shadow-md shadow-indigo-500/15 shrink-0 text-xs">
              {user?.displayName?.substring(0, 2).toUpperCase() || "ED"}
            </div>
            <div>
              <p className={`text-[9px] uppercase tracking-wider font-extrabold leading-none ${
                darkMode ? "text-slate-400" : "text-slate-500"
              }`}>Bem-vindo</p>
              <h1 className="text-sm font-bold leading-tight mt-0.5 text-slate-900 dark:text-white">
                {user?.displayName?.split(" ")[0] || "Visitante"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="header-scan-shortcut-btn"
              onClick={() => setShowScanModal(true)}
              className={`p-2 rounded-xl border transition-all duration-200 active:scale-90 ${
                darkMode 
                  ? "bg-slate-850 border-slate-800 text-slate-300 hover:text-white" 
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:text-indigo-600 shadow-xs"
              }`}
            >
              <Camera className="w-4 h-4" />
            </button>
            
            <button
              id="header-refresh-btn"
              onClick={fetchData}
              disabled={dataLoading}
              className={`p-2 rounded-xl border transition-all duration-200 active:scale-90 ${
                darkMode 
                  ? "bg-slate-850 border-slate-800 text-slate-300" 
                  : "bg-slate-50 border-slate-200 text-slate-700 shadow-xs"
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${dataLoading ? "animate-spin text-indigo-500" : ""}`} />
            </button>
          </div>
        </header>

        {/* Main content body scrollable */}
        <main className="flex-1 overflow-y-auto px-6 py-5 no-scrollbar pb-24 relative">
          {activeTab === "Início" && (
            <Dashboard 
              darkMode={darkMode} 
              transactions={transactions} 
              onOpenVoice={() => setShowVoiceModal(true)}
              onOpenScan={() => setShowScanModal(true)}
              onSelectTab={setActiveTab}
              goals={goals}
            />
          )}

          {activeTab === "Receitas" && (
            <TransactionsLists 
              darkMode={darkMode} 
              transactions={transactions} 
              initialType="receita"
              onRefresh={fetchData}
            />
          )}

          {activeTab === "Despesas" && (
            <TransactionsLists 
              darkMode={darkMode} 
              transactions={transactions} 
              initialType="despesa"
              onRefresh={fetchData}
            />
          )}

          {activeTab === "Relatórios" && (
            <Reports 
              darkMode={darkMode} 
              transactions={transactions} 
            />
          )}

          {activeTab === "Perfil" && (
            <Profile 
              darkMode={darkMode} 
              onToggleDarkMode={toggleDarkMode}
              goals={goals}
              onRefreshGoals={fetchData}
            />
          )}
        </main>

        {/* Big floating voice triggers in center of the layout / bottom center */}
        <div className="absolute bottom-[84px] left-1/2 -translate-x-1/2 z-40 print:hidden flex flex-col items-center">
          <button
            id="global-floating-mic-btn"
            onClick={() => setShowVoiceModal(true)}
            className="w-15 h-15 bg-gradient-to-b from-indigo-500 to-indigo-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-600/35 hover:scale-105 active:scale-95 transition border-4 border-white dark:border-slate-900"
          >
            <Sparkles className="w-6 h-6 animate-pulse" />
          </button>
        </div>

        {/* Fixed bottom navigation bar with icons optimized for single hand touch */}
        <nav className={`border-t py-2 safe-bottom z-30 shrink-0 print:hidden ${
          darkMode ? "bg-slate-950 border-slate-900 text-white" : "bg-white border-slate-100 shadow-xl text-slate-900"
        }`}>
          <div className="grid grid-cols-5 text-center items-center h-12">
            <button
              id="nav-inicio-btn"
              onClick={() => setActiveTab("Início")}
              className={`flex flex-col items-center gap-1 transition ${
                activeTab === "Início" ? "text-indigo-600 dark:text-indigo-400 font-bold" : darkMode ? "text-slate-500 hover:text-white" : "text-slate-400 hover:text-slate-900"
              }`}
            >
              <Home className="w-5 h-5 mt-1" />
              <span className="text-[9px] font-bold uppercase tracking-wider">Início</span>
            </button>

            <button
              id="nav-receitas-btn"
              onClick={() => setActiveTab("Receitas")}
              className={`flex flex-col items-center gap-1 transition ${
                activeTab === "Receitas" ? "text-indigo-600 dark:text-indigo-400 font-bold" : darkMode ? "text-slate-500 hover:text-white" : "text-slate-400 hover:text-slate-900"
              }`}
            >
              <ArrowUpRight className="w-5 h-5 mt-1" />
              <span className="text-[9px] font-bold uppercase tracking-wider">Receitas</span>
            </button>

            {/* Spacer for voice mic trigger */}
            <div className="w-full flex flex-col items-center justify-end pb-1 h-full">
              <span className={`text-[8px] font-black uppercase tracking-widest ${
                darkMode ? "text-indigo-400" : "text-indigo-600"
              }`}>Contador</span>
            </div>

            <button
              id="nav-despesas-btn"
              onClick={() => setActiveTab("Despesas")}
              className={`flex flex-col items-center gap-1 transition ${
                activeTab === "Despesas" ? "text-indigo-600 dark:text-indigo-400 font-bold" : darkMode ? "text-slate-500 hover:text-white" : "text-slate-400 hover:text-slate-900"
              }`}
            >
              <ArrowDownLeft className="w-5 h-5 mt-1" />
              <span className="text-[9px] font-bold uppercase tracking-wider">Despesas</span>
            </button>

            <button
              id="nav-relatorios-btn"
              onClick={() => setActiveTab("Relatórios")}
              className={`flex flex-col items-center gap-1 transition ${
                activeTab === "Relatórios" ? "text-indigo-600 dark:text-indigo-400 font-bold" : darkMode ? "text-slate-500 hover:text-white" : "text-slate-400 hover:text-slate-900"
              }`}
            >
              <FileText className="w-5 h-5 mt-1" />
              <span className="text-[9px] font-bold uppercase tracking-wider">Relatórios</span>
            </button>
          </div>
          {/* Home indicator bar mockup */}
          <div className="hidden md:block w-32 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-1.5 opacity-50"></div>
        </nav>

        {/* GLOBAL VOICE MODAL SHEET */}
        {showVoiceModal && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-end justify-center p-0">
            <div className="w-full animate-slideUp">
              <VoiceAssistant 
                darkMode={darkMode} 
                onTransactionAdded={fetchData}
                onClose={() => setShowVoiceModal(false)}
              />
            </div>
          </div>
        )}

        {/* GLOBAL SCANNER MODAL SHEET */}
        {showScanModal && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-end justify-center p-0">
            <div className="w-full animate-slideUp">
              <ReceiptScanner 
                darkMode={darkMode} 
                onTransactionAdded={fetchData}
                onClose={() => setShowScanModal(false)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Side Info (Desktop context) */}
      <div className="hidden lg:flex flex-col justify-center max-w-sm ml-12 text-left shrink-0">
        <div className="inline-block self-start bg-indigo-500/10 text-indigo-450 dark:text-indigo-400 px-4 py-1 rounded-full text-xs font-bold mb-4 tracking-widest uppercase">
          PWA Financeiro
        </div>
        <h1 className="text-4xl font-black text-white mb-6 leading-tight tracking-tight">
          Meu Contador IA
        </h1>
        <p className="text-slate-400 mb-8 leading-relaxed font-medium text-sm">
          Gestão financeira profissional na palma da mão. Controle despesas, receitas e investimentos apenas usando sua voz.
        </p>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-450 dark:text-indigo-400 font-extrabold text-xs shrink-0">✓</div>
            <p className="text-slate-300 text-sm font-bold">Inteligência Artificial Gemini</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-450 dark:text-indigo-400 font-extrabold text-xs shrink-0">✓</div>
            <p className="text-slate-300 text-sm font-bold">Sincronização Cloud Firestore</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-450 dark:text-indigo-400 font-extrabold text-xs shrink-0">✓</div>
            <p className="text-slate-300 text-sm font-bold">Interface Mobile First Moderna</p>
          </div>
        </div>
      </div>

    </div>
  );
}
