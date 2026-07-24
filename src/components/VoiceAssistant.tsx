import React, { useState, useEffect, useRef } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { Mic, MicOff, Send, Sparkles, Check, AlertCircle, X, Volume2, ExternalLink } from "lucide-react";
import { isDemoActive, localAddDoc } from "../utils/demoDb";

interface VoiceAssistantProps {
  darkMode: boolean;
  onTransactionAdded: () => void;
  onClose?: () => void;
}

export default function VoiceAssistant({ darkMode, onTransactionAdded, onClose }: VoiceAssistantProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isIframe, setIsIframe] = useState(false);
  
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Detect if running inside iframe
    try {
      setIsIframe(window.self !== window.top);
    } catch (e) {
      setIsIframe(true);
    }

    // Check Web Speech API support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = "pt-BR";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
        setTranscript("Ouvindo... Fale sua receita ou despesa...");
      };

      recognition.onresult = (event: any) => {
        const resultText = event.results[0][0].transcript;
        setTranscript(resultText);
        setManualInput(resultText);
        processCommand(resultText);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error === "not-allowed") {
          setError("A permissão para usar o microfone foi negada ou bloqueada pelo navegador. Se você estiver na janela de visualização, clique no botão 'Abrir em Nova Aba' no topo da tela para conceder permissão.");
        } else if (event.error === "service-not-allowed") {
          setError("O serviço de voz não foi permitido pelo navegador.");
        } else {
          setError("Erro de áudio/voz: " + event.error + ". Tente digitar sua frase abaixo.");
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      setError("Reconhecimento de voz não suportado pelo seu navegador atual. Recomendamos usar o Google Chrome ou digitar sua frase abaixo.");
    }
  }, []);

  const startListening = () => {
    if (recognitionRef.current) {
      setError(null);
      setSuccessData(null);
      try {
        recognitionRef.current.start();
      } catch (e) {
        recognitionRef.current.stop();
      }
    } else {
      setError("Microfone não inicializado. Por favor, digite o comando abaixo.");
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const processCommand = async (commandText: string) => {
    if (!commandText.trim()) return;
    setLoading(true);
    setError(null);
    setSuccessData(null);

    try {
      const response = await fetch("/api/parse-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: commandText,
          currentDate: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error("Falha ao analisar comando pelo assistente.");
      }

      const parsedData = await response.json();
      
      // Save directly to Firestore if user is logged in or Local Demo
      const isDemo = isDemoActive();
      const currentUser = isDemo ? { uid: "local-demo-user" } : auth.currentUser;
      
      if (currentUser) {
        const transactionData = {
          userId: currentUser.uid,
          type: parsedData.type,
          amount: Number(parsedData.amount) || 0,
          category: parsedData.category || "Outros",
          location: parsedData.location || null,
          client: parsedData.client || null,
          description: parsedData.description || "Lançamento por Voz",
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
        setTranscript("");
        onTransactionAdded(); // Trigger refresh on parent
      } else {
        throw new Error("Usuário não autenticado para salvar.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Não conseguimos compreender a transação. Tente falar ou digitar de forma mais direta, ex: 'gastei 15 reais no almoço'.");
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

  return (
    <div className={`p-6 rounded-[2rem] shadow-2xl border ${
      darkMode ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-100 text-slate-900"
    }`}>
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-tr from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <h3 className="font-extrabold text-lg tracking-tight">Falar com Kathleen Contadora</h3>
        </div>
        {onClose && (
          <button id="close-voice-modal-btn" onClick={onClose} className={`p-2 rounded-full transition ${
            darkMode ? "hover:bg-slate-800 text-slate-400 hover:text-white" : "hover:bg-slate-100 text-slate-500 hover:text-slate-900"
          }`}>
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Frame / Iframe Warning Card */}
      {isIframe && (
        <div className="p-3.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs rounded-2xl mb-4 leading-relaxed font-medium">
          <div className="flex items-start gap-2">
            <ExternalLink className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-0.5">Dica do Microfone:</p>
              <p>Navegadores costumam bloquear o acesso ao microfone dentro de telas de teste (iframes). Para falar com o contador perfeitamente, **clique no botão de abrir em uma nova aba** no topo superior direito da tela do AI Studio!</p>
            </div>
          </div>
        </div>
      )}

      {/* Mic Trigger */}
      <div className="flex flex-col items-center justify-center py-5">
        <div className="relative flex items-center justify-center mb-4">
          {isListening && (
            <>
              <div className="absolute w-28 h-28 bg-purple-500/20 rounded-full animate-ping"></div>
              <div className="absolute w-24 h-24 bg-purple-500/30 rounded-full animate-pulse"></div>
            </>
          )}
          <button
            id="mic-action-btn"
            onClick={isListening ? stopListening : startListening}
            className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 active:scale-90 z-10 ${
              isListening 
                ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30" 
                : "bg-gradient-to-b from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 text-white shadow-purple-600/30"
            }`}
          >
            {isListening ? (
              <MicOff className="w-8 h-8 animate-pulse" />
            ) : (
              <Mic className="w-8 h-8" />
            )}
          </button>
        </div>

        <p className="text-sm font-extrabold mb-1">
          {isListening ? "Gravando voz..." : "Toque para falar"}
        </p>
        <p className={`text-[11px] text-center max-w-[260px] font-medium ${
          darkMode ? "text-slate-400" : "text-slate-500"
        }`}>
          Fale naturalmente: "Gastei 15 dólares no café da tarde no Dunkin"
        </p>
      </div>

      {/* Transcript Log */}
      {transcript && (
        <div className={`p-4 rounded-2xl mb-4 text-sm border italic font-medium ${
          darkMode ? "bg-slate-850 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-100 text-slate-600"
        }`}>
          "{transcript}"
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl mb-4 flex gap-2 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Success Popup */}
      {successData && (
        <div className="p-5 bg-emerald-500/15 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl mb-4 animate-fadeIn">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center">
              <Check className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-sm">
              {successData.type === "receita" ? "Receita registrada!" : "Despesa registrada!"}
            </span>
          </div>
          <div className="space-y-1 text-xs">
            <p><strong className={darkMode ? "text-white" : "text-slate-800"}>Valor:</strong> ${successData.amount}</p>
            <p><strong className={darkMode ? "text-white" : "text-slate-800"}>Categoria:</strong> {successData.category}</p>
            {successData.location && (
              <p><strong className={darkMode ? "text-white" : "text-slate-800"}>Local:</strong> {successData.location}</p>
            )}
            {successData.client && (
              <p><strong className={darkMode ? "text-white" : "text-slate-800"}>Cliente:</strong> {successData.client}</p>
            )}
            <p><strong className={darkMode ? "text-white" : "text-slate-800"}>Descrição:</strong> {successData.description}</p>
            <p><strong className={darkMode ? "text-white" : "text-slate-800"}>Data:</strong> {successData.date}</p>
          </div>
        </div>
      )}

      {/* Manual Input Form */}
      <form onSubmit={handleManualSubmit} className="mt-4">
        <label className={`block text-xs font-bold mb-1.5 ${
          darkMode ? "text-slate-400" : "text-slate-500"
        }`}>
          Prefere digitar ou ajustar o comando?
        </label>
        <div className="flex gap-2">
          <input
            id="voice-manual-input"
            type="text"
            placeholder="Digite: Recebi 350 dólares de instalação..."
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            disabled={loading || isListening}
            className={`flex-1 px-4 py-3 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 transition ${
              darkMode 
                ? "bg-slate-800 border-slate-700 text-white focus:border-purple-500" 
                : "bg-slate-50 border-slate-200 text-slate-900 focus:border-purple-500"
            }`}
          />
          <button
            id="voice-manual-submit-btn"
            type="submit"
            disabled={loading || isListening || !manualInput.trim()}
            className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 active:scale-95 text-white p-3 rounded-xl transition disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Tips */}
      <div className={`mt-5 pt-4 border-t flex gap-2 text-[10px] leading-relaxed ${
        darkMode ? "border-slate-800 text-slate-500" : "border-slate-100 text-slate-400"
      }`}>
        <Volume2 className="w-4 h-4 shrink-0" />
        <div>
          <strong>Exemplos rápidos:</strong>
          <br />"Recebi 350 dólares de instalação de câmera"
          <br />"Despesa de 15 dólares no Dunkin hoje"
        </div>
      </div>
    </div>
  );
}
