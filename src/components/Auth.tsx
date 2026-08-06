import React, { useState } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInAnonymously,
  updateProfile
} from "firebase/auth";
import { auth } from "../firebase";
import { Wallet, ShieldAlert, Sparkles, User, Lock, Mail, ChevronRight } from "lucide-react";

interface AuthProps {
  darkMode: boolean;
  onDemoLogin?: () => void;
}

export default function Auth({ darkMode, onDemoLogin }: AuthProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegistering) {
        if (!name.trim()) {
          throw new Error("Por favor, insira o seu nome.");
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.warn("Auth error:", err.message || err);
      let errorMsg = "Ocorreu um erro ao autenticar.";
      if (err.code === "auth/invalid-credential") {
        errorMsg = "E-mail ou senha incorretos. Por favor, verifique seus dados ou cadastre-se.";
      } else if (err.code === "auth/email-already-in-use") {
        errorMsg = "Este e-mail já está cadastrado. Tente fazer login ou use outro e-mail.";
      } else if (err.code === "auth/weak-password") {
        errorMsg = "A senha deve conter no mínimo 6 caracteres.";
      } else if (err.code === "auth/operation-not-allowed") {
        errorMsg = "O método de login por E-mail e Senha não está ativado no Console do Firebase. Ative-o em 'Authentication > Sign-in method' ou use o botão verde 'Acessar sem Login (Demonstração Local)' abaixo.";
      } else if (err.code === "auth/unauthorized-domain") {
        errorMsg = `Este domínio (${window.location.hostname}) não está autorizado no Console do Firebase.\n\nPara resolver:\n1. Acesse o Console do Firebase\n2. Vá em Authentication > Configurações > Domínios Autorizados\n3. Adicione o domínio "${window.location.hostname}"`;
      } else if (err.message) {
        errorMsg = err.message;
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const userCredential = await signInAnonymously(auth);
      await updateProfile(userCredential.user, { displayName: "Visitante" });
    } catch (err: any) {
      console.warn("Guest Auth error:", err.message || err);
      let errorMsg = "Falha ao entrar como convidado.";
      if (err.code === "auth/operation-not-allowed") {
        errorMsg = "O Login de Convidado (Anônimo) não está ativado no Console do Firebase. Ative-o em 'Authentication > Sign-in method' > 'Anônimo' ou use o botão verde 'Acessar sem Login (Demonstração Local)'.";
      } else if (err.code === "auth/unauthorized-domain") {
        errorMsg = `Este domínio (${window.location.hostname}) não está autorizado no Console do Firebase. Adicione o domínio "${window.location.hostname}" em Authentication > Configurações > Domínios Autorizados.`;
      } else if (err.message) {
        errorMsg += ": " + err.message;
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-full flex flex-col justify-between p-6 gap-6 ${
      darkMode ? "bg-[#0F172A] text-slate-100" : "bg-[#F8FAFC] text-slate-900"
    }`}>
      {/* Header */}
      <div className="flex flex-col items-center justify-center pt-12 pb-6">
        <div className="w-16 h-16 bg-gradient-to-tr from-purple-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-lg shadow-purple-500/30 mb-4 animate-pulse">
          <Wallet className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 to-purple-500 bg-clip-text text-transparent">Kathleen Contadora</h1>
        <p className={`text-xs mt-1.5 text-center max-w-[280px] font-medium ${
          darkMode ? "text-slate-400" : "text-slate-500"
        }`}>
          Seu assistente financeiro inteligente controlado por voz e PWA completo
        </p>
      </div>

      {/* Main Login Card */}
      <div className={`w-full max-w-sm mx-auto p-6 rounded-[2rem] shadow-2xl border ${
        darkMode 
          ? "bg-slate-900/80 border-slate-800 text-white backdrop-blur-md" 
          : "bg-white border-slate-100 text-slate-950"
      }`}>
        <h2 className="text-xl font-bold mb-6 tracking-tight">
          {isRegistering ? "Crie sua conta gratuita" : "Acesse sua conta"}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl flex items-start gap-2 animate-bounce">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {isRegistering && (
            <div className="relative">
              <User className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${
                darkMode ? "text-slate-500" : "text-slate-400"
              }`} />
              <input
                id="auth-name"
                type="text"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={`w-full pl-10 pr-4 py-3 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 transition ${
                  darkMode 
                    ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-purple-500" 
                    : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-purple-500"
                }`}
              />
            </div>
          )}

          <div className="relative">
            <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${
              darkMode ? "text-slate-500" : "text-slate-400"
            }`} />
            <input
              id="auth-email"
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={`w-full pl-10 pr-4 py-3 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 transition ${
                darkMode 
                  ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-purple-500" 
                  : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-purple-500"
              }`}
            />
          </div>

          <div className="relative">
            <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${
              darkMode ? "text-slate-500" : "text-slate-400"
            }`} />
            <input
              id="auth-password"
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={`w-full pl-10 pr-4 py-3 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 transition ${
                darkMode 
                  ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-purple-500" 
                  : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-purple-500"
              }`}
            />
          </div>

          <button
            id="auth-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 active:scale-95 text-white py-3 px-4 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 transition disabled:opacity-50"
          >
            {loading ? "Processando..." : isRegistering ? "Criar Conta" : "Entrar com E-mail"}
            <ChevronRight className="w-4 h-4" />
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className={`w-full border-t ${darkMode ? "border-slate-800" : "border-slate-200"}`}></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className={`px-2 text-[10px] tracking-wider ${
              darkMode ? "bg-slate-900 text-slate-500" : "bg-white text-slate-400"
            }`}>OU</span>
          </div>
        </div>

        {/* Local Demo Entry (Saves to LocalStorage - perfect for quick access without Firebase issues) */}
        <button
          id="auth-local-demo-btn"
          type="button"
          onClick={() => {
            if (onDemoLogin) {
              onDemoLogin();
            }
          }}
          className="w-full py-3 px-4 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-95 text-white shadow-md shadow-emerald-500/15 transition duration-150 mb-3"
        >
          <Sparkles className="w-4 h-4 text-white animate-bounce" />
          Acessar sem Login (Demonstração Local)
        </button>

        {/* Demo Fast Entry */}
        <button
          id="auth-guest-btn"
          type="button"
          onClick={handleGuestLogin}
          disabled={loading}
          className={`w-full py-3 px-4 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 border border-dashed transition active:scale-95 ${
            darkMode 
              ? "border-slate-700 text-slate-300 hover:bg-slate-800" 
              : "border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          Entrar como Convidado (Firebase)
        </button>

        <p className="text-center text-xs mt-6">
          <button
            id="auth-toggle-mode-btn"
            type="button"
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-purple-600 font-semibold hover:underline"
          >
            {isRegistering ? "Já tem conta? Faça Login" : "Não tem conta? Cadastre-se"}
          </button>
        </p>
      </div>

      {/* Footer / Info */}
      <div className={`text-center text-[10px] py-4 ${
        darkMode ? "text-slate-500" : "text-slate-400"
      }`}>
        Segurança integrada com Firebase e Inteligência Artificial Google Gemini
      </div>
    </div>
  );
}
