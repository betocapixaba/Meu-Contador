import React, { useState } from "react";
import { 
  Eye, 
  EyeOff, 
  ArrowUpRight, 
  ArrowDownLeft, 
  TrendingUp, 
  Calendar, 
  Plus, 
  Sparkles, 
  Camera, 
  AlertCircle,
  Clock,
  Briefcase,
  Trash2
} from "lucide-react";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { Transaction } from "../types";
import Insights from "./Insights";
import { isDemoActive, localDeleteDoc } from "../utils/demoDb";
import { Currency, formatCurrency } from "../utils/currency";

interface DashboardProps {
  darkMode: boolean;
  transactions: Transaction[];
  onOpenVoice: () => void;
  onOpenScan: () => void;
  onSelectTab: (tab: string) => void;
  goals: any[];
  onRefresh?: () => void;
  currency?: Currency;
}

export default function Dashboard({ 
  darkMode, 
  transactions, 
  onOpenVoice, 
  onOpenScan, 
  onSelectTab,
  goals,
  onRefresh,
  currency
}: DashboardProps) {
  const [hideBalance, setHideBalance] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().substring(0, 7) // e.g. "2026-07"
  );
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  // Month options for filter (last 6 months)
  const getMonthOptions = () => {
    const options = [];
    const date = new Date();
    for (let i = 0; i < 6; i++) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const label = date.toLocaleString("pt-BR", { month: "long", year: "numeric" });
      options.push({ value: `${year}-${month}`, label });
      date.setMonth(date.getMonth() - 1);
    }
    return options;
  };

  const months = getMonthOptions();

  // Filtered transactions for the selected month
  const filteredTransactions = transactions.filter(t => t.date.startsWith(selectedMonth));

  // Calculates financial balances
  const totalIncome = filteredTransactions
    .filter(t => t.type === "receita")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = filteredTransactions
    .filter(t => t.type === "despesa")
    .reduce((sum, t) => sum + t.amount, 0);

  const currentBalance = totalIncome - totalExpense;

  // Render Category Icon / Color helper
  const getCategoryColor = (category: string, type: string) => {
    if (type === "receita") return "bg-emerald-500/10 text-emerald-500";
    
    switch (category?.toLowerCase()) {
      case "alimentação":
        return "bg-amber-500/10 text-amber-500";
      case "transporte":
        return "bg-blue-500/10 text-blue-500";
      case "moradia":
        return "bg-indigo-500/10 text-indigo-500";
      case "lazer":
        return "bg-pink-500/10 text-pink-500";
      case "saúde":
        return "bg-red-500/10 text-red-500";
      case "compras":
        return "bg-purple-500/10 text-purple-500";
      default:
        return "bg-gray-500/10 text-gray-500";
    }
  };

  return (
    <div className="space-y-6">
      {/* Upper Month Selector */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">Painel Principal</h2>
          <p className={`text-xs ${darkMode ? "text-zinc-400" : "text-gray-500"}`}>
            Seu resumo financeiro mensal
          </p>
        </div>

        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
          darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-100 shadow-sm"
        }`}>
          <Calendar className="w-3.5 h-3.5 text-purple-500" />
          <select
            id="month-filter-select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs font-bold focus:outline-none bg-transparent cursor-pointer"
          >
            {months.map(m => (
              <option key={m.value} value={m.value} className={darkMode ? "bg-zinc-950 text-white" : "bg-white text-gray-900"}>
                {m.label.charAt(0).toUpperCase() + m.label.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Vibrant Palette Balance Card */}
      <div className={`p-6 rounded-[2rem] relative overflow-hidden transition-all duration-200 shadow-xl ${
        darkMode 
          ? "bg-gradient-to-br from-purple-600 via-purple-700 to-purple-800 text-white shadow-purple-950/40 border border-purple-500/20" 
          : "bg-purple-600 text-white shadow-lg shadow-purple-200"
      }`}>
        {/* Geometric circle overlay from mockup */}
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-white opacity-10 rounded-full"></div>
        <div className="absolute left-1/3 -bottom-6 w-16 h-16 bg-white opacity-5 rounded-full"></div>

        <div className="flex justify-between items-start mb-4 relative z-10">
          <div>
            <span className="text-xs opacity-80 mb-1 font-bold uppercase tracking-wider">Saldo Líquido Disponível</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-3xl font-extrabold tracking-tight font-sans">
                {hideBalance ? "••••••" : formatCurrency(currentBalance, currency?.symbol)}
              </span>
              <button
                id="toggle-balance-visibility-btn"
                onClick={() => setHideBalance(!hideBalance)}
                className="p-1 rounded-full hover:bg-white/10 transition active:scale-90"
              >
                {hideBalance ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>
          <span className="text-[10px] bg-white/20 px-3 py-1.5 rounded-lg font-bold uppercase tracking-widest backdrop-blur-sm">
            Conta Principal
          </span>
        </div>

        {/* Quick totals in two elegant visual pills */}
        <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/10 relative z-10">
          <div>
            <div className="flex items-center gap-1.5 opacity-80 text-[10px] font-bold uppercase tracking-wide">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
              Receitas
            </div>
            <p className="text-sm font-extrabold tracking-tight mt-0.5 font-sans">
              {hideBalance ? "••••••" : formatCurrency(totalIncome, currency?.symbol)}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 opacity-80 text-[10px] font-bold uppercase tracking-wide">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-450"></div>
              Despesas
            </div>
            <p className="text-sm font-extrabold tracking-tight mt-0.5 font-sans">
              {hideBalance ? "••••••" : formatCurrency(totalExpense, currency?.symbol)}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 gap-3.5">
        <button
          id="quick-voice-btn"
          onClick={onOpenVoice}
          className={`p-4 rounded-2xl border text-left transition active:scale-95 ${
            darkMode 
              ? "bg-slate-900 border-slate-800 hover:bg-slate-800/70" 
              : "bg-white border-slate-100 hover:bg-slate-50 shadow-sm"
          }`}
        >
          <div className="w-10 h-10 bg-purple-500/10 text-purple-500 rounded-xl flex items-center justify-center mb-3">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="text-xs font-extrabold block">Falar com Kathleen</span>
          <span className={`text-[10px] mt-0.5 block ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
            Comando de voz inteligente
          </span>
        </button>

        <button
          id="quick-scan-btn"
          onClick={onOpenScan}
          className={`p-4 rounded-2xl border text-left transition active:scale-95 ${
            darkMode 
              ? "bg-slate-900 border-slate-800 hover:bg-slate-800/70" 
              : "bg-white border-slate-100 hover:bg-slate-50 shadow-sm"
          }`}
        >
          <div className="w-10 h-10 bg-purple-500/10 text-purple-500 rounded-xl flex items-center justify-center mb-3">
            <Camera className="w-5 h-5" />
          </div>
          <span className="text-xs font-extrabold block">Escanear Recibo</span>
          <span className={`text-[10px] mt-0.5 block ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
            Ler nota fiscal via foto
          </span>
        </button>
      </div>

      {/* Intelligent Gemini Insights */}
      <Insights
        darkMode={darkMode}
        balance={currentBalance}
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        transactions={filteredTransactions}
        goals={goals}
      />

      {/* Category Visualizer / Custom Bar Chart */}
      <div className={`p-5 rounded-[2rem] border ${
        darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100 shadow-sm"
      }`}>
        <h4 className="font-bold text-sm tracking-tight mb-4">Gasto por Categoria</h4>

        {filteredTransactions.filter(t => t.type === "despesa").length === 0 ? (
          <div className="text-center py-6">
            <p className={`text-xs ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
              Nenhuma despesa registrada neste mês.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* Aggregate categories */}
            {(() => {
              const categoryMap: { [key: string]: number } = {};
              filteredTransactions
                .filter(t => t.type === "despesa")
                .forEach(t => {
                  categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
                });

              const totalCatsExpense = Object.values(categoryMap).reduce((a, b) => a + b, 0);

              return Object.entries(categoryMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([category, amount]) => {
                  const percentage = totalCatsExpense > 0 ? (amount / totalCatsExpense) * 100 : 0;
                  return (
                    <div key={category} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{category}</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(amount, currency?.symbol)}</span>
                      </div>
                      <div className={`w-full h-2 rounded-full overflow-hidden ${darkMode ? "bg-slate-800" : "bg-slate-100"}`}>
                        <div 
                          className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full" 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                });
            })()}
          </div>
        )}
      </div>

      {/* Recent Transactions List */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="font-bold text-sm tracking-tight text-slate-800 dark:text-slate-200">Atividades Recentes</h4>
          <button
            id="view-all-receitas-tab-btn"
            onClick={() => onSelectTab("Receitas")}
            className="text-xs text-purple-600 dark:text-purple-400 font-bold hover:underline"
          >
            Ver Tudo
          </button>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className={`p-8 text-center rounded-[2rem] border border-dashed ${
            darkMode ? "border-slate-800 bg-slate-900/30" : "border-slate-200 bg-slate-50/40"
          }`}>
            <Clock className={`w-8 h-8 mx-auto mb-2 opacity-55 ${darkMode ? "text-slate-600" : "text-slate-400"}`} />
            <p className={`text-xs ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
              Nenhuma transação lançada para este mês ainda.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredTransactions.slice(0, 5).map((t) => (
              <div
                key={t.id}
                className={`p-4 rounded-2xl border flex items-center justify-between transition ${
                  darkMode ? "bg-slate-900 border-slate-800/80" : "bg-white border-slate-100 shadow-sm"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
                    getCategoryColor(t.category, t.type)
                  }`}>
                    {t.type === "receita" ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">{t.description}</p>
                    <p className={`text-[9px] mt-0.5 flex items-center gap-1.5 ${
                      darkMode ? "text-slate-400" : "text-slate-500"
                    }`}>
                      <span>{t.category}</span>
                      {t.location && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-600"></span>
                          <span className="line-clamp-1">{t.location}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3.5">
                  <div className="text-right">
                    <p className={`text-xs font-extrabold font-mono ${
                      t.type === "receita" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    }`}>
                      {t.type === "receita" ? "+" : "-"}{formatCurrency(t.amount, currency?.symbol)}
                    </p>
                    <p className={`text-[8px] font-mono mt-0.5 ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
                      {t.date}
                    </p>
                  </div>

                   <button
                    id={`dashboard-delete-btn-${t.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setTransactionToDelete(t.id);
                    }}
                    className={`p-1.5 rounded-xl transition-all duration-150 text-rose-500 hover:text-rose-600 active:scale-90 ${
                      darkMode ? "bg-rose-500/5 hover:bg-rose-500/15 hover:bg-rose-500/10" : "bg-rose-50 hover:bg-rose-100"
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
      </div>

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
                id="cancel-delete-modal-btn"
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
                id="confirm-delete-modal-btn"
                onClick={async () => {
                  try {
                    if (isDemoActive()) {
                      await localDeleteDoc("transactions", transactionToDelete);
                    } else {
                      await deleteDoc(doc(db, "transactions", transactionToDelete));
                    }
                    if (onRefresh) onRefresh();
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
