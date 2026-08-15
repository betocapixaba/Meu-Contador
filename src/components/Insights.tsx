import React, { useState, useEffect } from "react";
import { Sparkles, Brain, Lightbulb, TrendingUp, RefreshCcw, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { Transaction, Goal } from "../types";

interface InsightsProps {
  darkMode: boolean;
  balance: number;
  totalIncome: number;
  totalExpense: number;
  transactions: Transaction[];
  goals: Goal[];
}

export default function Insights({ darkMode, balance, totalIncome, totalExpense, transactions, goals }: InsightsProps) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const generateClientFallbackAnalysis = () => {
    const netAmount = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? (netAmount / totalIncome) * 100 : 0;
    
    let summary = "";
    if (transactions.length === 0) {
      summary = "Você ainda não possui lançamentos este mês. Que tal registrar sua primeira despesa ou receita para começar?";
    } else if (totalIncome === 0 && totalExpense > 0) {
      summary = `Você registrou R$ ${totalExpense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em despesas este mês. Lembre-se de registrar seus ganhos para acompanhar o saldo real!`;
    } else if (netAmount < 0) {
      summary = `Atenção: Suas despesas (R$ ${totalExpense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}) superaram suas receitas (R$ ${totalIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}) este mês. Reduza gastos não essenciais para equilibrar as contas.`;
    } else {
      summary = `Bom trabalho! Suas finanças estão no azul este mês. Você guardou R$ ${netAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (cerca de ${savingsRate.toFixed(0)}% das suas receitas).`;
    }

    const alerts: string[] = [];
    const expenseByCategory: Record<string, number> = {};
    let totalComputedExpense = 0;
    transactions.forEach((t: any) => {
      if (t.type === "despesa") {
        const category = t.category || "Outros";
        expenseByCategory[category] = (expenseByCategory[category] || 0) + Number(t.amount || 0);
        totalComputedExpense += Number(t.amount || 0);
      }
    });

    let maxCategory = "";
    let maxAmount = 0;
    Object.entries(expenseByCategory).forEach(([cat, val]) => {
      if (val > maxAmount) {
        maxAmount = val;
        maxCategory = cat;
      }
    });

    if (maxAmount > 0 && totalComputedExpense > 0) {
      const pct = (maxAmount / totalComputedExpense) * 100;
      alerts.push(`Sua maior categoria de despesa é "${maxCategory}" (R$ ${maxAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}), representando ${pct.toFixed(0)}% dos seus gastos.`);
    }

    if (goals && goals.length > 0) {
      goals.slice(0, 2).forEach((g: any) => {
        const target = Number(g.targetAmount || 0);
        const current = Number(g.currentAmount || 0);
        if (target > 0) {
          const pct = (current / target) * 100;
          if (pct >= 100) {
            alerts.push(`Parabéns! Você alcançou sua meta: "${g.title}"!`);
          } else if (pct >= 80) {
            alerts.push(`Você está muito perto! Já alcançou ${pct.toFixed(0)}% da sua meta "${g.title}".`);
          }
        }
      });
    }

    if (alerts.length === 0) {
      alerts.push("Suas contas estão equilibradas. Mantenha os registros atualizados!");
    }

    return {
      summary,
      alerts,
      tip: "Mantenha a constância no registro diário dos seus gastos para manter controle total do seu orçamento.",
      motivation: "Pequenas economias diárias constroem a liberdade financeira do amanhã."
    };
  };

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      // Clean up transactions and goals to reduce token size while sending relevant info
      const simplifiedTransactions = transactions.slice(0, 10).map(t => ({
        type: t.type,
        amount: t.amount,
        category: t.category,
        description: t.description,
        date: t.date
      }));

      const simplifiedGoals = goals.map(g => ({
        title: g.title,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount
      }));

      const response = await fetch("/api/analyze-finances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          balance,
          totalIncome,
          totalExpense,
          transactions: simplifiedTransactions,
          goals: simplifiedGoals
        })
      });

      if (!response.ok) {
        throw new Error("Servidor indisponível");
      }

      const data = await response.json();
      setAnalysis(data);
    } catch (err: any) {
      console.warn("API fetch error, generating local fallback analysis:", err);
      const fallbackData = generateClientFallbackAnalysis();
      setAnalysis(fallbackData);
    } finally {
      setLoading(false);
    }
  };

  // Run on mount or when transactions change
  useEffect(() => {
    if (transactions.length > 0) {
      fetchAnalysis();
    }
  }, [transactions.length]);

  // Listen to app-refresh global event
  useEffect(() => {
    const handleAppRefresh = () => {
      fetchAnalysis();
    };
    window.addEventListener("app-refresh", handleAppRefresh);
    return () => {
      window.removeEventListener("app-refresh", handleAppRefresh);
    };
  }, [transactions, goals, balance, totalIncome, totalExpense]);

  return (
    <div className={`p-5 rounded-3xl border transition-all duration-300 ${
      darkMode 
        ? "bg-zinc-900 border-zinc-800 text-white shadow-xl shadow-purple-950/10" 
        : "bg-white border-gray-100 text-gray-900 shadow-md"
    }`}>
      <div 
        className={`flex justify-between items-center cursor-pointer select-none ${isExpanded ? "mb-4" : "mb-0"}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-600/10 text-purple-500 flex items-center justify-center">
            <Brain className="w-4.5 h-4.5" />
          </div>
          <div>
            <h4 className="font-bold text-sm tracking-tight flex items-center gap-2">
              <span>Análise Inteligente IA</span>
            </h4>
            <p className={`text-[9px] ${darkMode ? "text-zinc-500" : "text-gray-400"}`}>
              {isExpanded ? "Insights baseados nos seus lançamentos" : "Toque para expandir os insights da IA"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            id="refresh-insights-btn"
            onClick={fetchAnalysis}
            disabled={loading}
            title="Atualizar Análise"
            className={`p-1.5 rounded-lg transition active:scale-95 ${
              darkMode ? "hover:bg-zinc-800 text-zinc-400" : "hover:bg-gray-100 text-gray-500"
            }`}
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-purple-500" : ""}`} />
          </button>

          <button
            id="toggle-insights-expand-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Retrair Análise" : "Expandir Análise"}
            className={`p-1.5 rounded-lg transition active:scale-95 ${
              darkMode ? "hover:bg-zinc-800 text-purple-400" : "hover:bg-gray-100 text-purple-600"
            }`}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4 text-purple-500" /> : <ChevronDown className="w-4 h-4 text-purple-500" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {loading && !analysis ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Sparkles className="w-8 h-8 text-purple-600 animate-spin mb-2" />
              <p className={`text-xs ${darkMode ? "text-zinc-400" : "text-gray-500"}`}>
                Kathleen Contadora está analisando seus dados...
              </p>
            </div>
          ) : error ? (
            <div className={`p-3 rounded-xl text-xs border ${
              darkMode ? "bg-zinc-950 border-red-500/15 text-red-400" : "bg-red-50 border-red-100 text-red-600"
            }`}>
              {error}
              <button 
                id="retry-insights-btn"
                onClick={fetchAnalysis} 
                className="block text-purple-500 font-bold mt-1.5 hover:underline"
              >
                Tentar novamente
              </button>
            </div>
          ) : analysis ? (
            <div className="space-y-4 animate-fadeIn">
              {/* Summary */}
              <div className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                darkMode ? "bg-zinc-950/50 border border-zinc-800" : "bg-purple-50/20 border border-purple-100/50"
              }`}>
                <p className={darkMode ? "text-zinc-300" : "text-gray-700"}>
                  {analysis.summary}
                </p>
              </div>

              {/* Alerts */}
              {analysis.alerts && analysis.alerts.length > 0 && (
                <div className="space-y-1.5">
                  <span className={`text-[10px] font-extrabold uppercase tracking-wider ${
                    darkMode ? "text-zinc-500" : "text-gray-400"
                  }`}>Alertas da Kathleen</span>
                  <div className="space-y-2">
                    {analysis.alerts.map((alert: string, index: number) => (
                      <div key={index} className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                        darkMode 
                          ? "bg-zinc-950 border-purple-900/30 text-purple-300" 
                          : "bg-purple-50/40 border-purple-100/50 text-purple-900"
                      }`}>
                        <Lightbulb className="w-4 h-4 shrink-0 text-purple-500 mt-0.5" />
                        <span>{alert}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tip */}
              {analysis.tip && (
                <div className={`p-3 rounded-xl text-xs border ${
                  darkMode ? "bg-zinc-950 border-zinc-800/80 text-zinc-300" : "bg-amber-50/30 border-amber-100/50 text-gray-700"
                }`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                    <span className="font-extrabold text-[10px] uppercase tracking-wider text-amber-500">Dica Prática</span>
                  </div>
                  <p>{analysis.tip}</p>
                </div>
              )}

              {/* Motivation */}
              {analysis.motivation && (
                <div className={`p-3 rounded-xl text-center italic text-xs ${
                  darkMode ? "bg-purple-950/20 text-purple-300" : "bg-purple-50 text-purple-700"
                }`}>
                  "{analysis.motivation}"
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className={`text-xs ${darkMode ? "text-zinc-500" : "text-gray-400"}`}>
                Adicione sua primeira transação para ativar a análise inteligente!
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
