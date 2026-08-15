import React, { useState, useEffect, useRef } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { 
  Mic, 
  MicOff, 
  Send, 
  Sparkles, 
  Check, 
  AlertCircle, 
  X, 
  Volume2, 
  ExternalLink,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Tag,
  DollarSign,
  Building,
  RotateCcw,
  Loader2
} from "lucide-react";
import { isDemoActive, localAddDoc } from "../utils/demoDb";
import { Currency, formatCurrency } from "../utils/currency";

interface VoiceAssistantProps {
  darkMode: boolean;
  onTransactionAdded: () => void;
  onClose?: () => void;
  currency?: Currency;
}

export default function VoiceAssistant({ darkMode, onTransactionAdded, onClose, currency }: VoiceAssistantProps) {
  const activeSymbol = currency?.symbol || "R$";
  const [isListening, setIsListening] = useState(false);
  const [isAudioRecording, setIsAudioRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isIframe, setIsIframe] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    // Detect if running inside iframe
    try {
      setIsIframe(window.self !== window.top);
    } catch (e) {
      setIsIframe(true);
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        try { mediaRecorderRef.current.stop(); } catch (e) {}
      }
    };
  }, []);

  const speakText = (text: string) => {
    try {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        utterance.rate = 1.05;
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.warn("Speech synthesis unavailable:", e);
    }
  };

  const startListening = async () => {
    setError(null);
    setSuccessData(null);
    setTranscript("");

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    // Fallback directly to MediaRecorder audio streaming if SpeechRecognition is not present
    if (!SpeechRecognition) {
      startAudioClipRecording();
      return;
    }

    // Explicitly request user media to trigger permission popup
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (err: any) {
      console.warn("getUserMedia permission warning:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError("Acesso ao microfone negado. Toque no ícone de configurações/cadeado na barra do navegador para permitir o microfone.");
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
        setError(null);
        setTranscript("Ouvindo... Fale sua receita ou despesa...");
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
          setManualInput(capturedText);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        setIsListening(false);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setError("Permissão de microfone negada. Toque na barra do navegador para permitir 'Microfone' ou digite sua frase abaixo.");
        } else if (event.error === "no-speech") {
          setTranscript("Nenhuma fala detectada. Tente falar novamente.");
        } else if (event.error !== "aborted") {
          // If speech recognition fails, try media recorder
          startAudioClipRecording();
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (capturedText.trim()) {
          processCommand(capturedText.trim());
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e: any) {
      console.warn("Failed to start SpeechRecognition, switching to audio recorder:", e);
      setIsListening(false);
      startAudioClipRecording();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      setIsListening(false);
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
      setIsAudioRecording(false);
    }
  };

  // Fallback MediaRecorder audio recording
  const startAudioClipRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Gravação de áudio não suportada neste dispositivo. Por favor, use os exemplos rápidos ou digite o texto.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        setIsAudioRecording(false);
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (audioBlob.size > 500) {
          await processAudioBlob(audioBlob);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsAudioRecording(true);
      setTranscript("Gravando áudio com IA Kathleen...");
    } catch (err: any) {
      console.error("Audio recording error:", err);
      setError("Não foi possível acessar o microfone. Digite sua frase ou toque em um dos exemplos rápidos abaixo.");
    }
  };

  const processAudioBlob = async (blob: Blob) => {
    setLoading(true);
    setError(null);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        const response = await fetch("/api/parse-audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audioBase64: base64Data,
            mimeType: blob.type || "audio/webm",
            currentDate: new Date().toISOString(),
            currency: currency || { code: "BRL", symbol: "R$", name: "Real brasileiro (R$)" }
          })
        });

        if (response.ok) {
          const parsed = await response.json();
          if (parsed.transcript) {
            setTranscript(parsed.transcript);
            setManualInput(parsed.transcript);
          }
          await saveTransactionResult(parsed);
        } else {
          throw new Error("Erro ao processar áudio pela IA.");
        }
      };
    } catch (err: any) {
      console.error("Audio parse error:", err);
      setError("Não conseguimos compreender o áudio. Digite sua frase abaixo.");
      setLoading(false);
    }
  };

  const localParseCommand = (text: string) => {
    const lower = text.toLowerCase().trim();
    let type: "receita" | "despesa" = "despesa";
    const revenueKeywords = ["recebi", "ganhei", "receita", "salario", "salário", "ganho", "pix de", "vendi", "venda", "faturei", "faturamento", "entrada", "recebimento", "comissão", "provento"];
    for (const kw of revenueKeywords) {
      if (lower.includes(kw)) {
        type = "receita";
        break;
      }
    }

    const numbers = lower.match(/(?:r\$\s*|\$\s*|€\s*|£\s*|¥\s*|chf\s*|a\$\s*|c\$\s*|zł\s*|kr\s*)?(\d+(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:\.\d+)?)/gi);
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

    let category = type === "receita" ? "Serviços" : "Outros";
    if (lower.includes("almoço") || lower.includes("jantar") || lower.includes("comer") || lower.includes("mercado") || lower.includes("padaria") || lower.includes("dunkin") || lower.includes("restaurante")) category = "Alimentação";
    else if (lower.includes("uber") || lower.includes("gasolina") || lower.includes("ônibus") || lower.includes("onibus") || lower.includes("taxi") || lower.includes("combustível")) category = "Transporte";
    else if (lower.includes("aluguel") || lower.includes("luz") || lower.includes("agua") || lower.includes("água") || lower.includes("internet") || lower.includes("condomínio")) category = "Moradia";
    else if (lower.includes("salario") || lower.includes("salário")) category = "Salário";
    else if (lower.includes("cinema") || lower.includes("show") || lower.includes("bar") || lower.includes("praia") || lower.includes("festa")) category = "Lazer";
    else if (lower.includes("farmacia") || lower.includes("farmácia") || lower.includes("médico") || lower.includes("remédio")) category = "Saúde";

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
      location,
      client,
      description: text.charAt(0).toUpperCase() + text.slice(1),
      date: new Date().toISOString().split("T")[0],
      isRecurrent: lower.includes("mensal") || lower.includes("recorrente") || lower.includes("assinatura"),
      reply: `Identifiquei uma ${type === "receita" ? "Receita" : "Despesa"} de ${formatCurrency(amount, activeSymbol)}.`
    };
  };

  const processCommand = async (commandText: string) => {
    if (!commandText.trim()) return;
    setLoading(true);
    setError(null);
    setSuccessData(null);

    let parsedData: any = null;

    try {
      const response = await fetch("/api/parse-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: commandText,
          currentDate: new Date().toISOString(),
          currency: currency || { code: "BRL", symbol: "R$", name: "Real brasileiro (R$)" }
        })
      });

      if (response.ok) {
        parsedData = await response.json();
      } else {
        parsedData = localParseCommand(commandText);
      }
    } catch (err) {
      console.warn("Parse API fetch error, using local fallback parser:", err);
      parsedData = localParseCommand(commandText);
    }

    await saveTransactionResult(parsedData);
  };

  const saveTransactionResult = async (parsedData: any) => {
    try {
      if (!parsedData || (parsedData.intent === "chat" && !parsedData.type)) {
        setError(parsedData?.reply || "Entendido! Se desejar lançar um valor, fale o valor e o motivo (ex: 'Recebi 500 reais' ou 'Gastei 40 no almoço').");
        setLoading(false);
        return;
      }

      const amountVal = Number(parsedData.amount) || 0;
      if (amountVal <= 0) {
        setError("Não conseguimos identificar o valor em dinheiro na sua frase. Tente dizer: 'Recebi 150 reais' ou 'Gastei 30 no mercado'.");
        setLoading(false);
        return;
      }

      const isDemo = isDemoActive();
      const currentUser = isDemo ? { uid: "local-demo-user" } : auth.currentUser;
      
      if (currentUser) {
        const transactionData = {
          userId: currentUser.uid,
          type: parsedData.type === "receita" ? "receita" : "despesa",
          amount: amountVal,
          currency: currency?.code || "BRL",
          category: parsedData.category || (parsedData.type === "receita" ? "Serviços" : "Outros"),
          location: parsedData.location || null,
          client: parsedData.client || null,
          description: parsedData.description || (parsedData.type === "receita" ? "Receita via Voz" : "Despesa via Voz"),
          date: parsedData.date || new Date().toISOString().split("T")[0],
          isRecurrent: !!parsedData.isRecurrent,
          receiptImage: null,
          createdAt: new Date().toISOString()
        };

        if (isDemo) {
          await localAddDoc("transactions", transactionData);
        } else {
          await addDoc(collection(db, "transactions"), transactionData);
        }

        setSuccessData(parsedData);
        setManualInput("");
        onTransactionAdded(); // Trigger refresh on parent
        
        // Conversational speech feedback
        const spokenType = parsedData.type === "receita" ? "Receita" : "Despesa";
        speakText(`${spokenType} de ${formatCurrency(amountVal, activeSymbol)} registrada com sucesso na categoria ${transactionData.category}!`);
      } else {
        throw new Error("Usuário não autenticado para salvar.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Não conseguimos compreender a transação. Tente falar ou digitar de forma mais direta, ex: 'Gastei 15 no almoço'.");
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      processCommand(manualInput);
    }
  };

  const quickExamples = [
    { label: `💰 Recebi ${activeSymbol} 1.500 do João`, text: `Recebi 1500 ${currency?.code === "BRL" ? "reais" : activeSymbol} do cliente João`, type: "receita" },
    { label: `🍔 Gastei ${activeSymbol} 45,00 no almoço`, text: `Gastei 45 ${currency?.code === "BRL" ? "reais" : activeSymbol} no almoço hoje`, type: "despesa" },
    { label: `🛒 Mercado ${activeSymbol} 180,00`, text: `Paguei 180 ${currency?.code === "BRL" ? "reais" : activeSymbol} de compras no mercado`, type: "despesa" },
    { label: `🏢 Salário ${activeSymbol} 3.500,00`, text: `Recebi 3500 ${currency?.code === "BRL" ? "reais" : activeSymbol} de salário`, type: "receita" },
    { label: `🚗 Transporte ${activeSymbol} 25,00`, text: `Gastei 25 ${currency?.code === "BRL" ? "reais" : activeSymbol} de transporte`, type: "despesa" }
  ];

  const activeRecording = isListening || isAudioRecording;

  return (
    <div className={`p-6 rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl border max-h-[85vh] overflow-y-auto ${
      darkMode ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-100 text-slate-900"
    }`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="font-extrabold text-base tracking-tight">Kathleen Assistente de Voz</h3>
              <span className="bg-purple-500/20 text-purple-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                IA 3.7
              </span>
              <span className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Moeda: {activeSymbol} ({currency?.code || "BRL"})
              </span>
            </div>
            <p className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
              Lançamento instantâneo de receitas e despesas na moeda do perfil
            </p>
          </div>
        </div>
        {onClose && (
          <button 
            id="close-voice-modal-btn" 
            onClick={onClose} 
            className={`p-2 rounded-full transition ${
              darkMode ? "hover:bg-slate-800 text-slate-400 hover:text-white" : "hover:bg-slate-100 text-slate-500 hover:text-slate-900"
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Frame / Iframe Warning Card if needed */}
      {isIframe && (
        <div className="p-3.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs rounded-2xl mb-4 leading-relaxed font-medium">
          <div className="flex items-start gap-2">
            <ExternalLink className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-0.5">Dica para melhor funcionamento do Microfone:</p>
              <p>Se o navegador solicitar permissão, clique em "Permitir". Se preferir, você também pode tocar nos botões de exemplos rápidos abaixo ou digitar diretamente!</p>
            </div>
          </div>
        </div>
      )}

      {/* Central Big Mic Trigger */}
      <div className="flex flex-col items-center justify-center py-4">
        <div className="relative flex items-center justify-center mb-3">
          {activeRecording && (
            <>
              <div className="absolute w-32 h-32 bg-purple-500/20 rounded-full animate-ping"></div>
              <div className="absolute w-26 h-26 bg-purple-500/30 rounded-full animate-pulse"></div>
            </>
          )}
          <button
            id="mic-action-btn"
            onClick={activeRecording ? stopListening : startListening}
            disabled={loading}
            className={`w-22 h-22 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 active:scale-95 z-10 ${
              activeRecording 
                ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/40 ring-4 ring-rose-500/20" 
                : "bg-gradient-to-b from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 text-white shadow-purple-600/35 ring-4 ring-purple-500/15"
            } disabled:opacity-50`}
          >
            {loading ? (
              <Loader2 className="w-9 h-9 animate-spin" />
            ) : activeRecording ? (
              <MicOff className="w-9 h-9 animate-pulse" />
            ) : (
              <Mic className="w-9 h-9" />
            )}
          </button>
        </div>

        <p className="text-sm font-extrabold mb-1">
          {loading 
            ? "Processando com Kathleen IA..." 
            : activeRecording 
              ? "Ouvindo... Fale seu lançamento..." 
              : "Toque no Microfone para Falar"}
        </p>
        <p className={`text-[11px] text-center max-w-[280px] font-medium ${
          darkMode ? "text-slate-400" : "text-slate-500"
        }`}>
          Ex: &quot;Recebi {activeSymbol} 1.500 do João&quot; ou &quot;Gastei {activeSymbol} 45 no almoço&quot;
        </p>
      </div>

      {/* Transcript Card */}
      {transcript && (
        <div className={`p-3.5 rounded-2xl mb-3 text-xs border font-medium flex items-center gap-2 ${
          darkMode ? "bg-slate-800/80 border-slate-700 text-purple-300" : "bg-purple-50 border-purple-100 text-purple-800"
        }`}>
          <Volume2 className="w-4 h-4 shrink-0" />
          <span className="italic truncate">"{transcript}"</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl mb-3 flex gap-2 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Success Popup */}
      {successData && (
        <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-2xl mb-4 animate-fadeIn">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-xs">
                <Check className="w-3.5 h-3.5" />
              </div>
              <span className="font-extrabold text-sm text-emerald-700 dark:text-emerald-300">
                {successData.type === "receita" ? "Receita Lançada com Sucesso!" : "Despesa Lançada com Sucesso!"}
              </span>
            </div>
            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
              successData.type === "receita" 
                ? "bg-emerald-500/20 text-emerald-400" 
                : "bg-rose-500/20 text-rose-400"
            }`}>
              {successData.type === "receita" ? "+ Entrada" : "- Saída"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs bg-white/40 dark:bg-slate-800/40 p-3 rounded-xl">
            <div>
              <span className="text-[10px] text-slate-500 block">Valor</span>
              <strong className="text-sm font-black text-slate-900 dark:text-white">
                {formatCurrency(Number(successData.amount) || 0, activeSymbol)}
              </strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Categoria</span>
              <strong className="font-bold text-slate-800 dark:text-slate-200">{successData.category}</strong>
            </div>
            <div className="col-span-2">
              <span className="text-[10px] text-slate-500 block">Descrição</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{successData.description}</span>
            </div>
          </div>
        </div>
      )}

      {/* One-Tap Preset Examples */}
      <div className="mb-4">
        <label className={`block text-[11px] font-bold mb-2 ${
          darkMode ? "text-slate-400" : "text-slate-500"
        }`}>
          Toque para lançar um exemplo rápido:
        </label>
        <div className="flex flex-wrap gap-1.5">
          {quickExamples.map((ex, idx) => (
            <button
              key={idx}
              id={`quick-example-btn-${idx}`}
              onClick={() => {
                setManualInput(ex.text);
                processCommand(ex.text);
              }}
              disabled={loading || activeRecording}
              className={`text-xs px-3 py-2 rounded-xl border font-medium transition active:scale-95 text-left flex items-center gap-1.5 ${
                ex.type === "receita"
                  ? darkMode 
                    ? "bg-emerald-950/40 border-emerald-800/60 hover:bg-emerald-900/50 text-emerald-300"
                    : "bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-800"
                  : darkMode 
                    ? "bg-rose-950/40 border-rose-800/60 hover:bg-rose-900/50 text-rose-300"
                    : "bg-rose-50 border-rose-200 hover:bg-rose-100 text-rose-800"
              } disabled:opacity-50`}
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {/* Manual / Text Input Form */}
      <form onSubmit={handleManualSubmit} className="mt-3">
        <label className={`block text-[11px] font-bold mb-1.5 ${
          darkMode ? "text-slate-400" : "text-slate-500"
        }`}>
          Ou digite o comando de voz em texto:
        </label>
        <div className="flex gap-2">
          <input
            id="voice-manual-input"
            type="text"
            placeholder="Ex: Recebi R$ 1.200 de consultoria..."
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            disabled={loading || activeRecording}
            className={`flex-1 px-3.5 py-2.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 transition ${
              darkMode 
                ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500" 
                : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
            }`}
          />
          <button
            id="voice-manual-submit-btn"
            type="submit"
            disabled={loading || activeRecording || !manualInput.trim()}
            className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 active:scale-95 text-white px-4 py-2.5 rounded-xl transition disabled:opacity-50 flex items-center justify-center font-bold text-xs shadow-md shadow-purple-600/20"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
