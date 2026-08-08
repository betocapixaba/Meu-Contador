import React, { useState, useEffect } from "react";
import { 
  Users, 
  UserPlus, 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  Search, 
  DollarSign, 
  Calendar, 
  Tag, 
  FileText, 
  Phone, 
  Mail, 
  X, 
  ShieldAlert,
  Building,
  Briefcase
} from "lucide-react";
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { Transaction, Client } from "../types";
import { isDemoActive, localAddDoc, localGetDocs, localDeleteDoc, localUpdateDoc } from "../utils/demoDb";
import { Currency, formatCurrency } from "../utils/currency";

interface ClientConfigProps {
  darkMode: boolean;
  transactions: Transaction[];
  onRefresh: () => void;
  currency?: Currency;
}

export default function ClientConfig({ 
  darkMode, 
  transactions, 
  onRefresh, 
  currency 
}: ClientConfigProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // New Client Modal
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");

  // Edit Client Modal
  const [showEditClientModal, setShowEditClientModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");

  // Add Transaction Modal (Receita or Despesa for Client)
  const [showAddTxModal, setShowAddTxModal] = useState(false);
  const [txType, setTxType] = useState<"receita" | "despesa">("receita");
  const [txAmount, setTxAmount] = useState("");
  const [txCategory, setTxCategory] = useState("Serviços");
  const [txDescription, setTxDescription] = useState("");
  const [txLocation, setTxLocation] = useState("");
  const [txDate, setTxDate] = useState(new Date().toISOString().split("T")[0]);

  // Modals / Feedback
  const [txLoading, setTxLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string; isClient?: boolean } | null>(null);

  // Fetch clients from Firestore / Demo DB
  const fetchClients = async () => {
    setLoadingClients(true);
    try {
      const isDemo = isDemoActive();
      const currentUser = isDemo ? { uid: "local-demo-user" } : auth.currentUser;

      if (!currentUser) {
        setClients([]);
        setLoadingClients(false);
        return;
      }

      let fetchedClients: Client[] = [];
      if (isDemo) {
        fetchedClients = await localGetDocs<Client>("clients", currentUser.uid);
      } else {
        const q = query(collection(db, "clients"), where("userId", "==", currentUser.uid));
        const snapshot = await getDocs(q);
        fetchedClients = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        })) as Client[];
      }

      setClients(fetchedClients);
      if (fetchedClients.length > 0 && !selectedClientId) {
        setSelectedClientId(fetchedClients[0].id);
      }
    } catch (err) {
      console.warn("Erro ao buscar clientes:", err);
    } finally {
      setLoadingClients(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const selectedClient = clients.find(c => c.id === selectedClientId) || null;

  // Filter transactions for selected client
  const clientTransactions = transactions.filter(t => {
    if (!selectedClient) return false;
    return t.client && t.client.trim().toLowerCase() === selectedClient.name.trim().toLowerCase();
  });

  const totalReceitas = clientTransactions
    .filter(t => t.type === "receita")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalDespesas = clientTransactions
    .filter(t => t.type === "despesa")
    .reduce((sum, t) => sum + t.amount, 0);

  const clientBalance = totalReceitas - totalDespesas;

  // Add Client Handler
  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;

    setTxLoading(true);
    try {
      const isDemo = isDemoActive();
      const currentUser = isDemo ? { uid: "local-demo-user" } : auth.currentUser;
      if (!currentUser) return;

      const clientData = {
        userId: currentUser.uid,
        name: newClientName.trim(),
        email: newClientEmail.trim() || null,
        phone: newClientPhone.trim() || null
      };

      let newId = "";
      if (isDemo) {
        const added = await localAddDoc("clients", clientData);
        newId = added.id;
      } else {
        const ref = await addDoc(collection(db, "clients"), clientData);
        newId = ref.id;
      }

      setFeedbackMsg({ type: "success", text: `Cliente "${newClientName}" adicionado com sucesso!` });
      setNewClientName("");
      setNewClientEmail("");
      setNewClientPhone("");
      setShowAddClientModal(false);
      await fetchClients();
      setSelectedClientId(newId);
    } catch (err) {
      setFeedbackMsg({ type: "error", text: "Não foi possível cadastrar o cliente." });
    } finally {
      setTxLoading(false);
    }
  };

  // Edit Client Handler
  const openEditModal = () => {
    if (!selectedClient) return;
    setEditName(selectedClient.name);
    setEditEmail(selectedClient.email || "");
    setEditPhone(selectedClient.phone || "");
    setShowEditClientModal(true);
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !editName.trim()) return;

    setTxLoading(true);
    try {
      const isDemo = isDemoActive();
      const updateData = {
        name: editName.trim(),
        email: editEmail.trim() || null,
        phone: editPhone.trim() || null
      };

      if (isDemo) {
        await localUpdateDoc("clients", selectedClient.id, updateData);
      } else {
        await updateDoc(doc(db, "clients", selectedClient.id), updateData);
      }

      setFeedbackMsg({ type: "success", text: "Dados do cliente atualizados!" });
      setShowEditClientModal(false);
      await fetchClients();
    } catch (err) {
      setFeedbackMsg({ type: "error", text: "Erro ao atualizar cliente." });
    } finally {
      setTxLoading(false);
    }
  };

  // Add Transaction Handler for Selected Client
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !txAmount || !txDescription.trim()) return;

    const val = parseFloat(txAmount.replace(",", "."));
    if (isNaN(val) || val <= 0) return;

    setTxLoading(true);
    try {
      const isDemo = isDemoActive();
      const currentUser = isDemo ? { uid: "local-demo-user" } : auth.currentUser;
      if (!currentUser) return;

      const txData = {
        userId: currentUser.uid,
        type: txType,
        amount: val,
        category: txCategory || (txType === "receita" ? "Serviços" : "Outros"),
        location: txLocation.trim() || null,
        client: selectedClient.name,
        description: txDescription.trim(),
        date: txDate || new Date().toISOString().split("T")[0],
        isRecurrent: false,
        receiptImage: null,
        createdAt: new Date().toISOString()
      };

      if (isDemo) {
        await localAddDoc("transactions", txData);
      } else {
        await addDoc(collection(db, "transactions"), txData);
      }

      setFeedbackMsg({ 
        type: "success", 
        text: `${txType === "receita" ? "Receita" : "Despesa"} de ${formatCurrency(val, currency?.symbol || "R$")} adicionada ao cliente "${selectedClient.name}"!` 
      });

      // Reset
      setTxAmount("");
      setTxDescription("");
      setTxLocation("");
      setShowAddTxModal(false);
      onRefresh();
    } catch (err) {
      setFeedbackMsg({ type: "error", text: "Erro ao salvar lançamento." });
    } finally {
      setTxLoading(false);
    }
  };

  // Delete Action
  const handleDeleteExecute = async () => {
    if (!deleteConfirm) return;
    setTxLoading(true);

    try {
      const isDemo = isDemoActive();
      if (deleteConfirm.isClient) {
        if (isDemo) {
          await localDeleteDoc("clients", deleteConfirm.id);
        } else {
          await deleteDoc(doc(db, "clients", deleteConfirm.id));
        }
        setFeedbackMsg({ type: "success", text: "Cliente removido com sucesso." });
        setSelectedClientId(null);
        await fetchClients();
      } else {
        if (isDemo) {
          await localDeleteDoc("transactions", deleteConfirm.id);
        } else {
          await deleteDoc(doc(db, "transactions", deleteConfirm.id));
        }
        setFeedbackMsg({ type: "success", text: "Lançamento excluído com sucesso." });
        onRefresh();
      }
    } catch (err) {
      setFeedbackMsg({ type: "error", text: "Não foi possível excluir o item." });
    } finally {
      setDeleteConfirm(null);
      setTxLoading(false);
    }
  };

  const filteredClientsList = clients.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.phone && c.phone.includes(searchQuery))
  );

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Title Banner */}
      <div className={`p-5 rounded-3xl border shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
        darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100 text-slate-950"
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-tr from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-purple-500/20 shrink-0">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight">Configuração do Cliente</h1>
            <p className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
              Gerencie seus clientes, adicione receitas e controle despesas por cliente.
            </p>
          </div>
        </div>

        <button
          id="add-client-top-btn"
          onClick={() => setShowAddClientModal(true)}
          className="w-full sm:w-auto bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 active:scale-95 text-white py-2.5 px-4 text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 shadow-md shadow-purple-500/20 transition"
        >
          <UserPlus className="w-4 h-4" />
          <span>Novo Cliente</span>
        </button>
      </div>

      {/* Feedback Toast */}
      {feedbackMsg && (
        <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between animate-fadeIn ${
          feedbackMsg.type === "success" 
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" 
            : "bg-rose-500/10 border-rose-500/20 text-rose-500"
        }`}>
          <div className="flex items-center gap-2">
            {feedbackMsg.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <ShieldAlert className="w-4 h-4 shrink-0" />}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Client Selection Bar */}
      <div className={`p-4 rounded-3xl border ${
        darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100 shadow-sm"
      }`}>
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between mb-3">
          <label className={`text-xs font-bold uppercase tracking-wider ${
            darkMode ? "text-slate-400" : "text-slate-500"
          }`}>
            Selecione o Cliente ({clients.length}):
          </label>

          <div className="relative w-full sm:w-64">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${
              darkMode ? "text-slate-500" : "text-slate-400"
            }`} />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 transition ${
                darkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
              }`}
            />
          </div>
        </div>

        {clients.length === 0 ? (
          <div className={`text-center py-8 px-4 rounded-2xl border border-dashed ${
            darkMode ? "border-slate-800 bg-slate-950/40" : "border-slate-200 bg-slate-50"
          }`}>
            <Users className={`w-8 h-8 mx-auto mb-2 opacity-40 ${darkMode ? "text-slate-500" : "text-slate-400"}`} />
            <p className={`text-xs font-bold mb-1 ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
              Nenhum cliente cadastrado ainda
            </p>
            <p className={`text-[11px] mb-4 ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
              Cadastre seu primeiro cliente para gerenciar receitas e despesas vinculadas.
            </p>
            <button
              onClick={() => setShowAddClientModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 text-xs font-bold rounded-xl inline-flex items-center gap-1.5 shadow-sm"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Cadastrar Primeiro Cliente
            </button>
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {filteredClientsList.map((client) => {
              const isSelected = client.id === selectedClientId;
              return (
                <button
                  key={client.id}
                  onClick={() => setSelectedClientId(client.id)}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 shrink-0 border transition-all ${
                    isSelected 
                      ? "bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-500/20" 
                      : darkMode 
                        ? "bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:text-white" 
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <Briefcase className={`w-3.5 h-3.5 ${isSelected ? "text-white" : "text-purple-400"}`} />
                  <span>{client.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Selected Client Dashboard */}
      {selectedClient && (
        <div className="space-y-6 animate-fadeIn">
          {/* Client Details Header Card */}
          <div className={`p-5 rounded-3xl border shadow-sm ${
            darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100 text-slate-950"
          }`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 pb-4 border-b border-slate-200/10">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-purple-500/10 text-purple-500 border border-purple-500/20">
                    Cliente Ativo
                  </span>
                  <h2 className="text-xl font-extrabold tracking-tight">{selectedClient.name}</h2>
                </div>
                <div className={`flex flex-wrap gap-4 mt-2 text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                  {selectedClient.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-purple-400" />
                      {selectedClient.email}
                    </span>
                  )}
                  {selectedClient.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-purple-400" />
                      {selectedClient.phone}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={openEditModal}
                  className={`flex-1 sm:flex-initial px-3.5 py-2 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition ${
                    darkMode 
                      ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700" 
                      : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5 text-purple-500" />
                  Editar Dados
                </button>

                <button
                  onClick={() => setDeleteConfirm({ id: selectedClient.id, title: selectedClient.name, isClient: true })}
                  className="p-2 text-xs font-bold rounded-xl border bg-rose-500/10 border-rose-500/20 text-rose-500 hover:bg-rose-500/20 transition"
                  title="Excluir Cliente"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Financial Totals for this client */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className={`p-4 rounded-2xl border ${
                darkMode ? "bg-slate-950/50 border-slate-800" : "bg-emerald-50/50 border-emerald-100"
              }`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    Receitas do Cliente
                  </span>
                </div>
                <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(totalReceitas, currency?.symbol || "R$")}
                </p>
              </div>

              <div className={`p-4 rounded-2xl border ${
                darkMode ? "bg-slate-950/50 border-slate-800" : "bg-rose-50/50 border-rose-100"
              }`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    Despesas do Cliente
                  </span>
                </div>
                <p className="text-lg font-black text-rose-600 dark:text-rose-400">
                  {formatCurrency(totalDespesas, currency?.symbol || "R$")}
                </p>
              </div>

              <div className={`p-4 rounded-2xl border ${
                darkMode ? "bg-slate-950/50 border-slate-800" : "bg-purple-50/50 border-purple-100"
              }`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    Saldo Líquido
                  </span>
                </div>
                <p className={`text-lg font-black ${
                  clientBalance >= 0 ? "text-purple-600 dark:text-purple-400" : "text-rose-500"
                }`}>
                  {formatCurrency(clientBalance, currency?.symbol || "R$")}
                </p>
              </div>
            </div>

            {/* Quick Action Buttons: Add Revenue vs Add Expense for this Client */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-200/10">
              <button
                id="add-client-revenue-btn"
                onClick={() => {
                  setTxType("receita");
                  setTxCategory("Serviços");
                  setShowAddTxModal(true);
                }}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-98 text-white py-3 px-4 text-xs font-extrabold rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>+ Adicionar Receita do Cliente</span>
              </button>

              <button
                id="add-client-expense-btn"
                onClick={() => {
                  setTxType("despesa");
                  setTxCategory("Outros");
                  setShowAddTxModal(true);
                }}
                className="w-full bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 active:scale-98 text-white py-3 px-4 text-xs font-extrabold rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-rose-500/20 transition"
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>+ Adicionar Despesa do Cliente</span>
              </button>
            </div>
          </div>

          {/* Client Transactions History */}
          <div className={`p-5 rounded-3xl border shadow-sm ${
            darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100 text-slate-950"
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-500" />
                Lançamentos do Cliente ({clientTransactions.length})
              </h3>
            </div>

            {clientTransactions.length === 0 ? (
              <div className={`text-center py-8 px-4 rounded-2xl border border-dashed ${
                darkMode ? "border-slate-800 bg-slate-950/30 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"
              }`}>
                <p className="text-xs font-semibold">Nenhum lançamento registrado para {selectedClient.name}.</p>
                <p className="text-[11px] mt-1 text-slate-400">
                  Utilize os botões acima para cadastrar receitas recebidas ou despesas deste cliente.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {clientTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition ${
                      darkMode ? "bg-slate-950/40 border-slate-800/80 hover:bg-slate-950" : "bg-slate-50 border-slate-100 hover:bg-slate-100/80"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        tx.type === "receita" 
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                          : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                      }`}>
                        {tx.type === "receita" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-extrabold truncate">{tx.description}</p>
                        <div className={`flex items-center gap-2 text-[10px] mt-0.5 ${
                          darkMode ? "text-slate-400" : "text-slate-500"
                        }`}>
                          <span className="font-semibold px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-500">
                            {tx.category}
                          </span>
                          <span>•</span>
                          <span>{new Date(tx.date + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                          {tx.location && (
                            <>
                              <span>•</span>
                              <span className="truncate">{tx.location}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xs font-black ${
                        tx.type === "receita" ? "text-emerald-500" : "text-rose-500"
                      }`}>
                        {tx.type === "receita" ? "+" : "-"}{formatCurrency(tx.amount, currency?.symbol || "R$")}
                      </span>

                      <button
                        onClick={() => setDeleteConfirm({ id: tx.id, title: tx.description })}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
                        title="Excluir lançamento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: NOVO CLIENTE */}
      {showAddClientModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl animate-slideUp ${
            darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100 text-slate-900"
          }`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-extrabold text-base tracking-tight flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-purple-500" />
                Cadastrar Novo Cliente
              </h3>
              <button 
                onClick={() => setShowAddClientModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-500/10 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddClient} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">Nome do Cliente *</label>
                <input
                  type="text"
                  placeholder="Ex: Empresa ABC ou João Silva"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  required
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    darkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200"
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">E-mail (opcional)</label>
                <input
                  type="email"
                  placeholder="cliente@email.com"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    darkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200"
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Telefone / WhatsApp (opcional)</label>
                <input
                  type="text"
                  placeholder="(11) 99999-9999"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    darkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200"
                  }`}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddClientModal(false)}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl border ${
                    darkMode ? "border-slate-700 hover:bg-slate-800 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={txLoading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {txLoading ? "Salvando..." : "Salvar Cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR CLIENTE */}
      {showEditClientModal && selectedClient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl animate-slideUp ${
            darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100 text-slate-900"
          }`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-extrabold text-base tracking-tight flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-purple-500" />
                Editar Cliente: {selectedClient.name}
              </h3>
              <button 
                onClick={() => setShowEditClientModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-500/10 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateClient} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">Nome do Cliente *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    darkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200"
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">E-mail</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    darkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200"
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Telefone / WhatsApp</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    darkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200"
                  }`}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditClientModal(false)}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl border ${
                    darkMode ? "border-slate-700 hover:bg-slate-800 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={txLoading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {txLoading ? "Atualizando..." : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADICIONAR LANÇAMENTO PARA O CLIENTE (RECEITA OU DESPESA) */}
      {showAddTxModal && selectedClient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl animate-slideUp ${
            darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100 text-slate-900"
          }`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-extrabold text-base tracking-tight flex items-center gap-2">
                {txType === "receita" ? (
                  <ArrowUpRight className="w-5 h-5 text-emerald-500" />
                ) : (
                  <ArrowDownLeft className="w-5 h-5 text-rose-500" />
                )}
                <span>Nova {txType === "receita" ? "Receita" : "Despesa"} para {selectedClient.name}</span>
              </h3>
              <button 
                onClick={() => setShowAddTxModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-500/10 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Type selector toggle inside modal */}
            <div className={`p-1 rounded-xl flex gap-1 mb-4 border ${
              darkMode ? "bg-slate-950 border-slate-800" : "bg-slate-100 border-slate-200"
            }`}>
              <button
                type="button"
                onClick={() => {
                  setTxType("receita");
                  setTxCategory("Serviços");
                }}
                className={`flex-1 py-1.5 text-xs font-extrabold rounded-lg transition ${
                  txType === "receita" 
                    ? "bg-emerald-600 text-white shadow-xs" 
                    : darkMode ? "text-slate-400" : "text-slate-600"
                }`}
              >
                + Receita
              </button>
              <button
                type="button"
                onClick={() => {
                  setTxType("despesa");
                  setTxCategory("Outros");
                }}
                className={`flex-1 py-1.5 text-xs font-extrabold rounded-lg transition ${
                  txType === "despesa" 
                    ? "bg-rose-600 text-white shadow-xs" 
                    : darkMode ? "text-slate-400" : "text-slate-600"
                }`}
              >
                - Despesa
              </button>
            </div>

            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">Descrição / Referência *</label>
                <input
                  type="text"
                  placeholder={txType === "receita" ? "Ex: Pagamento referente ao projeto X" : "Ex: Reembolso de transporte / Material"}
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  required
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    darkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Valor (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    required
                    className={`w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                      darkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Categoria</label>
                  <select
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value)}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                      darkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    {txType === "receita" ? (
                      <>
                        <option value="Serviços">Serviços</option>
                        <option value="Honorários">Honorários</option>
                        <option value="Mensalidade">Mensalidade</option>
                        <option value="Vendas">Vendas</option>
                        <option value="Outros">Outros</option>
                      </>
                    ) : (
                      <>
                        <option value="Outros">Outros</option>
                        <option value="Alimentação">Alimentação</option>
                        <option value="Transporte">Transporte</option>
                        <option value="Material">Material</option>
                        <option value="Taxas">Taxas</option>
                        <option value="Moradia">Moradia</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Data</label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                      darkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Local / Detalhe (opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: Escritório / Online"
                    value={txLocation}
                    onChange={(e) => setTxLocation(e.target.value)}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                      darkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200"
                    }`}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddTxModal(false)}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl border ${
                    darkMode ? "border-slate-700 hover:bg-slate-800 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={txLoading}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 text-white ${
                    txType === "receita" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {txLoading ? "Salvando..." : `Adicionar ${txType === "receita" ? "Receita" : "Despesa"}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL DELETE */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-xs p-5 rounded-3xl border shadow-2xl animate-slideUp ${
            darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100 text-slate-900"
          }`}>
            <h3 className="font-extrabold text-sm mb-2 text-rose-500">
              Confirmar exclusão de {deleteConfirm.isClient ? "cliente" : "lançamento"}
            </h3>
            <p className={`text-xs mb-5 leading-relaxed ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
              Tem certeza que deseja excluir &quot;<strong className="text-white">{deleteConfirm.title}</strong>&quot;? Esta ação não poderá ser desfeita.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className={`flex-1 py-2 text-xs font-bold rounded-xl border ${
                  darkMode ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteExecute}
                disabled={txLoading}
                className="flex-1 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition disabled:opacity-50"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
