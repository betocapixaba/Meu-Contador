import React, { useState, useEffect, useRef } from "react";
import { 
  Bot, 
  Sparkles, 
  Send, 
  Mic, 
  MicOff, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CheckCircle2, 
  AlertCircle, 
  RotateCcw, 
  Zap, 
  Check, 
  Edit3, 
  Building, 
  Calendar, 
  Tag, 
  DollarSign, 
  HelpCircle,
  Clock,
  History
} from "lucide-react";
import { collection, addDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { isDemoActive, localAddDoc } from "../utils/demoDb";
import { Currency, formatCurrency } from "../utils/currency";

interface AiAgentProps {
  darkMode: boolean;
  onTransactionAdded: () => void;
  currency?: Currency;
}

interface AgentMessage {
  id: string;
  sender: "user" | "agent";
  text: string;
  timestamp: string;
  parsedData?: {
    type: "receita" | "despesa";
    amount: number;
    category: string;
    description: string;
    date: string;
    location?: string | null;
    client?: string | null;
    isRecurrent?: boolean;
    confidence?: number;
  };
  status?: "pending" | "confirmed" | "error";
}

export default function AiAgent({ darkMode, onTransactionAdded, currency }: AiAgentProps) {
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: "welcome-1",
      sender: "agent",
      text: "Olá! Sou o seu Agente de IA para registro de Entradas e Saídas. Pode digitar ou falar um comando como 'Recebi R$ 1.500 do cliente João' ou 'Gastei R$ 45,90 no almoço'.",
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    }
  ]);
  const [recentAgentLogs, setRecentAgentLogs] = useState<any[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Web Speech API setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = "pt-BR";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        setTranscript("Ouvindo... Fale sua entrada ou saída...");
      };

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        setInputText(text);
        handleProcessCommand(text);
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setTranscript("");
      try {
        recognitionRef.current?.start();
      } catch (e) {
        recognitionRef.current?.stop();
      }
    }
  };

  // Local rule-based parser in case API is offline
  const localFallbackParse = (text: string) => {
    const lower = text.toLowerCase().trim();
    let type: "receita" | "despesa" = "despesa";
    
    const revenueKeywords = [
      "recebi", "ganhei", "receita", "salario", "salário", "ganho", "pix de", 
      "vendi", "faturei", "entrada", "recebimento", "pagou", "faturamento"
    ];
    for (const kw of revenueKeywords) {
      if (lower.includes(kw)) {
        type = "receita";
        break;
      }
    }

    const numbers = lower.match(/(?:r\$\s*|\$\s*)?(\d+(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:\.\d+)?)/gi);
    let amount = 0;
    if (numbers) {
      for (const numStr of numbers) {
        let cleaned = numStr.replace(/r\$/g, "").replace(/\$/g, "").replace(/\s/g, "").trim();
        if (cleaned.includes(",") && cleaned.includes(".")) {
          cleaned = cleaned.replace(/\./g, "").replace(/,/g, ".");
        } else if (cleaned.includes(",")) {
          cleaned = cleaned.replace(/,/g, ".");
        }
        const val = parseFloat(cleaned);
        if (!isNaN(val) && val > 0 && val !== new Date().getFullYear()) {
          amount = val;
          break;
        }
      }
    }

    let category = type === "receita" ? "Serviços" : "Outros";
    if (lower.includes("almoço") || lower.includes("jantar") || lower.includes("comer") || lower.includes("mercado") || lower.includes("padaria") || lower.includes("restaurante")) category = "Alimentação";
    else if (lower.includes("uber") || lower.includes("gasolina") || lower.includes("ônibus") || lower.includes("onibus") || lower.includes("combustível") || lower.includes("taxi")) category = "Transporte";
    else if (lower.includes("aluguel") || lower.includes("luz") || lower.includes("água") || lower.includes("agua") || lower.includes("internet")) category = "Moradia";
    else if (lower.includes("salario") || lower.includes("salário")) category = "Salário";
    else if (lower.includes("cinema") || lower.includes("festa") || lower.includes("bar")) category = "Lazer";
    else if (lower.includes("farmacia") || lower.includes("farmácia") || lower.includes("médico") || lower.includes("medico")) category = "Saúde";

    let client: string | null = null;
    if (type === "receita") {
      const clientMatch = text.match(/(?:do|da|de|pelo|pela|cliente)\s+([A-Z][a-zA-Z0-9À-ÿ]+)/);
      if (clientMatch && clientMatch[1]) {
        client = clientMatch[1];
      }
    }

    let location: string | null = null;
    const locMatch = text.match(/(?:no|na|em)\s+([A-Z][a-zA-Z0-9À-ÿ]+)/);
    if (locMatch && locMatch[1]) {
      location = locMatch[1];
    }

    return {
      type,
      amount,
      category,
      description: text,
      date: new Date().toISOString().split("T")[0],
      location,
      client,
      isRecurrent: lower.includes("mensal") || lower.includes("assinatura") || lower.includes("todo mês"),
      confidence: 0.75
    };
  };

  const handleProcessCommand = async (textToProcess: string) => {
    if (!textToProcess.trim()) return;

    const userMsgId = "usr-" + Date.now();
    const nowTime = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    // Append User Message
    const newUserMsg: AgentMessage = {
      id: userMsgId,
      sender: "user",
      text: textToProcess.trim(),
      timestamp: nowTime
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInputText("");
    setLoading(true);

    let parsedResult: any = null;

    try {
      const res = await fetch("/api/parse-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToProcess,
          currentDate: new Date().toISOString()
        })
      });

      if (res.ok) {
        parsedResult = await res.json();
      } else {
        parsedResult = localFallbackParse(textToProcess);
      }
    } catch (err) {
      console.warn("Error calling parse API, using fallback:", err);
      parsedResult = localFallbackParse(textToProcess);
    } finally {
      setLoading(false);
    }

    // Append Agent Response Message with Parsed Data Card
    const agentMsgId = "agt-" + Date.now();
    const isRevenue = parsedResult.type === "receita";

    const agentMsg: AgentMessage = {
      id: agentMsgId,
      sender: "agent",
      text: `Entendi! Identifiquei uma ${isRevenue ? "ENTRADA (Receita)" : "SAÍDA (Despesa)"} no valor de ${formatCurrency(parsedResult.amount || 0, currency?.symbol || "R$")}. Confirme os dados abaixo para lançar no sistema:`,
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      parsedData: parsedResult,
      status: "pending"
    };

    setMessages(prev => [...prev, agentMsg]);
  };

  // Confirm and Save transaction to Firestore / Local DB
  const handleConfirmTransaction = async (msgId: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg || !msg.parsedData) return;

    try {
      const isDemo = isDemoActive();
      const currentUser = isDemo ? { uid: "local-demo-user" } : auth.currentUser;

      if (!currentUser) {
        alert("Por favor, faça login para salvar a transação.");
        return;
      }

      const txData = {
        userId: currentUser.uid,
        type: msg.parsedData.type,
        amount: Number(msg.parsedData.amount) || 0,
        category: msg.parsedData.category || "Outros",
        location: msg.parsedData.location || null,
        client: msg.parsedData.client || null,
        description: msg.parsedData.description || "Lançamento via Agente de IA",
        date: msg.parsedData.date || new Date().toISOString().split("T")[0],
        isRecurrent: !!msg.parsedData.isRecurrent,
        receiptImage: null,
        createdAt: new Date().toISOString()
      };

      if (isDemo) {
        await localAddDoc("transactions", txData);
      } else {
        await addDoc(collection(db, "transactions"), txData);
      }

      // Mark message as confirmed
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: "confirmed" } : m));
      
      // Update recent agent log
      setRecentAgentLogs(prev => [
        {
          id: Date.now().toString(),
          type: txData.type,
          amount: txData.amount,
          description: txData.description,
          client: txData.client,
          date: txData.date
        },
        ...prev
      ]);

      onTransactionAdded();
    } catch (err) {
      console.error("Erro ao salvar pelo Agente:", err);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: "error" } : m));
    }
  };

  const quickPrompts = [
    { label: "Recebi R$ 800 do cliente Pedro", type: "receita" },
    { label: "Gastei R$ 45,90 no almoço no restaurante", type: "despesa" },
    { label: "Entrada de R$ 1.200 de serviços prestados", type: "receita" },
    { label: "Saída de R$ 90 de gasolina no posto", type: "despesa" }
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Banner */}
      <div className={`p-5 rounded-3xl border shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
        darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100 text-slate-950"
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 rounded-2xl flex items-center justify-center text-white shadow-md shadow-purple-500/20 shrink-0 relative">
            <Bot className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse"></span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight">Agente de IA - Entradas e Saídas</h1>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                IA Ativa
              </span>
            </div>
            <p className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
              Fale ou digite comandos naturais para registrar automaticamente receitas e despesas.
            </p>
          </div>
        </div>

        {/* Quick Voice Trigger */}
        <button
          id="agent-mic-toggle-btn"
          onClick={toggleListening}
          className={`w-full sm:w-auto py-2.5 px-4 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 transition shadow-md active:scale-95 ${
            isListening 
              ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30" 
              : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-purple-500/20"
          }`}
        >
          {isListening ? (
            <>
              <MicOff className="w-4 h-4 animate-pulse" />
              <span>Gravando Voz... (Toque p/ parar)</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              <span>Falar por Voz</span>
            </>
          )}
        </button>
      </div>

      {/* Suggested Command Chips */}
      <div className={`p-4 rounded-3xl border ${
        darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100 shadow-sm"
      }`}>
        <p className={`text-xs font-extrabold mb-2.5 flex items-center gap-1.5 ${
          darkMode ? "text-slate-400" : "text-slate-500"
        }`}>
          <Sparkles className="w-3.5 h-3.5 text-purple-500" />
          <span>Exemplos de Comandos Rápidos:</span>
        </p>

        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((prompt, index) => (
            <button
              key={index}
              onClick={() => handleProcessCommand(prompt.label)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition active:scale-95 ${
                prompt.type === "receita"
                  ? darkMode 
                    ? "bg-emerald-950/30 border-emerald-800/50 text-emerald-400 hover:bg-emerald-900/40" 
                    : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                  : darkMode 
                    ? "bg-rose-950/30 border-rose-800/50 text-rose-400 hover:bg-rose-900/40" 
                    : "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
              }`}
            >
              {prompt.type === "receita" ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
              <span>&quot;{prompt.label}&quot;</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Stream Container */}
      <div className={`p-5 rounded-3xl border shadow-sm min-h-[380px] flex flex-col justify-between ${
        darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
      }`}>
        {/* Messages List */}
        <div className="space-y-4 mb-4 max-h-[480px] overflow-y-auto pr-1 no-scrollbar">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.sender === "agent" && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-1">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-[88%] sm:max-w-[75%] rounded-2xl p-4 text-xs leading-relaxed ${
                msg.sender === "user"
                  ? "bg-purple-600 text-white rounded-tr-none shadow-sm"
                  : darkMode
                    ? "bg-slate-800/90 border border-slate-700/80 text-slate-100 rounded-tl-none"
                    : "bg-slate-100 border border-slate-200/60 text-slate-900 rounded-tl-none"
              }`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-extrabold text-[10px] opacity-80">
                    {msg.sender === "user" ? "Você" : "Agente de IA"}
                  </span>
                  <span className="text-[9px] opacity-60 ml-2">{msg.timestamp}</span>
                </div>

                <p className="font-medium whitespace-pre-wrap">{msg.text}</p>

                {/* Parsed Data Interactive Confirmation Card */}
                {msg.parsedData && (
                  <div className={`mt-3 p-3.5 rounded-xl border text-xs ${
                    darkMode ? "bg-slate-950/80 border-slate-700" : "bg-white border-slate-200 shadow-xs"
                  }`}>
                    <div className="flex items-center justify-between border-b pb-2 mb-2 border-slate-200/20">
                      <span className={`font-black uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 ${
                        msg.parsedData.type === "receita" 
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                          : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                      }`}>
                        {msg.parsedData.type === "receita" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                        {msg.parsedData.type === "receita" ? "ENTRADA (Receita)" : "SAÍDA (Despesa)"}
                      </span>

                      <span className="font-extrabold text-sm text-purple-500">
                        {formatCurrency(msg.parsedData.amount || 0, currency?.symbol || "R$")}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] mb-3">
                      <div>
                        <span className="opacity-60 block text-[9px] uppercase font-bold">Categoria</span>
                        <span className="font-bold">{msg.parsedData.category}</span>
                      </div>
                      <div>
                        <span className="opacity-60 block text-[9px] uppercase font-bold">Data</span>
                        <span className="font-bold">{msg.parsedData.date}</span>
                      </div>
                      {msg.parsedData.client && (
                        <div>
                          <span className="opacity-60 block text-[9px] uppercase font-bold">Cliente</span>
                          <span className="font-bold text-purple-400">{msg.parsedData.client}</span>
                        </div>
                      )}
                      {msg.parsedData.location && (
                        <div>
                          <span className="opacity-60 block text-[9px] uppercase font-bold">Local</span>
                          <span className="font-bold">{msg.parsedData.location}</span>
                        </div>
                      )}
                    </div>

                    {/* Action button inside message */}
                    {msg.status === "confirmed" ? (
                      <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Lançamento Confirmado e Salvo!</span>
                      </div>
                    ) : msg.status === "error" ? (
                      <div className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5">
                        <AlertCircle className="w-4 h-4" />
                        <span>Erro ao salvar. Tente novamente.</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleConfirmTransaction(msg.id)}
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 active:scale-98 text-white py-2 px-3 text-xs font-extrabold rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirmar e Salvar Lançamento</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-purple-500 font-bold animate-pulse p-2">
              <Bot className="w-4 h-4" />
              <span>Agente de IA processando seu comando...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Control Box */}
        <div className="pt-3 border-t border-slate-200/20">
          {transcript && isListening && (
            <div className={`p-2.5 rounded-xl text-xs italic mb-2 border ${
              darkMode ? "bg-slate-950 border-slate-800 text-purple-300" : "bg-purple-50 border-purple-200 text-purple-800"
            }`}>
              &quot;{transcript}&quot;
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleProcessCommand(inputText);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              placeholder="Digite um comando: Ex: 'Recebi 500 do cliente Ana' ou 'Gastei 30 no mercado'"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={loading}
              className={`flex-1 px-4 py-3 text-xs rounded-2xl border focus:outline-none focus:ring-2 focus:ring-purple-500 transition ${
                darkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
              }`}
            />

            <button
              type="button"
              onClick={toggleListening}
              className={`p-3 rounded-2xl border transition active:scale-95 ${
                isListening
                  ? "bg-rose-600 border-rose-500 text-white animate-pulse"
                  : darkMode
                    ? "bg-slate-800 border-slate-700 text-purple-400 hover:bg-slate-700"
                    : "bg-purple-50 border-purple-200 text-purple-600 hover:bg-purple-100"
              }`}
              title="Falar por voz"
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 active:scale-95 text-white px-5 py-3 text-xs font-bold rounded-2xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              <span className="hidden xs:inline">Enviar</span>
            </button>
          </form>
        </div>
      </div>

      {/* Recent Agent Processed Activity Log */}
      {recentAgentLogs.length > 0 && (
        <div className={`p-5 rounded-3xl border shadow-sm ${
          darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100 text-slate-950"
        }`}>
          <h3 className="text-xs font-extrabold uppercase tracking-wider mb-3 flex items-center gap-2 text-purple-500">
            <History className="w-4 h-4" />
            Últimos Lançamentos Efetuados pelo Agente ({recentAgentLogs.length})
          </h3>

          <div className="space-y-2">
            {recentAgentLogs.map((log) => (
              <div
                key={log.id}
                className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${
                  darkMode ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-100"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold ${
                    log.type === "receita" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                  }`}>
                    {log.type === "receita" ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <p className="font-extrabold">{log.description}</p>
                    <p className="text-[10px] opacity-60">{log.date} {log.client ? `• Cliente: ${log.client}` : ""}</p>
                  </div>
                </div>

                <span className={`font-black ${log.type === "receita" ? "text-emerald-500" : "text-rose-500"}`}>
                  {log.type === "receita" ? "+" : "-"}{formatCurrency(log.amount, currency?.symbol || "R$")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
