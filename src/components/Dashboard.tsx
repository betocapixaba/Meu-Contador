import React, { useState, useMemo, useEffect } from "react";
import { 
  Eye, 
  EyeOff, 
  ArrowUpRight, 
  ArrowDownLeft, 
  TrendingUp, 
  TrendingDown,
  Calendar, 
  Plus, 
  Sparkles, 
  Camera, 
  AlertCircle,
  Clock,
  Briefcase,
  Trash2,
  DollarSign,
  Globe,
  RefreshCcw,
  Info,
  Coins
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
  onDeleteTransaction?: (id: string) => void;
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
  onDeleteTransaction,
  currency
}: DashboardProps) {
  const [hideBalance, setHideBalance] = useState(false);
  const [balanceScope, setBalanceScope] = useState<"month" | "all">("month");
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().substring(0, 7) // e.g. "2026-07"
  );
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  // USD/BRL Real-Time Exchange Rate
  const [usdRate, setUsdRate] = useState<{
    bid: number;
    pctChange: number;
    updatedAt: string;
  }>({
    bid: 5.65,
    pctChange: 0.18,
    updatedAt: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  });
  const [loadingUsdRate, setLoadingUsdRate] = useState(false);

  const fetchUsdExchangeRate = async () => {
    setLoadingUsdRate(true);
    try {
      // 1. Primary: Try backend real-time route with cache-busting
      const res = await fetch(`/api/usd-rate?t=${Date.now()}`);
      const contentType = res.headers.get("content-type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (data && typeof data.bid === "number" && !isNaN(data.bid)) {
          setUsdRate({
            bid: data.bid,
            pctChange: typeof data.pctChange === "number" ? data.pctChange : 0,
            updatedAt: data.fullTimestamp || data.updatedAt || new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
          });
          setLoadingUsdRate(false);
          return;
        }
      }
    } catch {
      // Fallback to client fetch if server API route is unreachable
    }

    // 2. Client fallback with cache-buster
    try {
      const resDirect = await fetch(`https://economia.awesomeapi.com.br/json/last/USD-BRL?t=${Date.now()}`);
      if (resDirect.ok) {
        const data = await resDirect.json();
        if (data && data.USDBRL) {
          setUsdRate({
            bid: parseFloat(data.USDBRL.bid),
            pctChange: parseFloat(data.USDBRL.pctChange || "0"),
            updatedAt: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
          });
        }
      }
    } catch (err) {
      console.warn("Could not fetch live USD rate directly:", err);
    } finally {
      setLoadingUsdRate(false);
    }
  };

  useEffect(() => {
    fetchUsdExchangeRate();
    const interval = setInterval(fetchUsdExchangeRate, 30000); // refresh every 30 seconds for live rates

    const handleAppRefresh = () => {
      fetchUsdExchangeRate();
    };
    window.addEventListener("app-refresh", handleAppRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener("app-refresh", handleAppRefresh);
    };
  }, []);

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

  // Calculates financial balances for selected month
  const monthIncome = filteredTransactions
    .filter(t => t.type === "receita")
    .reduce((sum, t) => sum + t.amount, 0);

  const monthExpense = filteredTransactions
    .filter(t => t.type === "despesa")
    .reduce((sum, t) => sum + t.amount, 0);

  // Calculates ALL-TIME accumulated balances
  const totalAccumulatedIncome = transactions
    .filter(t => t.type === "receita")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalAccumulatedExpense = transactions
    .filter(t => t.type === "despesa")
    .reduce((sum, t) => sum + t.amount, 0);

  // Active values based on selected scope
  const totalIncome = balanceScope === "month" ? monthIncome : totalAccumulatedIncome;
  const totalExpense = balanceScope === "month" ? monthExpense : totalAccumulatedExpense;
  const currentBalance = totalIncome - totalExpense;

  // Calculates running net available balance for every transaction chronologically
  const runningBalancesMap = useMemo(() => {
    const map = new Map<string, number>();
    const sorted = [...transactions].sort((a, b) => {
      const dateComp = (a.date || "").localeCompare(b.date || "");
      if (dateComp !== 0) return dateComp;
      return (a.createdAt || "").localeCompare(b.createdAt || "");
    });
    let runningNet = 0;
    for (const t of sorted) {
      if (t.type === "receita") {
        runningNet += t.amount;
      } else {
        runningNet -= t.amount;
      }
      map.set(t.id, runningNet);
    }
    return map;
  }, [transactions]);

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
      {/* Real-Time USD x BRL Exchange Rate Banner (Minimized / Compact) */}
      <div className={`p-2.5 px-3.5 rounded-xl border transition-all ${
        darkMode 
          ? "bg-slate-900/90 border-slate-800 text-slate-100 shadow-xs" 
          : "bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-blue-50/80 border-emerald-100/90 text-slate-800 shadow-2xs"
      }`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4 animate-pulse" />
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  USD/BRL
                </span>
                <span className="flex h-1.5 w-1.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
              </div>

              <span className="text-sm font-black font-mono shrink-0">
                R$ {usdRate.bid.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>

              <span className={`text-[10px] font-bold flex items-center font-mono shrink-0 ${
                usdRate.pctChange >= 0 
                  ? "text-emerald-600 dark:text-emerald-400" 
                  : "text-rose-600 dark:text-rose-400"
              }`}>
                {usdRate.pctChange >= 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                {usdRate.pctChange >= 0 ? `+${usdRate.pctChange.toFixed(2)}%` : `${usdRate.pctChange.toFixed(2)}%`}
              </span>

              <span className={`text-[9px] hidden sm:inline ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                ({usdRate.updatedAt})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              id="goto-commodities-tab-btn"
              onClick={() => onSelectTab("Commodities")}
              title="Ver Commodities Digitais"
              className={`p-1.5 px-2 rounded-lg border text-xs transition active:scale-95 flex items-center gap-1 ${
                darkMode 
                  ? "bg-purple-900/40 border-purple-800/80 text-purple-300 hover:text-white hover:bg-purple-800/50" 
                  : "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100/80 shadow-2xs"
              }`}
            >
              <Coins className="w-3 h-3 text-purple-500" />
              <span className="text-[10px] font-extrabold">Commodities</span>
            </button>

            <button
              id="refresh-usd-rate-btn"
              onClick={fetchUsdExchangeRate}
              disabled={loadingUsdRate}
              title="Atualizar cotação do Dólar"
              className={`p-1.5 rounded-lg border text-xs transition active:scale-95 flex items-center gap-1 shrink-0 ${
                darkMode 
                  ? "bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700" 
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-2xs"
              }`}
            >
              <RefreshCcw className={`w-3 h-3 ${loadingUsdRate ? "animate-spin text-emerald-500" : ""}`} />
              <span className="hidden sm:inline text-[10px] font-bold">Atualizar</span>
            </button>
          </div>
        </div>

        {/* Note about transfer companies paying $0.10 less */}
        <div className={`mt-1.5 pt-1.5 border-t text-[10px] flex items-center gap-1.5 ${
          darkMode ? "border-slate-800/80 text-slate-300" : "border-emerald-200/50 text-slate-700"
        }`}>
          <Info className="w-3 h-3 text-emerald-500 shrink-0" />
          <p className="leading-tight text-[10px]">
            <span className="font-bold text-emerald-700 dark:text-emerald-300">Empresas de envio: </span>
            pagem <strong className="text-emerald-600 dark:text-emerald-400">$0.10 a menos</strong> (Estimado: <strong className="font-mono bg-emerald-500/10 px-1 py-0.2 rounded text-emerald-700 dark:text-emerald-300 font-bold">R$ {Math.max(0, usdRate.bid - 0.10).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>/USD).
          </p>
        </div>
      </div>

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

        {/* Scope selector tabs inside card */}
        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className="flex items-center bg-black/20 p-1 rounded-xl text-[11px] font-bold backdrop-blur-md">
            <button
              onClick={() => setBalanceScope("month")}
              className={`px-3 py-1 rounded-lg transition ${
                balanceScope === "month" ? "bg-white text-purple-950 shadow-xs" : "text-white/80 hover:text-white"
              }`}
            >
              Saldo do Mês
            </button>
            <button
              onClick={() => setBalanceScope("all")}
              className={`px-3 py-1 rounded-lg transition ${
                balanceScope === "all" ? "bg-white text-purple-950 shadow-xs" : "text-white/80 hover:text-white"
              }`}
            >
              Saldo Geral Acumulado
            </button>
          </div>
          <span className="text-[10px] bg-white/20 px-2.5 py-1 rounded-lg font-bold uppercase tracking-widest backdrop-blur-sm shrink-0">
            {balanceScope === "month" ? "Filtro Mensal" : "Total Geral"}
          </span>
        </div>

        <div className="flex justify-between items-start mb-2 relative z-10">
          <div className="w-full">
            <span className="text-xs opacity-80 mb-1 font-bold uppercase tracking-wider block">
              Saldo Líquido Disponível
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-3xl font-extrabold tracking-tight font-sans ${currentBalance < 0 ? "text-rose-200" : "text-white"}`}>
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
            
            {/* Explicit calculation formula display */}
            {!hideBalance && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-purple-100/90 font-medium flex-wrap">
                <span className="bg-emerald-400/25 px-2 py-0.5 rounded text-emerald-100 font-bold border border-emerald-300/30">
                  Receitas: +{formatCurrency(totalIncome, currency?.symbol)}
                </span>
                <span>-</span>
                <span className="bg-rose-500/25 px-2 py-0.5 rounded text-rose-100 font-bold border border-rose-300/30">
                  Despesas: -{formatCurrency(totalExpense, currency?.symbol)}
                </span>
                <span>=</span>
                <span className="font-bold underline text-white bg-white/10 px-2 py-0.5 rounded">
                  Saldo: {formatCurrency(currentBalance, currency?.symbol)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Income & Expense Breakdown Metric Cards */}
      <div className="grid grid-cols-2 gap-3.5">
        {/* Receitas Card */}
        <div
          id="dashboard-receitas-summary-card"
          onClick={() => onSelectTab("Receitas")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer select-none active:scale-98 ${
            darkMode
              ? "bg-slate-900 border-slate-800 hover:border-emerald-500/40 hover:bg-slate-850 shadow-sm"
              : "bg-white border-slate-100 hover:border-emerald-300 hover:bg-emerald-50/20 shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Receitas ({balanceScope === "month" ? "Mês" : "Geral"})
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg md:text-xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
            {hideBalance ? "••••••" : `+${formatCurrency(totalIncome, currency?.symbol)}`}
          </p>
          <p className="text-[10px] mt-1 text-slate-500 dark:text-slate-400 font-medium">
            {balanceScope === "month" ? "Entradas do mês selecionado" : "Entradas totais acumuladas"}
          </p>
        </div>

        {/* Despesas Card */}
        <div
          id="dashboard-despesas-summary-card"
          onClick={() => onSelectTab("Despesas")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer select-none active:scale-98 ${
            darkMode
              ? "bg-slate-900 border-slate-800 hover:border-rose-500/40 hover:bg-slate-850 shadow-sm"
              : "bg-white border-slate-100 hover:border-rose-300 hover:bg-rose-50/20 shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Despesas ({balanceScope === "month" ? "Mês" : "Geral"})
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg md:text-xl font-extrabold font-mono text-rose-600 dark:text-rose-400">
            {hideBalance ? "••••••" : `-${formatCurrency(totalExpense, currency?.symbol)}`}
          </p>
          <p className="text-[10px] mt-1 text-slate-500 dark:text-slate-400 font-medium">
            {balanceScope === "month" ? "Saídas do mês selecionado" : "Saídas totais acumuladas"}
          </p>
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
        <h4 className={`font-bold text-sm tracking-tight mb-4 ${darkMode ? "text-white" : "text-slate-900"}`}>Gasto por Categoria</h4>

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
                        <span className={`font-semibold ${darkMode ? "text-slate-300" : "text-slate-700"}`}>{category}</span>
                        <span className={`font-mono font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>{formatCurrency(amount, currency?.symbol)}</span>
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
          <h4 className={`font-bold text-sm tracking-tight ${darkMode ? "text-white" : "text-slate-900"}`}>Atividades Recentes</h4>
          <button
            id="view-all-receitas-tab-btn"
            onClick={() => onSelectTab("Receitas")}
            className={`text-xs font-bold hover:underline ${darkMode ? "text-purple-400" : "text-purple-600"}`}
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
                    <p className={`text-xs font-bold line-clamp-1 ${darkMode ? "text-white" : "text-slate-900"}`}>{t.description}</p>
                    <p className={`text-[9px] mt-0.5 flex items-center gap-1.5 ${
                      darkMode ? "text-slate-400" : "text-slate-500"
                    }`}>
                      <span>{t.category}</span>
                      {t.location && (
                        <>
                          <span className={`w-1 h-1 rounded-full ${darkMode ? "bg-slate-600" : "bg-slate-400"}`}></span>
                          <span className="line-clamp-1">{t.location}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3.5">
                  <div className="text-right flex flex-col items-end">
                    <p className={`text-xs font-extrabold font-mono ${
                      t.type === "receita" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    }`}>
                      {t.type === "receita" ? "+" : "-"}{formatCurrency(t.amount, currency?.symbol)}
                    </p>
                    <p className={`text-[8px] font-mono mt-0.5 ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
                      {t.date}
                    </p>
                    {runningBalancesMap.has(t.id) && (
                      <span className={`text-[9px] font-bold mt-1 px-1.5 py-0.5 rounded-md font-mono inline-block ${
                        (runningBalancesMap.get(t.id) ?? 0) >= 0
                          ? darkMode 
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : darkMode 
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" 
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                      }`}>
                        Saldo Líq: {formatCurrency(runningBalancesMap.get(t.id)!, currency?.symbol)}
                      </span>
                    )}
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
                  if (!transactionToDelete) return;
                  const id = transactionToDelete;
                  setTransactionToDelete(null);
                  if (onDeleteTransaction) {
                    await onDeleteTransaction(id);
                  } else {
                    try {
                      if (isDemoActive()) {
                        await localDeleteDoc("transactions", id);
                      } else {
                        await deleteDoc(doc(db, "transactions", id));
                      }
                    } catch (err) {
                      console.warn("Delete error, trying fallback local delete:", err);
                      await localDeleteDoc("transactions", id);
                    } finally {
                      if (onRefresh) onRefresh();
                    }
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
