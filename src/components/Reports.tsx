import React, { useState } from "react";
import { 
  FileText, 
  Download, 
  Printer, 
  Calendar, 
  Briefcase, 
  ArrowUpRight, 
  ArrowDownLeft, 
  DollarSign, 
  Layers 
} from "lucide-react";
import { Transaction } from "../types";
import { Currency, formatCurrency } from "../utils/currency";

interface ReportsProps {
  darkMode: boolean;
  transactions: Transaction[];
  currency?: Currency;
}

export default function Reports({ darkMode, transactions, currency }: ReportsProps) {
  const [reportMonth, setReportMonth] = useState<string>(
    new Date().toISOString().substring(0, 7) // Current month "YYYY-MM"
  );

  // Extract month options
  const getMonths = () => {
    const list = [];
    const date = new Date();
    for (let i = 0; i < 12; i++) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const label = date.toLocaleString("pt-BR", { month: "long", year: "numeric" });
      list.push({ value: `${year}-${month}`, label });
      date.setMonth(date.getMonth() - 1);
    }
    return list;
  };

  const monthOptions = getMonths();

  // Filter items
  const filtered = transactions.filter(t => t.date.startsWith(reportMonth));
  
  const incomes = filtered.filter(t => t.type === "receita");
  const expenses = filtered.filter(t => t.type === "despesa");

  const totalIncomes = incomes.reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);
  const netSavings = totalIncomes - totalExpenses;

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // Simple CSV export function
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Data,Tipo,Descricao,Categoria,Valor,Local,Cliente\n";
    
    filtered.forEach(t => {
      const row = [
        t.date,
        t.type,
        `"${t.description.replace(/"/g, '""')}"`,
        t.category,
        t.amount,
        t.location ? `"${t.location.replace(/"/g, '""')}"` : "",
        t.client ? `"${t.client.replace(/"/g, '""')}"` : ""
      ].join(",");
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Relatorio_Kathleen_Contadora_${reportMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header and filters */}
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">Relatórios</h2>
          <p className={`text-xs ${darkMode ? "text-zinc-400" : "text-gray-500"}`}>
            Extratos e exportações financeiras
          </p>
        </div>

        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
          darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-100 shadow-sm"
        }`}>
          <Calendar className="w-3.5 h-3.5 text-purple-500" />
          <select
            id="reports-month-select"
            value={reportMonth}
            onChange={(e) => setReportMonth(e.target.value)}
            className="text-xs font-bold focus:outline-none bg-transparent cursor-pointer"
          >
            {monthOptions.map(m => (
              <option key={m.value} value={m.value} className={darkMode ? "bg-zinc-950 text-white" : "bg-white text-gray-900"}>
                {m.label.charAt(0).toUpperCase() + m.label.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Action triggers */}
      <div className="grid grid-cols-2 gap-3 print:hidden">
        <button
          id="export-csv-btn"
          onClick={handleExportCSV}
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 ${
            darkMode 
              ? "bg-zinc-900 border-zinc-800 hover:bg-zinc-850 text-purple-400" 
              : "bg-white border-gray-100 hover:bg-gray-50/50 shadow-sm text-purple-700"
          }`}
        >
          <Download className="w-4 h-4" />
          Exportar CSV / Excel
        </button>

        <button
          id="print-pdf-btn"
          onClick={handlePrint}
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 ${
            darkMode 
              ? "bg-zinc-900 border-zinc-800 hover:bg-zinc-850 text-purple-400" 
              : "bg-white border-gray-100 hover:bg-gray-50/50 shadow-sm text-purple-700"
          }`}
        >
          <Printer className="w-4 h-4" />
          Imprimir Extrato PDF
        </button>
      </div>

      {/* Main ledger block printable */}
      <div className={`p-6 rounded-3xl border print:border-none print:shadow-none ${
        darkMode ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-gray-100 shadow-sm text-gray-900"
      }`}>
        <div className="text-center pb-6 border-b border-zinc-800/10 mb-6">
          <div className="w-10 h-10 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-lg shadow-purple-600/10">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-extrabold text-base">Demonstrativo Financeiro Mensal</h3>
          <p className={`text-xs ${darkMode ? "text-zinc-500" : "text-gray-400"}`}>
            Período: {reportMonth} (Kathleen Contadora)
          </p>
        </div>

        {/* Totals grids */}
        <div className="grid grid-cols-3 gap-3 text-center mb-6">
          <div className={`p-3 rounded-2xl ${darkMode ? "bg-zinc-950" : "bg-gray-50/80"}`}>
            <span className={`text-[9px] font-bold uppercase tracking-wider block ${darkMode ? "text-zinc-500" : "text-gray-400"}`}>Entradas</span>
            <span className="text-xs font-bold font-mono text-emerald-500 mt-1 block">+{formatCurrency(totalIncomes, currency?.symbol)}</span>
          </div>
          <div className={`p-3 rounded-2xl ${darkMode ? "bg-zinc-950" : "bg-gray-50/80"}`}>
            <span className={`text-[9px] font-bold uppercase tracking-wider block ${darkMode ? "text-zinc-500" : "text-gray-400"}`}>Saídas</span>
            <span className="text-xs font-bold font-mono text-red-500 mt-1 block">-{formatCurrency(totalExpenses, currency?.symbol)}</span>
          </div>
          <div className={`p-3 rounded-2xl ${darkMode ? "bg-zinc-950" : "bg-gray-50/80"}`}>
            <span className={`text-[9px] font-bold uppercase tracking-wider block ${darkMode ? "text-zinc-500" : "text-gray-400"}`}>Resultado</span>
            <span className={`text-xs font-bold font-mono mt-1 block ${netSavings >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {netSavings >= 0 ? "+" : ""}{formatCurrency(netSavings, currency?.symbol)}
            </span>
          </div>
        </div>

        {/* Statement ledger list */}
        <div className="space-y-4">
          <h4 className="font-extrabold text-xs uppercase tracking-wider opacity-60">Lançamentos Detalhados</h4>
          
          {filtered.length === 0 ? (
            <p className={`text-center py-8 text-xs ${darkMode ? "text-zinc-500" : "text-gray-400"}`}>
              Nenhum dado financeiro para o mês selecionado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className={`border-b ${darkMode ? "border-zinc-800 text-zinc-500" : "border-gray-200 text-gray-400"}`}>
                    <th className="py-2.5 font-bold uppercase text-[9px] tracking-wider">Data</th>
                    <th className="py-2.5 font-bold uppercase text-[9px] tracking-wider">Descrição</th>
                    <th className="py-2.5 font-bold uppercase text-[9px] tracking-wider">Categoria</th>
                    <th className="py-2.5 font-bold uppercase text-[9px] tracking-wider text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${darkMode ? "divide-zinc-800/50" : "divide-gray-100"}`}>
                  {filtered.map(t => (
                    <tr key={t.id} className="hover:bg-purple-50/5">
                      <td className="py-3 font-mono font-medium tracking-tight whitespace-nowrap text-[10px]">{t.date}</td>
                      <td className="py-3 pr-2">
                        <div className="font-extrabold">{t.description}</div>
                        {t.location && <div className={`text-[9px] ${darkMode ? "text-zinc-500" : "text-gray-400"}`}>Local: {t.location}</div>}
                        {t.client && <div className={`text-[9px] ${darkMode ? "text-zinc-500" : "text-gray-400"}`}>Cli: {t.client}</div>}
                      </td>
                      <td className="py-3 font-medium whitespace-nowrap text-[10px]">{t.category}</td>
                      <td className={`py-3 text-right font-mono font-bold whitespace-nowrap ${
                        t.type === "receita" ? "text-emerald-500" : "text-gray-500"
                      }`}>
                        {t.type === "receita" ? "+" : "-"}{formatCurrency(t.amount, currency?.symbol)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
