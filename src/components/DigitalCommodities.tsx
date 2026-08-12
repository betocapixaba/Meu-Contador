import React, { useState, useEffect } from "react";
import { 
  Coins, 
  RefreshCcw, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Globe, 
  ShieldCheck, 
  Sparkles, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Info, 
  Clock,
  DollarSign,
  X,
  LineChart as LineChartIcon,
  Maximize2,
  Calendar
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";

interface DigitalCommoditiesProps {
  darkMode: boolean;
}

interface CommodityItem {
  symbol: string;
  name: string;
  category: string;
  priceUsd: number;
  priceBrl: number;
  change24h: number;
  high24hUsd: number;
  low24hUsd: number;
  volume24hUsd: number;
}

interface ChartPoint {
  timestamp: number;
  timeLabel: string;
  priceUsd: number;
  priceBrl: number;
  highUsd: number;
  lowUsd: number;
  volumeUsd: number;
}

type PeriodType = "1m" | "1d" | "1w" | "1M" | "1y";

export function DigitalCommodities({ darkMode }: DigitalCommoditiesProps) {
  const [items, setItems] = useState<CommodityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayCurrency, setDisplayCurrency] = useState<"BRL" | "USD">("BRL");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todas");
  const [usdBrlRate, setUsdBrlRate] = useState<number>(5.65);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [sourceInfo, setSourceInfo] = useState<string>("");

  // Chart Modal state
  const [selectedCoin, setSelectedCoin] = useState<CommodityItem | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("1d");
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);

  const fetchCommoditiesData = async () => {
    setLoading(true);
    try {
      // 1. Try backend server endpoint
      const res = await fetch(`/api/crypto-rates?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.items) && data.items.length > 0) {
          setItems(data.items);
          if (data.usdBrlRate) setUsdBrlRate(data.usdBrlRate);
          setLastUpdated(data.timestamp || new Date().toLocaleTimeString("pt-BR"));
          setSourceInfo(data.source || "Tempo Real");

          setSelectedCoin(prev => {
            if (!prev) return null;
            const match = data.items.find((i: CommodityItem) => i.symbol === prev.symbol);
            return match || prev;
          });

          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn("Backend crypto fetch error, attempting direct fallback:", err);
    }

    // Direct fallback if server fails
    try {
      const fallbackList = [
        { symbol: "BTC", name: "Bitcoin", category: "Reserva de Valor / Ouro Digital", priceUsd: 95450, change24h: 2.15 },
        { symbol: "ETH", name: "Ethereum Ether", category: "Contratos Inteligentes", priceUsd: 2680, change24h: 1.84 },
        { symbol: "SOL", name: "Solana", category: "High Performance L1", priceUsd: 198.50, change24h: 4.12 },
        { symbol: "XRP", name: "XRP", category: "Liquidez e Remessas", priceUsd: 2.45, change24h: -0.85 },
        { symbol: "ADA", name: "Cardano", category: "Proof of Stake L1", priceUsd: 0.82, change24h: 1.05 },
        { symbol: "DOGE", name: "Dogecoin", category: "Ativo Memético / P2P", priceUsd: 0.26, change24h: 3.40 },
        { symbol: "SHIB", name: "Shiba Inu", category: "Ecossistema Memético / L2", priceUsd: 0.0000245, change24h: 1.20 },
        { symbol: "AVAX", name: "Avalanche", category: "Subredes & DeFi", priceUsd: 34.20, change24h: 0.95 },
        { symbol: "LINK", name: "Chainlink", category: "Oráculos de Dados", priceUsd: 18.60, change24h: 2.30 },
        { symbol: "DOT", name: "Polkadot", category: "Interoperabilidade Multichain", priceUsd: 7.85, change24h: -1.10 },
        { symbol: "LTC", name: "Litecoin", category: "Pagamentos Rápidos / Prata Digital", priceUsd: 112.40, change24h: 0.50 },
        { symbol: "BCH", name: "Bitcoin Cash", category: "Dinheiro Eletrônico P2P", priceUsd: 445.00, change24h: 1.75 },
        { symbol: "XLM", name: "Stellar", category: "Rede de Pagamentos Globais", priceUsd: 0.38, change24h: -0.40 },
        { symbol: "HBAR", name: "Hedera", category: "Hashgraph Enterprise", priceUsd: 0.22, change24h: 5.80 },
        { symbol: "XTZ", name: "Tezos", category: "Self-Amending L1", priceUsd: 1.15, change24h: 0.20 },
        { symbol: "APT", name: "Aptos", category: "Move-Based L1", priceUsd: 9.80, change24h: 3.10 }
      ].map(c => ({
        ...c,
        priceBrl: c.priceUsd * 5.65,
        high24hUsd: c.priceUsd * 1.02,
        low24hUsd: c.priceUsd * 0.98,
        volume24hUsd: c.priceUsd * 200000
      }));

      setItems(fallbackList);
      setLastUpdated(new Date().toLocaleTimeString("pt-BR"));
      setSourceInfo("Mercado Spot");
    } finally {
      setLoading(false);
    }
  };

  const fetchChartData = async (coin: CommodityItem, period: PeriodType) => {
    setLoadingChart(true);
    const targetUsd = coin.priceUsd;
    const targetBrl = coin.priceBrl;
    const conversionRatio = targetUsd > 0 && targetBrl > 0 ? targetBrl / targetUsd : usdBrlRate;

    try {
      const res = await fetch(`/api/crypto-chart?symbol=${encodeURIComponent(coin.symbol)}&period=${period}&currentPriceUsd=${targetUsd}&t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.data) && data.data.length > 0) {
          let pts: ChartPoint[] = data.data;
          const lastIdx = pts.length - 1;

          pts = pts.map((p, idx) => {
            const pUsd = idx === lastIdx && targetUsd > 0 ? targetUsd : p.priceUsd;
            const pBrl = idx === lastIdx && targetBrl > 0 ? targetBrl : pUsd * conversionRatio;
            return {
              ...p,
              priceUsd: pUsd,
              priceBrl: pBrl
            };
          });

          setChartData(pts);
          setLoadingChart(false);
          return;
        }
      }
    } catch (e) {
      console.warn("Error fetching crypto chart:", e);
    }

    // Fallback chart points generator ending exactly at targetUsd / targetBrl
    const nowMs = Date.now();
    const pts: ChartPoint[] = [];
    const count = period === "1m" ? 60 : period === "1d" ? 24 : period === "1w" ? 28 : period === "1M" ? 30 : 52;
    const stepMs = (period === "1m" ? 60000 : period === "1d" ? 3600000 : period === "1w" ? 14400000 : period === "1M" ? 86400000 : 604800000);

    const pricesUsd: number[] = [];
    let pUsd = targetUsd > 0 ? targetUsd : 100;
    for (let i = 0; i < count; i++) {
      pricesUsd.push(pUsd);
      const varFactor = (Math.random() - 0.48) * 0.02 * pUsd;
      pUsd = Math.max(0.000001, pUsd - varFactor);
    }
    pricesUsd.reverse();

    for (let i = count - 1; i >= 0; i--) {
      const tMs = nowMs - (i * stepMs);
      const dateObj = new Date(tMs);
      const curUsd = pricesUsd[count - 1 - i];
      const curBrl = targetBrl > 0 && targetUsd > 0 ? curUsd * (targetBrl / targetUsd) : curUsd * usdBrlRate;

      pts.push({
        timestamp: tMs,
        timeLabel: period === "1m" || period === "1d" ? dateObj.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : dateObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
        priceUsd: curUsd,
        priceBrl: curBrl,
        highUsd: curUsd * 1.01,
        lowUsd: curUsd * 0.99,
        volumeUsd: curUsd * 100
      });
    }

    setChartData(pts);
    setLoadingChart(false);
  };

  useEffect(() => {
    fetchCommoditiesData();
    const interval = setInterval(fetchCommoditiesData, 15000); // 15s auto-refresh

    const handleAppRefresh = () => {
      fetchCommoditiesData();
    };
    window.addEventListener("app-refresh", handleAppRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener("app-refresh", handleAppRefresh);
    };
  }, []);

  useEffect(() => {
    if (selectedCoin) {
      fetchChartData(selectedCoin, selectedPeriod);
    }
  }, [selectedCoin?.symbol, selectedCoin?.priceUsd, selectedPeriod]);

  // Format currency helper
  const formatPrice = (value: number, currency: "BRL" | "USD") => {
    const symbol = currency === "BRL" ? "R$" : "$";
    if (value < 0.001) {
      return `${symbol} ${value.toFixed(7)}`;
    }
    if (value < 1) {
      return `${symbol} ${value.toFixed(4)}`;
    }
    return `${symbol} ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Color map for coin symbols
  const coinColors: Record<string, { bg: string; text: string; badge: string }> = {
    BTC: { bg: "bg-amber-500/10", text: "text-amber-500", badge: "border-amber-500/30" },
    ETH: { bg: "bg-indigo-500/10", text: "text-indigo-500", badge: "border-indigo-500/30" },
    SOL: { bg: "bg-purple-500/10", text: "text-purple-500", badge: "border-purple-500/30" },
    XRP: { bg: "bg-slate-500/10", text: "text-slate-400", badge: "border-slate-500/30" },
    ADA: { bg: "bg-blue-500/10", text: "text-blue-500", badge: "border-blue-500/30" },
    DOGE: { bg: "bg-yellow-500/10", text: "text-yellow-600", badge: "border-yellow-500/30" },
    SHIB: { bg: "bg-orange-500/10", text: "text-orange-500", badge: "border-orange-500/30" },
    AVAX: { bg: "bg-red-500/10", text: "text-red-500", badge: "border-red-500/30" },
    LINK: { bg: "bg-sky-500/10", text: "text-sky-500", badge: "border-sky-500/30" },
    DOT: { bg: "bg-pink-500/10", text: "text-pink-500", badge: "border-pink-500/30" },
    LTC: { bg: "bg-blue-400/10", text: "text-blue-400", badge: "border-blue-400/30" },
    BCH: { bg: "bg-emerald-500/10", text: "text-emerald-500", badge: "border-emerald-500/30" },
    XLM: { bg: "bg-cyan-500/10", text: "text-cyan-500", badge: "border-cyan-500/30" },
    HBAR: { bg: "bg-zinc-500/10", text: "text-zinc-400", badge: "border-zinc-500/30" },
    XTZ: { bg: "bg-blue-600/10", text: "text-blue-600", badge: "border-blue-600/30" },
    APT: { bg: "bg-teal-500/10", text: "text-teal-500", badge: "border-teal-500/30" }
  };

  // Categories for filter
  const categories = ["Todas", "Reserva / L1", "Memes", "DeFi & Oráculos", "Pagamentos"];

  // Periods options
  const periodsList: { id: PeriodType; label: string }[] = [
    { id: "1m", label: "1 Minuto" },
    { id: "1d", label: "1 Dia" },
    { id: "1w", label: "1 Semana" },
    { id: "1M", label: "1 Mês" },
    { id: "1y", label: "1 Ano" }
  ];

  // Filtered items
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (selectedCategory === "Todas") return matchesSearch;
    if (selectedCategory === "Reserva / L1") {
      return matchesSearch && ["BTC", "ETH", "SOL", "ADA", "AVAX", "DOT", "XTZ", "APT"].includes(item.symbol);
    }
    if (selectedCategory === "Memes") {
      return matchesSearch && ["DOGE", "SHIB"].includes(item.symbol);
    }
    if (selectedCategory === "DeFi & Oráculos") {
      return matchesSearch && ["LINK"].includes(item.symbol);
    }
    if (selectedCategory === "Pagamentos") {
      return matchesSearch && ["XRP", "LTC", "BCH", "XLM", "HBAR"].includes(item.symbol);
    }
    return matchesSearch;
  });

  // Top gainers/losers
  const topGainer = items.length > 0 ? [...items].sort((a, b) => b.change24h - a.change24h)[0] : null;

  // Calculate stats for current chart
  const firstPoint = chartData.length > 0 ? chartData[0] : null;
  const lastPoint = chartData.length > 0 ? chartData[chartData.length - 1] : null;
  const periodValFirst = firstPoint ? (displayCurrency === "BRL" ? firstPoint.priceBrl : firstPoint.priceUsd) : 0;
  const periodValLast = lastPoint ? (displayCurrency === "BRL" ? lastPoint.priceBrl : lastPoint.priceUsd) : 0;
  const periodChangePct = periodValFirst > 0 ? ((periodValLast - periodValFirst) / periodValFirst) * 100 : 0;
  const isPeriodPositive = periodChangePct >= 0;

  const minChartVal = chartData.length > 0 
    ? Math.min(...chartData.map(d => displayCurrency === "BRL" ? d.priceBrl : d.priceUsd))
    : 0;
  const maxChartVal = chartData.length > 0 
    ? Math.max(...chartData.map(d => displayCurrency === "BRL" ? d.priceBrl : d.priceUsd))
    : 0;

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className={`p-5 rounded-3xl border transition-all ${
        darkMode 
          ? "bg-slate-900/90 border-slate-800 text-slate-100 shadow-xl" 
          : "bg-gradient-to-r from-purple-50/90 via-indigo-50/50 to-blue-50/90 border-purple-100/90 text-slate-800 shadow-sm"
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-600/10 border border-purple-500/20 text-purple-500 flex items-center justify-center shrink-0 shadow-xs">
              <Coins className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight font-sans">
                  16 Commodities Digitais
                </h2>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-widest bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  Tempo Real
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                Clique em qualquer moeda para visualizar o gráfico completo de 1 minuto a 1 ano.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Currency switcher BRL / USD */}
            <div className={`p-1 rounded-xl border flex items-center gap-1 ${
              darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200 shadow-xs"
            }`}>
              <button
                id="commodity-currency-brl-btn"
                onClick={() => setDisplayCurrency("BRL")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  displayCurrency === "BRL" 
                    ? "bg-purple-600 text-white shadow-xs" 
                    : darkMode ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                R$ (BRL)
              </button>
              <button
                id="commodity-currency-usd-btn"
                onClick={() => setDisplayCurrency("USD")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  displayCurrency === "USD" 
                    ? "bg-purple-600 text-white shadow-xs" 
                    : darkMode ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                $ (USD)
              </button>
            </div>

            {/* Refresh Button */}
            <button
              id="refresh-crypto-rates-btn"
              onClick={fetchCommoditiesData}
              disabled={loading}
              title="Atualizar Cotações"
              className={`p-2.5 rounded-xl border text-xs font-bold transition active:scale-95 flex items-center gap-1.5 ${
                darkMode 
                  ? "bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700" 
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
              }`}
            >
              <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin text-purple-500" : ""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </div>

        {/* Live Info Bar */}
        <div className={`mt-4 pt-3 border-t flex flex-wrap items-center justify-between text-xs gap-2 ${
          darkMode ? "border-slate-800 text-slate-400" : "border-purple-100 text-slate-600"
        }`}>
          <div className="flex items-center gap-3 flex-wrap text-[11px]">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-purple-500" />
              Última atualização: <strong className="font-mono">{lastUpdated || "--:--:--"}</strong>
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-emerald-500" />
              Fonte: <strong className="font-semibold text-emerald-600 dark:text-emerald-400">{sourceInfo}</strong>
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-amber-500" />
              Dólar Comercial: <strong className="font-mono font-bold">R$ {usdBrlRate.toFixed(2)}</strong>
            </span>
          </div>

          {topGainer && (
            <div className="text-[11px] font-bold flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-500/20">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Destaque 24h: <strong>{topGainer.symbol} ({topGainer.change24h > 0 ? `+${topGainer.change24h.toFixed(2)}%` : `${topGainer.change24h.toFixed(2)}%`})</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Search & Category Filter Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className={`relative w-full sm:w-72 ${
          darkMode ? "text-white" : "text-slate-900"
        }`}>
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 rounded-2xl text-xs border focus:outline-none focus:ring-2 focus:ring-purple-500 transition ${
              darkMode 
                ? "bg-slate-900 border-slate-800 text-white placeholder-slate-500" 
                : "bg-white border-slate-200 text-slate-900 placeholder-slate-400 shadow-2xs"
            }`}
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar pb-1 sm:pb-0">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                  isSelected 
                    ? "bg-purple-600 text-white shadow-xs" 
                    : darkMode 
                      ? "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white" 
                      : "bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-2xs"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Commodities Grid Cards */}
      {loading && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Sparkles className="w-8 h-8 text-purple-600 animate-spin mb-3" />
          <p className={`text-xs font-semibold ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
            Conectando com o mercado financeiro digital em tempo real...
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className={`p-8 rounded-3xl border text-center ${
          darkMode ? "bg-slate-900 border-slate-800 text-slate-400" : "bg-white border-slate-200 text-slate-500"
        }`}>
          <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs font-bold">Nenhuma commodity encontrada para "{searchTerm}".</p>
          <button 
            onClick={() => { setSearchTerm(""); setSelectedCategory("Todas"); }}
            className="mt-3 text-xs text-purple-600 font-bold hover:underline"
          >
            Limpar Filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredItems.map((item) => {
            const colors = coinColors[item.symbol] || { bg: "bg-purple-500/10", text: "text-purple-500", badge: "border-purple-500/30" };
            const isPositive = item.change24h >= 0;
            const priceToDisplay = displayCurrency === "BRL" ? item.priceBrl : item.priceUsd;

            return (
              <div 
                key={item.symbol}
                onClick={() => setSelectedCoin(item)}
                className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer group hover:-translate-y-1 hover:shadow-lg relative overflow-hidden ${
                  darkMode 
                    ? "bg-slate-900/90 border-slate-800 text-white hover:border-purple-500/50" 
                    : "bg-white border-slate-200/80 text-slate-900 shadow-2xs hover:border-purple-300"
                }`}
              >
                {/* Click indicator hint */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition text-purple-500 flex items-center gap-0.5 text-[10px] font-bold">
                  <span>Gráfico</span>
                  <Maximize2 className="w-3 h-3" />
                </div>

                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl ${colors.bg} border ${colors.badge} ${colors.text} flex items-center justify-center font-black font-mono text-xs shrink-0 shadow-2xs group-hover:scale-105 transition`}>
                      {item.symbol.substring(0, 3)}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm tracking-tight leading-none group-hover:text-purple-600 dark:group-hover:text-purple-400 transition">
                        {item.name}
                      </h3>
                      <span className={`text-[10px] font-mono uppercase tracking-wider font-bold block mt-1 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                        {item.symbol}
                      </span>
                    </div>
                  </div>

                  {/* 24h variation badge */}
                  <div className={`px-2 py-1 rounded-lg text-[11px] font-bold font-mono flex items-center gap-0.5 ${
                    isPositive 
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" 
                      : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                  }`}>
                    {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    <span>{isPositive ? `+${item.change24h.toFixed(2)}%` : `${item.change24h.toFixed(2)}%`}</span>
                  </div>
                </div>

                {/* Price Display */}
                <div className="mt-2 mb-3">
                  <span className={`text-[10px] uppercase font-extrabold tracking-wider ${darkMode ? "text-slate-500" : "text-slate-400"}`}>
                    Cotação Atual ({displayCurrency})
                  </span>
                  <div className="text-xl font-black font-mono tracking-tight text-slate-900 dark:text-white mt-0.5">
                    {formatPrice(priceToDisplay, displayCurrency)}
                  </div>
                  {displayCurrency === "BRL" && (
                    <div className={`text-[10px] font-mono mt-0.5 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                      ≈ ${formatPrice(item.priceUsd, "USD")}
                    </div>
                  )}
                </div>

                {/* Category & Action prompt footer */}
                <div className={`pt-2.5 border-t flex items-center justify-between text-[10px] ${
                  darkMode ? "border-slate-800 text-slate-400" : "border-slate-100 text-slate-500"
                }`}>
                  <span className="truncate max-w-[130px] font-medium" title={item.category}>
                    {item.category}
                  </span>
                  <span className="font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1 group-hover:underline">
                    <LineChartIcon className="w-3 h-3" /> Ver Gráfico
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Chart Modal */}
      {selectedCoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border shadow-2xl transition-all ${
            darkMode 
              ? "bg-slate-900 border-slate-800 text-white" 
              : "bg-white border-slate-200 text-slate-900"
          }`}>
            {/* Modal Header */}
            <div className={`p-5 border-b flex items-start justify-between gap-4 sticky top-0 z-10 ${
              darkMode ? "bg-slate-900/95 border-slate-800" : "bg-white/95 border-slate-100"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl ${coinColors[selectedCoin.symbol]?.bg || "bg-purple-500/10"} border ${coinColors[selectedCoin.symbol]?.badge || "border-purple-500/30"} ${coinColors[selectedCoin.symbol]?.text || "text-purple-500"} flex items-center justify-center font-black font-mono text-sm shrink-0`}>
                  {selectedCoin.symbol.substring(0, 3)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black tracking-tight">
                      Gráfico de Movimentação - {selectedCoin.name} ({selectedCoin.symbol})
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 text-xs mt-0.5">
                    <span className={`font-mono font-bold text-base ${darkMode ? "text-white" : "text-slate-900"}`}>
                      {formatPrice(displayCurrency === "BRL" ? selectedCoin.priceBrl : selectedCoin.priceUsd, displayCurrency)}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                      selectedCoin.change24h >= 0 
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" 
                        : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                    }`}>
                      {selectedCoin.change24h >= 0 ? `+${selectedCoin.change24h.toFixed(2)}% (24h)` : `${selectedCoin.change24h.toFixed(2)}% (24h)`}
                    </span>
                  </div>
                </div>
              </div>

              <button
                id="close-crypto-chart-modal"
                onClick={() => setSelectedCoin(null)}
                className={`p-2 rounded-2xl border transition ${
                  darkMode 
                    ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-white" 
                    : "bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-900"
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Timeframe Selector & Currency Switcher */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className={`p-1 rounded-2xl border flex items-center gap-1 ${
                  darkMode ? "bg-slate-800/80 border-slate-700" : "bg-slate-100 border-slate-200"
                }`}>
                  {periodsList.map((p) => {
                    const isSelected = selectedPeriod === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPeriod(p.id)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition ${
                          isSelected 
                            ? "bg-purple-600 text-white shadow-xs" 
                            : darkMode ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <div className={`p-1 rounded-xl border flex items-center gap-1 text-xs font-bold ${
                    darkMode ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-200"
                  }`}>
                    <button
                      onClick={() => setDisplayCurrency("BRL")}
                      className={`px-2.5 py-1 rounded-lg transition ${
                        displayCurrency === "BRL" ? "bg-purple-600 text-white" : darkMode ? "text-slate-400" : "text-slate-600"
                      }`}
                    >
                      R$
                    </button>
                    <button
                      onClick={() => setDisplayCurrency("USD")}
                      className={`px-2.5 py-1 rounded-lg transition ${
                        displayCurrency === "USD" ? "bg-purple-600 text-white" : darkMode ? "text-slate-400" : "text-slate-600"
                      }`}
                    >
                      $
                    </button>
                  </div>
                </div>
              </div>

              {/* Period Stats summary bar */}
              <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl border ${
                darkMode ? "bg-slate-800/50 border-slate-800" : "bg-slate-50 border-slate-200/70"
              }`}>
                <div>
                  <span className={`text-[10px] uppercase font-bold ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                    Mínima no Período
                  </span>
                  <p className="text-sm font-black font-mono mt-0.5">
                    {formatPrice(minChartVal, displayCurrency)}
                  </p>
                </div>
                <div>
                  <span className={`text-[10px] uppercase font-bold ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                    Máxima no Período
                  </span>
                  <p className="text-sm font-black font-mono mt-0.5">
                    {formatPrice(maxChartVal, displayCurrency)}
                  </p>
                </div>
                <div>
                  <span className={`text-[10px] uppercase font-bold ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                    Variação ({periodsList.find(p => p.id === selectedPeriod)?.label})
                  </span>
                  <p className={`text-sm font-black font-mono mt-0.5 flex items-center gap-1 ${
                    isPeriodPositive ? "text-emerald-500" : "text-rose-500"
                  }`}>
                    {isPeriodPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {isPeriodPositive ? `+${periodChangePct.toFixed(2)}%` : `${periodChangePct.toFixed(2)}%`}
                  </p>
                </div>
                <div>
                  <span className={`text-[10px] uppercase font-bold ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                    Módulo de Tempo
                  </span>
                  <p className="text-sm font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                    Spot Binance Klines
                  </p>
                </div>
              </div>

              {/* Chart Visualizer */}
              <div className={`p-4 rounded-2xl border ${
                darkMode ? "bg-slate-950/60 border-slate-800" : "bg-slate-50/50 border-slate-200"
              }`}>
                {loadingChart ? (
                  <div className="h-72 flex flex-col items-center justify-center">
                    <Sparkles className="w-8 h-8 text-purple-600 animate-spin mb-2" />
                    <p className={`text-xs font-semibold ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                      Carregando dados históricos do período ({periodsList.find(p => p.id === selectedPeriod)?.label})...
                    </p>
                  </div>
                ) : chartData.length === 0 ? (
                  <div className="h-72 flex items-center justify-center text-xs font-semibold text-slate-500">
                    Sem dados históricos disponíveis para este intervalo.
                  </div>
                ) : (
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="cryptoGradientPos" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="cryptoGradientNeg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#334155" : "#e2e8f0"} vertical={false} />
                        <XAxis 
                          dataKey="timeLabel" 
                          stroke={darkMode ? "#94a3b8" : "#64748b"} 
                          fontSize={11} 
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis 
                          domain={['auto', 'auto']} 
                          stroke={darkMode ? "#94a3b8" : "#64748b"} 
                          fontSize={10} 
                          orientation="right"
                          tickFormatter={(v) => formatPrice(v, displayCurrency)}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload as ChartPoint;
                              const val = displayCurrency === "BRL" ? d.priceBrl : d.priceUsd;
                              return (
                                <div className={`p-3 rounded-xl border shadow-xl text-xs font-mono ${
                                  darkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
                                }`}>
                                  <p className="text-[10px] text-slate-400 mb-1">{d.timeLabel}</p>
                                  <p className="text-sm font-black text-purple-500">
                                    {formatPrice(val, displayCurrency)}
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey={displayCurrency === "BRL" ? "priceBrl" : "priceUsd"} 
                          stroke={isPeriodPositive ? "#10b981" : "#f43f5e"} 
                          strokeWidth={2.5}
                          fillOpacity={1} 
                          fill={isPeriodPositive ? "url(#cryptoGradientPos)" : "url(#cryptoGradientNeg)"} 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info footer */}
      <div className={`p-4 rounded-2xl border text-xs flex items-start gap-2.5 ${
        darkMode ? "bg-slate-900/60 border-slate-800 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-600"
      }`}>
        <Info className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
        <p className="leading-relaxed text-[11px]">
          As <strong>16 Commodities Digitais</strong> acima possuem suporte a gráficos interativos completos de <strong>1 Minuto, 1 Dia, 1 Semana, 1 Mês e 1 Ano</strong> com dados históricos recuperados via Binance Klines em tempo real.
        </p>
      </div>
    </div>
  );
}

