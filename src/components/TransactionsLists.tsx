import React, { useState } from "react";
import { 
  Plus, 
  Trash2, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  X, 
  Calendar, 
  FileText, 
  Filter, 
  Clock, 
  ExternalLink 
} from "lucide-react";
import { collection, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { Transaction } from "../types";
import { isDemoActive, localAddDoc, localDeleteDoc } from "../utils/demoDb";

interface TransactionsListsProps {
  darkMode: boolean;
  transactions: Transaction[];
  initialType: "receita" | "despesa";
  onRefresh: () => void;
}

export default function TransactionsLists({ 
  darkMode, 
  transactions, 
  initialType, 
  onRefresh 
}: TransactionsListsProps) {
  const [currentTab, setCurrentTab] = useState<"receita" | "despesa">(initialType);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [receiptModalUrl, setReceiptModalUrl] = useState<string | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  // Form states
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [client, setClient] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [isRecurrent, setIsRecurrent] = useState(false);
  const [loading, setLoading] = useState(false);

  const categories = currentTab === "receita" 
    ? ["Salário", "Serviços", "Vendas", "Investimentos", "Outros"]
    : ["Alimentação", "Transporte", "Moradia", "Lazer", "Saúde", "Compras", "Outros"];

  // Handles adding transaction manually
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount || !category) return;

    setLoading(true);
    try {
      const isDemo = isDemoActive();
      const currentUser = isDemo ? { uid: "local-demo-user" } : auth.currentUser;
      
      if (currentUser) {
        const transactionData = {
          userId: currentUser.uid,
          type: currentTab,
          amount: Number(amount),
          category,
          location: location.trim() || null,
          client: client.trim() || null,
          description: description.trim(),
          date,
          isRecurrent,
          receiptImage: null,
          createdAt: new Date().toISOString()
        };

        if (isDemo) {
          await localAddDoc("transactions", transactionData);
        } else {
          await addDoc(collection(db, "transactions"), transactionData);
        }

        // Reset
        setDescription("");
        setAmount("");
        setCategory("");
        setLocation("");
        setClient("");
        setDate(new Date().toISOString().split("T")[0]);
        setIsRecurrent(false);
        setShowAddModal(false);
        onRefresh();
      }
    } catch (err) {
      console.error("Failed to add transaction:", err);
    } finally {
      setLoading(false);
    }
  };



  // Filter list
  const filtered = transactions
    .filter(t => t.type === currentTab)
    .filter(t => t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                 (t.location && t.location.toLowerCase().includes(searchTerm.toLowerCase())) ||
                 (t.client && t.client.toLowerCase().includes(searchTerm.toLowerCase())))
    .filter(t => selectedCategory === "all" || t.category === selectedCategory);

  const totalSum = filtered.reduce((sum, t) => sum + t.amount, 0);

  const getCategoryColor = (cat: string) => {
    if (currentTab === "receita") return "bg-emerald-500/10 text-emerald-500";
    
    switch (cat?.toLowerCase()) {
      case "alimentação": return "bg-amber-500/10 text-amber-500";
      case "transporte": return "bg-blue-500/10 text-blue-500";
      case "moradia": return "bg-indigo-500/10 text-indigo-500";
      case "lazer": return "bg-pink-500/10 text-pink-500";
      case "saúde": return "bg-red-500/10 text-red-500";
      case "compras": return "bg-purple-500/10 text-purple-500";
      default: return "bg-gray-500/10 text-gray-500";
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Tab Switcher */}
      <div className="flex justify-between items-center">
        <div className={`p-1 rounded-2xl flex gap-1 border ${
          darkMode ? "bg-zinc-900 border-zinc-800" : "bg-gray-100 border-gray-200"
        }`}>
          <button
            id="tab-receita-btn"
            onClick={() => { setCurrentTab("receita"); setSelectedCategory("all"); }}
            className={`px-4 py-2 text-xs font-extrabold rounded-xl flex items-center gap-1.5 transition ${
              currentTab === "receita"
                ? "bg-purple-600 text-white shadow-sm"
                : darkMode ? "text-zinc-400 hover:text-white" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            Receitas
          </button>
          <button
            id="tab-despesa-btn"
            onClick={() => { setCurrentTab("despesa"); setSelectedCategory("all"); }}
            className={`px-4 py-2 text-xs font-extrabold rounded-xl flex items-center gap-1.5 transition ${
              currentTab === "despesa"
                ? "bg-purple-600 text-white shadow-sm"
                : darkMode ? "text-zinc-400 hover:text-white" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            Despesas
          </button>
        </div>

        <button
          id="add-transaction-manual-btn"
          onClick={() => setShowAddModal(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white p-2.5 rounded-full transition active:scale-95 shadow-lg shadow-purple-600/10"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Summary Total of Filtered View */}
      <div className={`p-4 rounded-2xl border flex justify-between items-center ${
        darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-100 shadow-sm"
      }`}>
        <div>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${
            darkMode ? "text-zinc-500" : "text-gray-400"
          }`}>Total Filtrado</span>
          <p className={`text-xl font-extrabold font-mono mt-0.5 ${
            currentTab === "receita" ? "text-emerald-500" : darkMode ? "text-white" : "text-gray-900"
          }`}>
            ${totalSum.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase ${
          currentTab === "receita" 
            ? "bg-emerald-500/10 text-emerald-500" 
            : "bg-purple-500/10 text-purple-500"
        }`}>
          {filtered.length} {filtered.length === 1 ? "item" : "itens"}
        </span>
      </div>

      {/* Filters (Search & Category Selector) */}
      <div className="flex gap-2">
        <div className={`flex-1 relative border rounded-xl flex items-center px-3 ${
          darkMode ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-gray-100 text-gray-900 shadow-sm"
        }`}>
          <Search className={`w-3.5 h-3.5 mr-2 ${darkMode ? "text-zinc-500" : "text-gray-400"}`} />
          <input
            id="transaction-search-input"
            type="text"
            placeholder="Buscar lançamentos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full py-2.5 text-xs focus:outline-none bg-transparent"
          />
        </div>

        <div className={`border rounded-xl px-2 flex items-center ${
          darkMode ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-gray-100 text-gray-900 shadow-sm"
        }`}>
          <Filter className={`w-3.5 h-3.5 mr-1.5 ${darkMode ? "text-zinc-500" : "text-gray-400"}`} />
          <select
            id="category-filter-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs bg-transparent focus:outline-none cursor-pointer py-2.5"
          >
            <option value="all">Categorias</option>
            {categories.map(c => (
              <option key={c} value={c} className={darkMode ? "bg-zinc-950 text-white" : "bg-white text-gray-900"}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Transaction List Cards */}
      {filtered.length === 0 ? (
        <div className={`p-10 text-center rounded-2xl border border-dashed ${
          darkMode ? "border-zinc-800 bg-zinc-950/20" : "border-gray-200 bg-gray-50/20"
        }`}>
          <Clock className={`w-8 h-8 mx-auto mb-2 opacity-50 ${darkMode ? "text-zinc-600" : "text-gray-400"}`} />
          <p className={`text-xs ${darkMode ? "text-zinc-500" : "text-gray-400"}`}>
            Nenhum lançamento encontrado para os filtros ativos.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((t) => (
            <div
              key={t.id}
              className={`p-4 rounded-2xl border flex items-center justify-between transition ${
                darkMode ? "bg-zinc-900 border-zinc-800/80 hover:border-zinc-700" : "bg-white border-gray-100 shadow-sm hover:border-gray-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
                  getCategoryColor(t.category)
                }`}>
                  {t.type === "receita" ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-extrabold line-clamp-1">{t.description}</p>
                    {t.receiptImage && (
                      <button
                        id={`view-receipt-btn-${t.id}`}
                        onClick={() => setReceiptModalUrl(t.receiptImage)}
                        className="text-purple-600 hover:text-purple-700 transition"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className={`text-[9px] mt-0.5 flex items-center gap-1.5 ${
                    darkMode ? "text-zinc-500" : "text-gray-400"
                  }`}>
                    <span>{t.category}</span>
                    {t.location && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-zinc-400"></span>
                        <span className="line-clamp-1">{t.location}</span>
                      </>
                    )}
                    {t.client && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-zinc-400"></span>
                        <span className="line-clamp-1">Cli: {t.client}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="text-right">
                  <p className={`text-xs font-extrabold font-mono ${
                    t.type === "receita" ? "text-emerald-500" : darkMode ? "text-zinc-300" : "text-gray-900"
                  }`}>
                    {t.type === "receita" ? "+" : "-"}${t.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                  <p className={`text-[8px] font-mono mt-0.5 ${darkMode ? "text-zinc-600" : "text-gray-400"}`}>
                    {t.date}
                  </p>
                </div>

                <button
                  id={`delete-btn-${t.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setTransactionToDelete(t.id);
                  }}
                  className={`p-1.5 rounded-xl transition-all duration-150 text-rose-500 hover:text-rose-600 active:scale-90 ${
                    darkMode ? "bg-rose-500/5 hover:bg-rose-500/15" : "bg-rose-50 hover:bg-rose-100"
                  }`}
                  title="Remover lançamento"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manual Addition Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className={`w-full max-w-md p-6 rounded-t-3xl border-t animate-slideUp max-h-[90vh] overflow-y-auto ${
            darkMode ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-gray-200 text-gray-900"
          }`}>
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-zinc-800/10">
              <h3 className="font-bold text-base">Novo Lançamento ({currentTab === "receita" ? "Receita" : "Despesa"})</h3>
              <button
                id="close-add-modal-btn"
                onClick={() => setShowAddModal(false)}
                className={`p-1.5 rounded-full transition ${
                  darkMode ? "hover:bg-zinc-800 text-zinc-400" : "hover:bg-gray-100 text-gray-500"
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${darkMode ? "text-zinc-400" : "text-gray-500"}`}>Descrição / Item *</label>
                <input
                  id="form-desc"
                  type="text"
                  placeholder="Ex: Almoço no Restaurante"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className={`w-full px-4 py-3 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-600 transition ${
                    darkMode 
                      ? "bg-zinc-800 border-zinc-700 text-white focus:border-purple-500" 
                      : "bg-gray-50 border-gray-200 text-gray-900 focus:border-purple-600"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${darkMode ? "text-zinc-400" : "text-gray-500"}`}>Valor ($) *</label>
                  <input
                    id="form-amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className={`w-full px-4 py-3 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-600 transition ${
                      darkMode 
                        ? "bg-zinc-800 border-zinc-700 text-white focus:border-purple-500" 
                        : "bg-gray-50 border-gray-200 text-gray-900 focus:border-purple-600"
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1 ${darkMode ? "text-zinc-400" : "text-gray-500"}`}>Categoria *</label>
                  <select
                    id="form-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                    className={`w-full px-4 py-3 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-600 transition ${
                      darkMode 
                        ? "bg-zinc-800 border-zinc-700 text-white focus:border-purple-500" 
                        : "bg-gray-50 border-gray-200 text-gray-900 focus:border-purple-600"
                    }`}
                  >
                    <option value="">Selecione</option>
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${darkMode ? "text-zinc-400" : "text-gray-500"}`}>Data *</label>
                  <input
                    id="form-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className={`w-full px-4 py-3 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-600 transition ${
                      darkMode 
                        ? "bg-zinc-800 border-zinc-700 text-white focus:border-purple-500" 
                        : "bg-gray-50 border-gray-200 text-gray-900 focus:border-purple-600"
                    }`}
                  />
                </div>

                {currentTab === "receita" ? (
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${darkMode ? "text-zinc-400" : "text-gray-500"}`}>Cliente (Opcional)</label>
                    <input
                      id="form-client"
                      type="text"
                      placeholder="Nome do cliente"
                      value={client}
                      onChange={(e) => setClient(e.target.value)}
                      className={`w-full px-4 py-3 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-600 transition ${
                        darkMode 
                          ? "bg-zinc-800 border-zinc-700 text-white focus:border-purple-500" 
                          : "bg-gray-50 border-gray-200 text-gray-900 focus:border-purple-600"
                      }`}
                    />
                  </div>
                ) : (
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${darkMode ? "text-zinc-400" : "text-gray-500"}`}>Estabelecimento (Opcional)</label>
                    <input
                      id="form-location"
                      type="text"
                      placeholder="Ex: Dunkin"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className={`w-full px-4 py-3 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-600 transition ${
                        darkMode 
                          ? "bg-zinc-800 border-zinc-700 text-white focus:border-purple-500" 
                          : "bg-gray-50 border-gray-200 text-gray-900 focus:border-purple-600"
                      }`}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 py-1">
                <input
                  id="form-recurrent"
                  type="checkbox"
                  checked={isRecurrent}
                  onChange={(e) => setIsRecurrent(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <span className={`text-xs font-medium cursor-pointer ${darkMode ? "text-zinc-300" : "text-gray-600"}`}>
                  Esta é uma transação recorrente mensal
                </span>
              </div>

              <button
                id="submit-transaction-form-btn"
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3.5 font-bold text-xs rounded-xl transition active:scale-95 disabled:opacity-50 mt-2"
              >
                {loading ? "Adicionando..." : `Adicionar ${currentTab === "receita" ? "Receita" : "Despesa"}`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Base64 Receipt Preview Modal */}
      {receiptModalUrl && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="relative max-w-md w-full bg-zinc-950 p-2 rounded-3xl overflow-hidden border border-zinc-800">
            <button
              id="close-receipt-preview-btn"
              onClick={() => setReceiptModalUrl(null)}
              className="absolute top-4 right-4 bg-black/60 hover:bg-black text-white p-2 rounded-full transition z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={receiptModalUrl} alt="Anexo do Recibo" className="w-full h-auto rounded-2xl max-h-[80vh] object-contain" />
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION DIALOG FOR TRANSACTION DELETION */}
      {transactionToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-6">
          <div className={`w-full max-w-xs p-5 rounded-3xl border shadow-2xl animate-slideUp ${
            darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100 text-slate-900"
          }`}>
            <h3 className="font-extrabold text-sm mb-2 text-rose-500">Excluir Lançamento?</h3>
            <p className={`text-xs mb-5 leading-relaxed ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
              Tem certeza que deseja remover este lançamento? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-2">
              <button
                id="cancel-delete-list-modal-btn"
                onClick={() => setTransactionToDelete(null)}
                className={`flex-1 py-2.5 text-[11px] font-bold rounded-xl border transition ${
                  darkMode 
                    ? "bg-slate-800 border-slate-700 hover:bg-slate-750 text-slate-300" 
                    : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                }`}
              >
                Cancelar
              </button>
              <button
                id="confirm-delete-list-modal-btn"
                onClick={async () => {
                  try {
                    if (isDemoActive()) {
                      await localDeleteDoc("transactions", transactionToDelete);
                    } else {
                      await deleteDoc(doc(db, "transactions", transactionToDelete));
                    }
                    onRefresh();
                  } catch (err) {
                    console.error("Failed to delete transaction:", err);
                  } finally {
                    setTransactionToDelete(null);
                  }
                }}
                className="flex-1 py-2.5 text-[11px] font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition active:scale-95"
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
