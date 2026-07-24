import React, { useState, useRef } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { Camera, Upload, Check, AlertCircle, RefreshCw, X, FileText } from "lucide-react";
import { isDemoActive, localAddDoc } from "../utils/demoDb";

interface ReceiptScannerProps {
  darkMode: boolean;
  onTransactionAdded: () => void;
  onClose?: () => void;
}

export default function ReceiptScanner({ darkMode, onTransactionAdded, onClose }: ReceiptScannerProps) {
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccessData(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.onerror = () => {
      setError("Falha ao ler o arquivo selecionado.");
    };
    reader.readAsDataURL(file);
  };

  const handleScan = async () => {
    if (!imagePreview) {
      setError("Por favor, selecione ou tire uma foto de um recibo primeiro.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: imagePreview })
      });

      if (!response.ok) {
        throw new Error("Não foi possível analisar o recibo com o Gemini.");
      }

      const parsedData = await response.json();

      // Save directly to Firestore or Local storage as a 'despesa'
      const isDemo = isDemoActive();
      const currentUser = isDemo ? { uid: "local-demo-user" } : auth.currentUser;
      
      if (currentUser) {
        const transactionData = {
          userId: currentUser.uid,
          type: "despesa",
          amount: Number(parsedData.amount) || 0,
          category: parsedData.category || "Compras",
          location: parsedData.location || "Recibo Escaneado",
          client: null,
          description: parsedData.description || "Escaneamento de Recibo",
          date: parsedData.date || new Date().toISOString().split("T")[0],
          isRecurrent: false,
          receiptImage: imagePreview, // Save base64 for offline image display!
          createdAt: new Date().toISOString()
        };

        if (isDemo) {
          await localAddDoc("transactions", transactionData);
        } else {
          await addDoc(collection(db, "transactions"), transactionData);
        }

        setSuccessData(parsedData);
        setImagePreview(null);
        onTransactionAdded();
      } else {
        throw new Error("Usuário não autenticado para salvar.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Falha ao escanear. Certifique-se de que a imagem está legível.");
    } finally {
      setLoading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`p-6 rounded-3xl ${
      darkMode ? "bg-zinc-900 text-white" : "bg-white text-gray-900"
    }`}>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-600 rounded-xl flex items-center justify-center">
            <Camera className="w-4 h-4 text-white" />
          </div>
          <h3 className="font-bold text-lg">Escanear Recibo IA</h3>
        </div>
        {onClose && (
          <button id="close-scan-modal-btn" onClick={onClose} className={`p-1.5 rounded-full transition ${
            darkMode ? "hover:bg-zinc-800" : "hover:bg-gray-100"
          }`}>
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <p className={`text-xs mb-4 ${darkMode ? "text-zinc-400" : "text-gray-500"}`}>
        Tire uma foto ou suba a imagem de uma nota fiscal ou recibo. A IA da Kathleen Contadora vai ler o valor, data e local e cadastrar automaticamente!
      </p>

      {/* Upload area */}
      <div className="flex flex-col items-center justify-center">
        <input
          id="receipt-file-input"
          type="file"
          accept="image/*"
          capture="environment" // Forces back camera on mobile smartphones!
          onChange={handleImageUpload}
          ref={fileInputRef}
          className="hidden"
        />

        {!imagePreview && !successData && (
          <button
            id="receipt-upload-trigger-btn"
            onClick={triggerFileInput}
            className={`w-full py-10 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 transition cursor-pointer active:scale-95 ${
              darkMode 
                ? "border-zinc-800 hover:border-purple-500/50 hover:bg-zinc-850 bg-zinc-950" 
                : "border-gray-200 hover:border-purple-600/50 hover:bg-purple-50/10 bg-gray-50/50"
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-purple-600/10 flex items-center justify-center text-purple-600">
              <Camera className="w-6 h-6" />
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold">Tirar foto ou anexar recibo</p>
              <p className={`text-[10px] mt-0.5 ${darkMode ? "text-zinc-500" : "text-gray-400"}`}>
                Suporta câmera do celular e arquivos de imagem
              </p>
            </div>
          </button>
        )}

        {imagePreview && (
          <div className="w-full">
            <div className="relative rounded-2xl overflow-hidden border border-zinc-700/20 mb-4 bg-black max-h-[220px] flex items-center justify-center">
              <img src={imagePreview} alt="Recibo" className="object-contain max-h-[220px] w-auto" />
              <button
                id="remove-preview-btn"
                onClick={() => setImagePreview(null)}
                className="absolute top-2 right-2 bg-black/60 hover:bg-black text-white p-1 rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2">
              <button
                id="reselect-image-btn"
                onClick={triggerFileInput}
                className={`flex-1 py-3 px-4 text-xs font-bold rounded-xl border flex items-center justify-center gap-2 transition ${
                  darkMode 
                    ? "border-zinc-800 text-zinc-300 hover:bg-zinc-800" 
                    : "border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refazer Foto
              </button>
              <button
                id="start-scan-btn"
                onClick={handleScan}
                disabled={loading}
                className="flex-1 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white py-3 px-4 text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 transition disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Analisando com IA...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Confirmar e Ler Recibo
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-2xl mt-4 flex gap-2 animate-bounce">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Success Popup */}
      {successData && (
        <div className="p-5 bg-emerald-500/15 border border-emerald-500/20 text-emerald-500 rounded-2xl mt-4 animate-fadeIn">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center">
              <Check className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-sm">Recibo Cadastrado com Sucesso!</span>
          </div>
          <div className="space-y-1 text-xs">
            <p><strong className={darkMode ? "text-white" : "text-gray-800"}>Valor:</strong> ${successData.amount}</p>
            <p><strong className={darkMode ? "text-white" : "text-gray-800"}>Categoria:</strong> {successData.category}</p>
            {successData.location && (
              <p><strong className={darkMode ? "text-white" : "text-gray-800"}>Local:</strong> {successData.location}</p>
            )}
            <p><strong className={darkMode ? "text-white" : "text-gray-800"}>Descrição:</strong> {successData.description}</p>
            <p><strong className={darkMode ? "text-white" : "text-gray-800"}>Data:</strong> {successData.date}</p>
          </div>
          <button
            id="scan-another-btn"
            onClick={() => setSuccessData(null)}
            className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-3 text-xs font-semibold rounded-xl transition"
          >
            Escanear Outro Recibo
          </button>
        </div>
      )}
    </div>
  );
}
