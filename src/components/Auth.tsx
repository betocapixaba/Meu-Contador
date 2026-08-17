import React, { useState } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  sendPasswordResetEmail
} from "firebase/auth";
import { auth } from "../firebase";
import { Wallet, ShieldAlert, Sparkles, User, Lock, Mail, ChevronRight, KeyRound, CheckCircle2, ArrowLeft } from "lucide-react";

interface AuthProps {
  darkMode: boolean;
  onDemoLogin?: () => void;
}

export default function Auth({ darkMode, onDemoLogin }: AuthProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetSuccess(null);

    if (!email.trim()) {
      setError("Por favor, digite o seu e-mail cadastrado.");
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetSuccess(`E-mail de redefinição enviado para ${email}! Verifique sua caixa de entrada e a pasta de spam.`);
    } catch (err: any) {
      console.warn("Password reset error:", err.message || err);
      let errorMsg = "Ocorreu um erro ao enviar o e-mail de recuperação.";
      if (err.code === "auth/user-not-found") {
        errorMsg = "Nenhuma conta cadastrada com este e-mail. Verifique a digitação ou crie uma nova conta.";
      } else if (err.code === "auth/invalid-email") {
        errorMsg = "E-mail inválido. Digite um e-mail correto.";
      } else if (err.code === "auth/missing-email") {
        errorMsg = "Por favor, informe um endereço de e-mail válido.";
      } else if (err.message) {
        errorMsg = err.message;
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

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
        await updateProfile(userCredential.user, { displayName: name.trim() });
        localStorage.setItem("contador_ia_demo_display_name", name.trim());
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (userCredential.user.displayName) {
          localStorage.setItem("contador_ia_demo_display_name", userCredential.user.displayName);
        }
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
        {isResettingPassword ? (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <button
                type="button"
                onClick={() => {
                  setIsResettingPassword(false);
                  setError(null);
                  setResetSuccess(null);
                }}
                className={`p-1.5 rounded-lg transition ${
                  darkMode ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-600"
                }`}
                title="Voltar ao login"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-purple-500" />
                Recuperar Senha
              </h2>
            </div>

            <p className={`text-xs mb-4 leading-relaxed ${
              darkMode ? "text-slate-400" : "text-slate-600"
            }`}>
              Digite o e-mail cadastrado em sua conta para receber um link de redefinição de senha com segurança.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl flex items-start gap-2 animate-bounce">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {resetSuccess && (
              <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{resetSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="relative">
                <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${
                  darkMode ? "text-slate-500" : "text-slate-400"
                }`} />
                <input
                  id="auth-reset-email"
                  type="email"
                  placeholder="Seu e-mail cadastrado"
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

              <button
                id="auth-reset-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 active:scale-95 text-white py-3 px-4 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 transition disabled:opacity-50"
              >
                {loading ? "Enviando..." : "Enviar E-mail de Recuperação"}
                <ChevronRight className="w-4 h-4" />
              </button>
            </form>

            <button
              id="auth-back-to-login-btn"
              type="button"
              onClick={() => {
                setIsResettingPassword(false);
                setError(null);
                setResetSuccess(null);
              }}
              className="w-full mt-4 text-center text-xs text-purple-600 font-semibold hover:underline"
            >
              Voltar ao Login
            </button>
          </div>
        ) : (
          <>
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

              {!isRegistering && (
                <div className="flex justify-end pt-0.5">
                  <button
                    id="auth-forgot-password-btn"
                    type="button"
                    onClick={() => {
                      setIsResettingPassword(true);
                      setError(null);
                      setResetSuccess(null);
                    }}
                    className="text-xs text-purple-600 font-medium hover:underline flex items-center gap-1"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Esqueceu a senha?
                  </button>
                </div>
              )}

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

            <p className="text-center text-xs mt-6">
              <button
                id="auth-toggle-mode-btn"
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setError(null);
                }}
                className="text-purple-600 font-semibold hover:underline"
              >
                {isRegistering ? "Já tem conta? Faça Login" : "Não tem conta? Cadastre-se"}
              </button>
            </p>
          </>
        )}
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
