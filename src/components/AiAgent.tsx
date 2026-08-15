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
  History,
  ExternalLink,
  X,
  Smartphone
} from "lucide-react";
import { collection, addDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { isDemoActive, localAddDoc } from "../utils/demoDb";
import { Currency, formatCurrency } from "../utils/currency";
import { Transaction } from "../types";

interface AiAgentProps {
  darkMode: boolean;
  onTransactionAdded: () => void;
  currency?: Currency;
  transactions?: Transaction[];
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

export default function AiAgent({ darkMode, onTransactionAdded, currency, transactions = [] }: AiAgentProps) {
  const activeSymbol = currency?.symbol || "R$";
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const [isIframe, setIsIframe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: "welcome-1",
      sender: "agent",
      text: `Olá! Sou a Kathleen, sua Agente de IA para registro e consulta de Entradas e Saídas na moeda ${currency?.name || "Real brasileiro (R$)"}. Pode falar ou digitar frases como 'Recebi ${activeSymbol} 1.500 do cliente João', 'Gastei ${activeSymbol} 45,90 no almoço' ou me perguntar 'Quanto eu gastei este mês?'.`,
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    }
  ]);
  const [recentAgentLogs, setRecentAgentLogs] = useState<any[]>([]);

  // Update welcome message if currency changes and no user interaction yet
  useEffect(() => {
    setMessages(prev => {
      if (prev.length === 1 && prev[0].id === "welcome-1") {
        return [{
          id: "welcome-1",
          sender: "agent",
          text: `Olá! Sou a Kathleen, sua Agente de IA para registro e consulta de Entradas e Saídas na moeda ${currency?.name || "Real brasileiro (R$)"}. Pode falar ou digitar frases como 'Recebi ${activeSymbol} 1.500 do cliente João', 'Gastei ${activeSymbol} 45,90 no almoço' ou me perguntar 'Quanto eu gastei este mês?'.`,
          timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        }];
      }
      return prev;
    });
  }, [currency?.code, activeSymbol]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Detect iframe context
  useEffect(() => {
    try {
      setIsIframe(window.self !== window.top);
    } catch (e) {
      setIsIframe(true);
    }
  }, []);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const toggleListening = async () => {
    if (isListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsListening(false);
      return;
    }

    setMicError(null);
    setTranscript("");

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMicError("Reconhecimento de voz não suportado neste navegador. Use o Google Chrome no celular ou digite a mensagem.");
      return;
    }

    // Explicitly request user media to trigger native Chrome microphone permission popup on Android/iOS
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (err: any) {
      console.warn("getUserMedia permission warning:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setMicError("Acesso ao microfone negado no Chrome. Toque no ícone de configurações ao lado do endereço web do Chrome para permitir o microfone.");
        return;
      }
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }

      const recognition = new SpeechRecognition();
      recognition.lang = "pt-BR";
      recognition.continuous = false;
      recognition.interimResults = true;

      let capturedText = "";

      recognition.onstart = () => {
        setIsListening(true);
        setTranscript("Ouvindo... Fale sua frase...");
      };

      recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        capturedText = final || interim;
        if (capturedText) {
          setTranscript(capturedText);
          setInputText(capturedText);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        setIsListening(false);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setMicError("Permissão de microfone negada ou bloqueada. Toque na barra de endereço do Chrome para permitir 'Microfone'.");
        } else if (event.error === "no-speech") {
          setTranscript("Nenhuma fala detectada. Tente novamente.");
        } else if (event.error !== "aborted") {
          setMicError(`Erro no microfone (${event.error}). Tente falar mais perto do celular ou digite a mensagem.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (capturedText.trim()) {
          handleProcessCommand(capturedText.trim());
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e: any) {
      console.error("Failed to start SpeechRecognition:", e);
      setIsListening(false);
      setMicError("Erro ao iniciar microfone. Verifique as permissões do seu navegador.");
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
    // Helper: Convert Portuguese words to number
    const wordValues: Record<string, number> = {
      "cem": 100, "cento": 100, "duzentos": 200, "trezentos": 300, "quatrocentos": 400,
      "quinhentos": 500, "seiscentos": 600, "setecentos": 700, "oitocentos": 800, "novecentos": 900,
      "mil": 1000, "dois mil": 2000, "três mil": 3000, "tres mil": 3000, "quatro mil": 4000, "cinco mil": 5000, "dez mil": 10000,
      "vinte": 20, "trinta": 30, "quarenta": 40, "cinquenta": 50, "sessenta": 60, "setenta": 70, "oitenta": 80, "noventa": 90,
      "dez": 10, "onze": 11, "doze": 12, "treze": 13, "quatorze": 14, "quinze": 15, "dezesseis": 16, "dezessete": 17, "dezoito": 18, "dezenove": 19,
      "um": 1, "dois": 2, "três": 3, "tres": 3, "quatro": 4, "cinco": 5, "seis": 6, "sete": 7, "oito": 8, "nove": 9
    };

    let amount = 0;
    if (numbers) {
      for (const numStr of numbers) {
        let cleaned = numStr.replace(/r\$/gi, "").replace(/\$/gi, "").replace(/€/gi, "").replace(/£/gi, "").replace(/¥/gi, "").replace(/chf/gi, "").replace(/a\$/gi, "").replace(/c\$/gi, "").replace(/zł/gi, "").replace(/kr/gi, "").replace(/\s/g, "").trim();
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

    if (amount === 0) {
      for (const [w, val] of Object.entries(wordValues)) {
        if (
          lower.includes(w + " reais") || 
          lower.includes(w + " contos") || 
          lower.includes(w + " dólares") || 
          lower.includes(w + " dolares") || 
          lower.includes(w + " euros") || 
          lower.includes(w + " libras") || 
          lower.includes(w + " pesos") || 
          lower.includes(w + " mangos") ||
          lower.includes(w + " pratas")
        ) {
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
      intent: "transaction",
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

    const totalIncome = transactions.filter(t => t.type === "receita").reduce((s, t) => s + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === "despesa").reduce((s, t) => s + t.amount, 0);

    let parsedResult: any = null;

    try {
      const res = await fetch("/api/parse-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToProcess,
          currentDate: new Date().toISOString(),
          currency: currency || { code: "BRL", symbol: "R$", name: "Real brasileiro (R$)" },
          transactionsSummary: {
            totalIncome,
            totalExpense,
            balance: totalIncome - totalExpense,
            count: transactions.length
          }
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

    const agentMsgId = "agt-" + Date.now();

    // If intent is conversational chat
    if (parsedResult.intent === "chat" || !parsedResult.type || parsedResult.amount === undefined) {
      const agentMsg: AgentMessage = {
        id: agentMsgId,
        sender: "agent",
        text: parsedResult.reply || "Olá! Como posso ajudar nas suas finanças hoje?",
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      };
      setMessages(prev => [...prev, agentMsg]);
    } else {
      // Intent is transaction entry
      const isRevenue = parsedResult.type === "receita";
      const agentMsg: AgentMessage = {
        id: agentMsgId,
        sender: "agent",
        text: parsedResult.reply || `Entendi! Identifiquei uma ${isRevenue ? "ENTRADA (Receita)" : "SAÍDA (Despesa)"} no valor de ${formatCurrency(parsedResult.amount || 0, activeSymbol)}. Confirme os dados abaixo para lançar no sistema:`,
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        parsedData: parsedResult,
        status: "pending"
      };
      setMessages(prev => [...prev, agentMsg]);
    }
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
        currency: currency?.code || "BRL",
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
    { label: `Recebi ${activeSymbol} 800 do cliente Pedro`, type: "receita" },
    { label: `Gastei ${activeSymbol} 45,90 no almoço no restaurante`, type: "despesa" },
    { label: `Entrada de ${activeSymbol} 1.200 de serviços prestados`, type: "receita" },
    { label: `Saída de ${activeSymbol} 90 de gasolina no posto`, type: "despesa" }
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
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-black tracking-tight">Agente de IA - Entradas e Saídas</h1>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                IA Ativa
              </span>
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1">
                Moeda do Perfil: <strong>{currency?.symbol || "R$"} ({currency?.code || "BRL"})</strong>
              </span>
            </div>
            <p className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
              Fale ou digite comandos naturais para registrar automaticamente receitas e despesas na moeda do seu perfil.
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
          {micError && (
            <div className={`p-3 mb-2.5 rounded-2xl border text-xs flex items-start justify-between gap-2 ${
              darkMode ? "bg-amber-500/10 border-amber-500/30 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-900"
            }`}>
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-[11px] leading-snug">{micError}</p>
                  {isIframe && (
                    <a
                      href={window.location.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-purple-500 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Abrir em Nova Aba (Permite o microfone)</span>
                    </a>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setMicError(null)} 
                className="p-1 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

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
