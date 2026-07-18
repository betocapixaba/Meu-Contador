import React, { useState, useEffect } from "react";
import { 
  User, 
  LogOut, 
  Sun, 
  Moon, 
  Target, 
  Briefcase, 
  Users, 
  CreditCard, 
  Plus, 
  Trash2, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  X,
  Bell
} from "lucide-react";
import { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  updateDoc, 
  query, 
  where 
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { Goal, RecurrentExpense, Service, Client } from "../types";

interface ProfileProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  goals: Goal[];
  onRefreshGoals: () => void;
}

export default function Profile({ 
  darkMode, 
  onToggleDarkMode, 
  goals, 
  onRefreshGoals 
}: ProfileProps) {
  const [activeSubSection, setActiveSubSection] = useState<"perfil" | "metas" | "recorrentes" | "servicos" | "clientes">("perfil");

  // Collections state
  const [recurrents, setRecurrents] = useState<RecurrentExpense[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalDeadline, setGoalDeadline] = useState("");

  const [showAddRecurrentModal, setShowAddRecurrentModal] = useState(false);
  const [recurrentTitle, setRecurrentTitle] = useState("");
  const [recurrentAmount, setRecurrentAmount] = useState("");
  const [recurrentCategory, setRecurrentCategory] = useState("");
  const [recurrentDueDate, setRecurrentDueDate] = useState("5");

  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [serviceTitle, setServiceTitle] = useState("");
  const [serviceAmount, setServiceAmount] = useState("");
  const [serviceClient, setServiceClient] = useState("");
  const [serviceStatus, setServiceStatus] = useState<"pendente" | "realizado" | "pago">("pendente");
  const [serviceDate, setServiceDate] = useState("");

  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");

  // Notification States
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "denied";
  });

  const handleEnableNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      alert("Seu navegador não suporta notificações de área de trabalho.");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      const { sendSmartNotification } = await import("../notifications");
      sendSmartNotification("Alertas Ativados! 🔔", {
        body: "Seu Contador IA agora enviará alertas inteligentes sobre suas contas a pagar e metas de poupança atingidas.",
        tag: "notifications-welcome"
      });
    }
  };

  const handleSendTestNotification = async () => {
    const { sendSmartNotification } = await import("../notifications");
    sendSmartNotification("Alerta de Teste Inteligente 💡", {
      body: "Este é um exemplo de notificação que o Contador IA enviará quando uma conta estiver para vencer ou meta for atingida!",
      tag: "test-alert",
      requireInteraction: true
    });
  };

  const user = auth.currentUser;

  // Load collections
  const loadSubCollections = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Load Recurrent Expenses
      const rq = query(collection(db, "recurrentExpenses"), where("userId", "==", user.uid));
      const rSnap = await getDocs(rq);
      const rList = rSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RecurrentExpense));
      setRecurrents(rList);

      // Load Services
      const sq = query(collection(db, "services"), where("userId", "==", user.uid));
      const sSnap = await getDocs(sq);
      const sList = sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
      setServices(sList);

      // Load Clients
      const cq = query(collection(db, "clients"), where("userId", "==", user.uid));
      const cSnap = await getDocs(cq);
      const cList = cSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
      setClients(cList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubCollections();
  }, [activeSubSection]);

  // Handles Logout
  const handleLogout = () => {
    auth.signOut();
  };

  // Add Goal
  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim() || !goalTarget || !user) return;

    try {
      await addDoc(collection(db, "goals"), {
        userId: user.uid,
        title: goalTitle.trim(),
        targetAmount: Number(goalTarget),
        currentAmount: 0,
        deadline: goalDeadline || new Date().toISOString().split("T")[0]
      });
      setGoalTitle("");
      setGoalTarget("");
      setGoalDeadline("");
      setShowAddGoalModal(false);
      onRefreshGoals();
    } catch (err) {
      console.error(err);
    }
  };

  // Update Goal progress
  const handleGoalProgressUpdate = async (id: string, current: number, target: number) => {
    const newVal = prompt(`Atualizar valor poupado para esta meta (Atualmente: $${current}):`);
    if (newVal === null) return;
    
    const num = Number(newVal);
    if (isNaN(num)) return;

    try {
      await updateDoc(doc(db, "goals", id), { currentAmount: num });
      onRefreshGoals();
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Goal
  const handleDeleteGoal = async (id: string) => {
    if (confirm("Deseja remover esta meta?")) {
      try {
        await deleteDoc(doc(db, "goals", id));
        onRefreshGoals();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Add Recurrent Expense
  const handleAddRecurrent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recurrentTitle.trim() || !recurrentAmount || !user) return;

    try {
      await addDoc(collection(db, "recurrentExpenses"), {
        userId: user.uid,
        title: recurrentTitle.trim(),
        amount: Number(recurrentAmount),
        category: recurrentCategory || "Outros",
        dueDate: Number(recurrentDueDate) || 5
      });
      setRecurrentTitle("");
      setRecurrentAmount("");
      setRecurrentCategory("");
      setShowAddRecurrentModal(false);
      loadSubCollections();
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Recurrent
  const handleDeleteRecurrent = async (id: string) => {
    if (confirm("Remover esta conta recorrente?")) {
      try {
        await deleteDoc(doc(db, "recurrentExpenses", id));
        loadSubCollections();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Add Service
  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceTitle.trim() || !serviceAmount || !serviceClient || !user) return;

    try {
      await addDoc(collection(db, "services"), {
        userId: user.uid,
        title: serviceTitle.trim(),
        amount: Number(serviceAmount),
        clientName: serviceClient.trim(),
        status: serviceStatus,
        date: serviceDate || new Date().toISOString().split("T")[0]
      });
      setServiceTitle("");
      setServiceAmount("");
      setServiceClient("");
      setServiceStatus("pendente");
      setShowAddServiceModal(false);
      loadSubCollections();
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle service status
  const handleToggleServiceStatus = async (id: string, current: string) => {
    const nextStatus = current === "pendente" ? "realizado" : current === "realizado" ? "pago" : "pendente";
    try {
      await updateDoc(doc(db, "services", id), { status: nextStatus });
      loadSubCollections();
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Service
  const handleDeleteService = async (id: string) => {
    if (confirm("Remover este serviço?")) {
      try {
        await deleteDoc(doc(db, "services", id));
        loadSubCollections();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Add Client
  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !user) return;

    try {
      await addDoc(collection(db, "clients"), {
        userId: user.uid,
        name: clientName.trim(),
        email: clientEmail.trim() || null,
        phone: clientPhone.trim() || null
      });
      setClientName("");
      setClientEmail("");
      setClientPhone("");
      setShowAddClientModal(false);
      loadSubCollections();
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Client
  const handleDeleteClient = async (id: string) => {
    if (confirm("Remover este cliente?")) {
      try {
        await deleteDoc(doc(db, "clients", id));
        loadSubCollections();
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Upper Title */}
      <div>
        <h2 className="text-xl font-extrabold tracking-tight">Painel de Gestão</h2>
        <p className={`text-xs ${darkMode ? "text-zinc-400" : "text-gray-500"}`}>
          Ajustes, metas, clientes e contratos
        </p>
      </div>

      {activeSubSection === "perfil" && (
        <div className="space-y-5">
          {/* User Info card */}
          <div className={`p-5 rounded-3xl border flex items-center justify-between ${
            darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-100 shadow-sm"
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-600 rounded-2xl flex items-center justify-center text-white font-extrabold text-sm shadow-md">
                {user?.displayName?.charAt(0).toUpperCase() || <User />}
              </div>
              <div>
                <p className="text-sm font-extrabold">{user?.displayName || "Usuário"}</p>
                <p className={`text-[10px] ${darkMode ? "text-zinc-500" : "text-gray-400"}`}>{user?.email || "Convidado Demo"}</p>
              </div>
            </div>

            <button
              id="logout-action-btn"
              onClick={handleLogout}
              className={`p-2 rounded-xl transition ${
                darkMode ? "hover:bg-zinc-800 text-red-400" : "hover:bg-gray-100 text-red-500"
              }`}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Settings */}
          <div className={`p-4 rounded-3xl border space-y-4 ${
            darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-100 shadow-sm"
          }`}>
            <h4 className="font-extrabold text-xs uppercase tracking-wider opacity-60 px-1">Configurações Gerais</h4>
            
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                {darkMode ? <Moon className="w-4 h-4 text-purple-500" /> : <Sun className="w-4 h-4 text-amber-500" />}
                <span className="text-xs font-semibold">Modo Escuro</span>
              </div>
              <button
                id="toggle-darkmode-btn"
                onClick={onToggleDarkMode}
                className={`w-11 h-6 rounded-full p-1 transition-colors ${
                  darkMode ? "bg-purple-600" : "bg-gray-200"
                }`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transition-transform ${
                  darkMode ? "translate-x-5" : "translate-x-0"
                }`}></div>
              </button>
            </div>

            <hr className={darkMode ? "border-zinc-800" : "border-gray-100"} />

            <div className="flex flex-col gap-2.5 px-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-purple-500" />
                  <span className="text-xs font-semibold">Alertas Inteligentes</span>
                </div>
                {notificationPermission === "granted" ? (
                  <span className="text-[9px] font-extrabold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Ativado
                  </span>
                ) : (
                  <button
                    id="enable-notifications-btn"
                    onClick={handleEnableNotifications}
                    className="bg-purple-600 hover:bg-purple-700 active:scale-95 transition text-white text-[10px] font-extrabold py-1 px-2.5 rounded-lg"
                  >
                    Ativar
                  </button>
                )}
              </div>
              
              <p className={`text-[10px] leading-relaxed font-medium ${darkMode ? "text-zinc-500" : "text-gray-400"}`}>
                Notificações em tempo real sobre contas a pagar próximas do vencimento e metas de poupança atingidas.
              </p>

              {notificationPermission === "granted" && (
                <button
                  id="test-notifications-btn"
                  onClick={handleSendTestNotification}
                  className={`py-1.5 px-3 text-[9px] font-extrabold rounded-lg border transition duration-150 active:scale-95 text-center ${
                    darkMode 
                      ? "bg-zinc-800 border-zinc-700 hover:bg-zinc-750 text-slate-200" 
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  Testar Alerta de Notificação
                </button>
              )}
            </div>
          </div>

          {/* Management subcategories bento grid */}
          <div className="grid grid-cols-2 gap-3">
            <button
              id="sub-metas-btn"
              onClick={() => setActiveSubSection("metas")}
              className={`p-4 rounded-2xl border text-left transition active:scale-95 ${
                darkMode ? "bg-zinc-900 border-zinc-800 hover:bg-zinc-850" : "bg-white border-gray-100 hover:bg-gray-50 shadow-sm"
              }`}
            >
              <div className="w-9 h-9 bg-purple-600/10 text-purple-600 rounded-xl flex items-center justify-center mb-3">
                <Target className="w-4.5 h-4.5" />
              </div>
              <span className="text-xs font-extrabold block">Metas Financeiras</span>
              <span className={`text-[10px] mt-0.5 block ${darkMode ? "text-zinc-500" : "text-gray-400"}`}>
                {goals.length} metas ativas
              </span>
            </button>

            <button
              id="sub-recorrentes-btn"
              onClick={() => setActiveSubSection("recorrentes")}
              className={`p-4 rounded-2xl border text-left transition active:scale-95 ${
                darkMode ? "bg-zinc-900 border-zinc-800 hover:bg-zinc-850" : "bg-white border-gray-100 hover:bg-gray-50 shadow-sm"
              }`}
            >
              <div className="w-9 h-9 bg-purple-600/10 text-purple-600 rounded-xl flex items-center justify-center mb-3">
                <CreditCard className="w-4.5 h-4.5" />
              </div>
              <span className="text-xs font-extrabold block">Contas Recorrentes</span>
              <span className={`text-[10px] mt-0.5 block ${darkMode ? "text-zinc-500" : "text-gray-400"}`}>
                Controle de assinaturas
              </span>
            </button>

            <button
              id="sub-servicos-btn"
              onClick={() => setActiveSubSection("servicos")}
              className={`p-4 rounded-2xl border text-left transition active:scale-95 ${
                darkMode ? "bg-zinc-900 border-zinc-800 hover:bg-zinc-850" : "bg-white border-gray-100 hover:bg-gray-50 shadow-sm"
              }`}
            >
              <div className="w-9 h-9 bg-purple-600/10 text-purple-600 rounded-xl flex items-center justify-center mb-3">
                <Briefcase className="w-4.5 h-4.5" />
              </div>
              <span className="text-xs font-extrabold block">Serviços Renderizados</span>
              <span className={`text-[10px] mt-0.5 block ${darkMode ? "text-zinc-500" : "text-gray-400"}`}>
                Contratos e status
              </span>
            </button>

            <button
              id="sub-clientes-btn"
              onClick={() => setActiveSubSection("clientes")}
              className={`p-4 rounded-2xl border text-left transition active:scale-95 ${
                darkMode ? "bg-zinc-900 border-zinc-800 hover:bg-zinc-850" : "bg-white border-gray-100 hover:bg-gray-50 shadow-sm"
              }`}
            >
              <div className="w-9 h-9 bg-purple-600/10 text-purple-600 rounded-xl flex items-center justify-center mb-3">
                <Users className="w-4.5 h-4.5" />
              </div>
              <span className="text-xs font-extrabold block">Meus Clientes</span>
              <span className={`text-[10px] mt-0.5 block ${darkMode ? "text-zinc-500" : "text-gray-400"}`}>
                Cadastro de contatos
              </span>
            </button>
          </div>
        </div>
      )}

      {/* METAS FINANCEIRAS SUBSECTION */}
      {activeSubSection === "metas" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-800/10">
            <button id="back-to-profile-goals" onClick={() => setActiveSubSection("perfil")} className="text-xs text-purple-600 font-bold">← Voltar</button>
            <button id="add-goal-btn" onClick={() => setShowAddGoalModal(true)} className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Adicionar Meta
            </button>
          </div>

          <h3 className="text-sm font-extrabold flex items-center gap-2"><Target className="w-4 h-4 text-purple-500" /> Metas de Poupança</h3>

          {goals.length === 0 ? (
            <p className={`text-center py-6 text-xs ${darkMode ? "text-zinc-500" : "text-gray-400"}`}>Nenhuma meta criada ainda.</p>
          ) : (
            <div className="space-y-3">
              {goals.map(g => {
                const percent = Math.min(g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0, 100);
                return (
                  <div key={g.id} className={`p-4 rounded-2xl border ${
                    darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-100 shadow-sm"
                  }`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="text-xs font-extrabold">{g.title}</h4>
                        <p className={`text-[9px] ${darkMode ? "text-zinc-500" : "text-gray-400"}`}>Até: {g.deadline}</p>
                      </div>

                      <div className="flex gap-2">
                        <button id={`update-goal-btn-${g.id}`} onClick={() => handleGoalProgressUpdate(g.id, g.currentAmount, g.targetAmount)} className="text-[10px] text-purple-600 hover:underline">Poupar</button>
                        <button id={`delete-goal-btn-${g.id}`} onClick={() => handleDeleteGoal(g.id)} className="text-zinc-500 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>

                    <div className="flex justify-between text-[10px] font-mono mt-2 mb-1">
                      <span>${g.currentAmount.toLocaleString()} / ${g.targetAmount.toLocaleString()}</span>
                      <span>{percent.toFixed(0)}%</span>
                    </div>

                    <div className={`w-full h-2 rounded-full overflow-hidden ${darkMode ? "bg-zinc-800" : "bg-gray-100"}`}>
                      <div className="h-full bg-purple-600 rounded-full" style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DESPESAS RECORRENTES SUBSECTION */}
      {activeSubSection === "recorrentes" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-800/10">
            <button id="back-to-profile-recorrentes" onClick={() => setActiveSubSection("perfil")} className="text-xs text-purple-600 font-bold">← Voltar</button>
            <button id="add-recurrent-btn" onClick={() => setShowAddRecurrentModal(true)} className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Adicionar Conta
            </button>
          </div>

          <h3 className="text-sm font-extrabold flex items-center gap-2"><CreditCard className="w-4 h-4 text-purple-500" /> Despesas Recorrentes</h3>

          {recurrents.length === 0 ? (
            <p className={`text-center py-6 text-xs ${darkMode ? "text-zinc-500" : "text-gray-400"}`}>Nenhuma conta recorrente cadastrada.</p>
          ) : (
            <div className="space-y-3.5">
              {recurrents.map(r => (
                <div key={r.id} className={`p-4 rounded-2xl border flex items-center justify-between ${
                  darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-100 shadow-sm"
                }`}>
                  <div>
                    <h4 className="text-xs font-extrabold">{r.title}</h4>
                    <p className={`text-[9px] ${darkMode ? "text-zinc-500" : "text-gray-400"}`}>
                      Vence dia {r.dueDate} do mês • {r.category}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-extrabold font-mono text-red-500">-${r.amount}</span>
                    <button id={`delete-recurrent-btn-${r.id}`} onClick={() => handleDeleteRecurrent(r.id)} className="text-zinc-500 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SERVIÇOS RENDIDOS SUBSECTION */}
      {activeSubSection === "servicos" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-800/10">
            <button id="back-to-profile-services" onClick={() => setActiveSubSection("perfil")} className="text-xs text-purple-600 font-bold">← Voltar</button>
            <button id="add-service-btn" onClick={() => setShowAddServiceModal(true)} className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Adicionar Contrato
            </button>
          </div>

          <h3 className="text-sm font-extrabold flex items-center gap-2"><Briefcase className="w-4 h-4 text-purple-500" /> Serviços Realizados</h3>

          {services.length === 0 ? (
            <p className={`text-center py-6 text-xs ${darkMode ? "text-zinc-500" : "text-gray-400"}`}>Nenhum contrato lançado.</p>
          ) : (
            <div className="space-y-3">
              {services.map(s => (
                <div key={s.id} className={`p-4 rounded-2xl border flex items-center justify-between ${
                  darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-100 shadow-sm"
                }`}>
                  <div>
                    <h4 className="text-xs font-extrabold">{s.title}</h4>
                    <p className={`text-[9px] ${darkMode ? "text-zinc-500" : "text-gray-400"}`}>
                      Cliente: {s.clientName} • {s.date}
                    </p>
                    <button 
                      id={`toggle-service-btn-${s.id}`}
                      onClick={() => handleToggleServiceStatus(s.id, s.status)}
                      className={`text-[9px] font-bold mt-1.5 px-2 py-0.5 rounded uppercase ${
                        s.status === "pago" ? "bg-emerald-500/10 text-emerald-500" : 
                        s.status === "realizado" ? "bg-purple-500/10 text-purple-500" : "bg-amber-500/10 text-amber-500"
                      }`}
                    >
                      Status: {s.status}
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-extrabold font-mono text-emerald-500">+${s.amount}</span>
                    <button id={`delete-service-btn-${s.id}`} onClick={() => handleDeleteService(s.id)} className="text-zinc-500 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CLIENTES CONTATOS SUBSECTION */}
      {activeSubSection === "clientes" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-800/10">
            <button id="back-to-profile-clients" onClick={() => setActiveSubSection("perfil")} className="text-xs text-purple-600 font-bold">← Voltar</button>
            <button id="add-client-btn" onClick={() => setShowAddClientModal(true)} className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Cadastrar Cliente
            </button>
          </div>

          <h3 className="text-sm font-extrabold flex items-center gap-2"><Users className="w-4 h-4 text-purple-500" /> Cadastro de Clientes</h3>

          {clients.length === 0 ? (
            <p className={`text-center py-6 text-xs ${darkMode ? "text-zinc-500" : "text-gray-400"}`}>Nenhum cliente cadastrado.</p>
          ) : (
            <div className="space-y-2.5">
              {clients.map(c => (
                <div key={c.id} className={`p-4 rounded-2xl border flex items-center justify-between ${
                  darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-100 shadow-sm"
                }`}>
                  <div>
                    <h4 className="text-xs font-extrabold">{c.name}</h4>
                    {c.email && <p className={`text-[9px] ${darkMode ? "text-zinc-500" : "text-gray-400"}`}>E-mail: {c.email}</p>}
                    {c.phone && <p className={`text-[9px] ${darkMode ? "text-zinc-500" : "text-gray-400"}`}>Fone: {c.phone}</p>}
                  </div>

                  <button id={`delete-client-btn-${c.id}`} onClick={() => handleDeleteClient(c.id)} className="text-zinc-500 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ADD GOAL MODAL */}
      {showAddGoalModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className={`w-full max-w-md p-6 rounded-t-3xl border-t max-h-[90vh] overflow-y-auto ${
            darkMode ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-gray-200 text-gray-900"
          }`}>
            <div className="flex justify-between items-center mb-5 pb-3 border-b">
              <h3 className="font-bold text-base">Criar Nova Meta</h3>
              <button id="close-goal-modal" onClick={() => setShowAddGoalModal(false)}><X /></button>
            </div>
            <form onSubmit={handleAddGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Título da Meta</label>
                <input id="goal-title-input" type="text" required placeholder="Ex: Viagem de Férias" value={goalTitle} onChange={e => setGoalTitle(e.target.value)} className="w-full px-4 py-3 text-xs rounded-xl border" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Valor Alvo ($)</label>
                <input id="goal-target-input" type="number" required placeholder="Ex: 5000" value={goalTarget} onChange={e => setGoalTarget(e.target.value)} className="w-full px-4 py-3 text-xs rounded-xl border" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Prazo Alvo</label>
                <input id="goal-date-input" type="date" value={goalDeadline} onChange={e => setGoalDeadline(e.target.value)} className="w-full px-4 py-3 text-xs rounded-xl border" />
              </div>
              <button id="submit-goal-form-btn" type="submit" className="w-full bg-purple-600 text-white py-3.5 text-xs font-bold rounded-xl">Criar Meta</button>
            </form>
          </div>
        </div>
      )}

      {/* ADD RECURRENT EXPENSE MODAL */}
      {showAddRecurrentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className={`w-full max-w-md p-6 rounded-t-3xl border-t max-h-[90vh] overflow-y-auto ${
            darkMode ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-gray-200 text-gray-900"
          }`}>
            <div className="flex justify-between items-center mb-5 pb-3 border-b">
              <h3 className="font-bold text-base">Nova Conta Recorrente</h3>
              <button id="close-recurrent-modal" onClick={() => setShowAddRecurrentModal(false)}><X /></button>
            </div>
            <form onSubmit={handleAddRecurrent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Nome da Assinatura / Conta</label>
                <input id="recurrent-title-input" type="text" required placeholder="Ex: Netflix, Internet" value={recurrentTitle} onChange={e => setRecurrentTitle(e.target.value)} className="w-full px-4 py-3 text-xs rounded-xl border" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Valor Mensal ($)</label>
                  <input id="recurrent-amount-input" type="number" required placeholder="0.00" value={recurrentAmount} onChange={e => setRecurrentAmount(e.target.value)} className="w-full px-4 py-3 text-xs rounded-xl border" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Vencimento (Dia do mês)</label>
                  <input id="recurrent-due-input" type="number" min="1" max="31" required placeholder="5" value={recurrentDueDate} onChange={e => setRecurrentDueDate(e.target.value)} className="w-full px-4 py-3 text-xs rounded-xl border" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Categoria</label>
                <input id="recurrent-cat-input" type="text" placeholder="Ex: Moradia, Assinatura" value={recurrentCategory} onChange={e => setRecurrentCategory(e.target.value)} className="w-full px-4 py-3 text-xs rounded-xl border" />
              </div>
              <button id="submit-recurrent-form-btn" type="submit" className="w-full bg-purple-600 text-white py-3.5 text-xs font-bold rounded-xl">Adicionar Conta</button>
            </form>
          </div>
        </div>
      )}

      {/* ADD SERVICE MODAL */}
      {showAddServiceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className={`w-full max-w-md p-6 rounded-t-3xl border-t max-h-[90vh] overflow-y-auto ${
            darkMode ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-gray-200 text-gray-900"
          }`}>
            <div className="flex justify-between items-center mb-5 pb-3 border-b">
              <h3 className="font-bold text-base">Novo Contrato de Serviço</h3>
              <button id="close-service-modal" onClick={() => setShowAddServiceModal(false)}><X /></button>
            </div>
            <form onSubmit={handleAddService} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Título do Serviço</label>
                <input id="service-title-input" type="text" required placeholder="Ex: Instalação de Câmeras" value={serviceTitle} onChange={e => setServiceTitle(e.target.value)} className="w-full px-4 py-3 text-xs rounded-xl border" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Valor do Serviço ($)</label>
                  <input id="service-amount-input" type="number" required placeholder="350.00" value={serviceAmount} onChange={e => setServiceAmount(e.target.value)} className="w-full px-4 py-3 text-xs rounded-xl border" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Data</label>
                  <input id="service-date-input" type="date" value={serviceDate} onChange={e => setServiceDate(e.target.value)} className="w-full px-4 py-3 text-xs rounded-xl border" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Cliente</label>
                  <input id="service-client-input" type="text" required placeholder="Nome do Cliente" value={serviceClient} onChange={e => setServiceClient(e.target.value)} className="w-full px-4 py-3 text-xs rounded-xl border" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Status Inicial</label>
                  <select id="service-status-select" value={serviceStatus} onChange={e => setServiceStatus(e.target.value as any)} className="w-full px-4 py-3 text-xs rounded-xl border">
                    <option value="pendente">Pendente</option>
                    <option value="realizado">Realizado</option>
                    <option value="pago">Pago</option>
                  </select>
                </div>
              </div>
              <button id="submit-service-form-btn" type="submit" className="w-full bg-purple-600 text-white py-3.5 text-xs font-bold rounded-xl">Cadastrar Contrato</button>
            </form>
          </div>
        </div>
      )}

      {/* ADD CLIENT MODAL */}
      {showAddClientModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className={`w-full max-w-md p-6 rounded-t-3xl border-t max-h-[90vh] overflow-y-auto ${
            darkMode ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-gray-200 text-gray-900"
          }`}>
            <div className="flex justify-between items-center mb-5 pb-3 border-b">
              <h3 className="font-bold text-base">Cadastrar Novo Cliente</h3>
              <button id="close-client-modal" onClick={() => setShowAddClientModal(false)}><X /></button>
            </div>
            <form onSubmit={handleAddClient} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Nome Completo *</label>
                <input id="client-name-input" type="text" required placeholder="Ex: João Silva" value={clientName} onChange={e => setClientName(e.target.value)} className="w-full px-4 py-3 text-xs rounded-xl border" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">E-mail (Opcional)</label>
                <input id="client-email-input" type="email" placeholder="joao@empresa.com" value={clientEmail} onChange={e => setClientEmail(e.target.value)} className="w-full px-4 py-3 text-xs rounded-xl border" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Telefone (Opcional)</label>
                <input id="client-phone-input" type="tel" placeholder="(11) 99999-9999" value={clientPhone} onChange={e => setClientPhone(e.target.value)} className="w-full px-4 py-3 text-xs rounded-xl border" />
              </div>
              <button id="submit-client-form-btn" type="submit" className="w-full bg-purple-600 text-white py-3.5 text-xs font-bold rounded-xl">Cadastrar Cliente</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
