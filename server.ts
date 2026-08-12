import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase limit to allow receipt image upload (base64)
app.use(express.json({ limit: "10mb" }));

// Initialize Gemini SDK lazily
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// Helper: Local dynamic parsing when Gemini is unavailable (Quota/Rate limit/No API Key)
function generateLocalFallbackCommandParse(text: string, referenceDate: string, transactionsSummary?: any) {
  const lower = text.toLowerCase().trim();
  const ref = new Date(referenceDate);
  let year = ref.getFullYear();
  let month = String(ref.getMonth() + 1).padStart(2, "0");
  let day = String(ref.getDate()).padStart(2, "0");

  if (lower.includes("ontem")) {
    const yesterday = new Date(ref);
    yesterday.setDate(yesterday.getDate() - 1);
    year = yesterday.getFullYear();
    month = String(yesterday.getMonth() + 1).padStart(2, "0");
    day = String(yesterday.getDate()).padStart(2, "0");
  } else if (lower.includes("anteontem")) {
    const anteontem = new Date(ref);
    anteontem.setDate(anteontem.getDate() - 2);
    year = anteontem.getFullYear();
    month = String(anteontem.getMonth() + 1).padStart(2, "0");
    day = String(anteontem.getDate()).padStart(2, "0");
  }

  // Check if this is a conversational question or general chat rather than a financial transaction to log
  const questionKeywords = ["quanto", "como", "qual", "quais", "onde", "por que", "porque", "olá", "ola", "oi", "bom dia", "boa tarde", "boa noite", "ajuda", "dica", "resumo", "saldo", "relatório", "relatorio", "quem é você", "o que você faz"];
  const isQuestion = questionKeywords.some(kw => lower.startsWith(kw) || lower.includes("quanto ") || lower.includes("como ") || lower.includes("quais ") || lower === "oi" || lower === "olá");

  const revenueKeywords = [
    "recebi", "ganhei", "receita", "salario", "salário", "ganho", "ganhos", 
    "provento", "pix de", "recebimento", "vendi", "faturamento", "faturei", 
    "receber", "entrada", "faturou", "ganhou", "salários"
  ];
  const expenseKeywords = ["gastei", "paguei", "comprei", "despesa", "saida", "saída", "custo", "pagamento", "almoço", "jantar", "uber", "gasolina", "mercado"];
  const hasTransactionKeyword = revenueKeywords.some(kw => lower.includes(kw)) || expenseKeywords.some(kw => lower.includes(kw));

  // Regex to extract numeric values (supporting formats like: 1500, 1.500, 15,50, 15.50, R$ 50, $25, etc.)
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
      if (!isNaN(val) && val > 0 && val !== year) {
        amount = val;
        break;
      }
    }
  }

  // If user is asking a conversational question or no transaction keyword or amount was given
  if (isQuestion || (!hasTransactionKeyword && amount === 0)) {
    let reply = "Olá! Sou o seu Agente de IA Financeira. Você pode me pedir para lançar receitas e despesas (ex: 'Recebi 500 do João' ou 'Gastei 40 no mercado') ou fazer perguntas sobre suas finanças!";
    
    if (lower.includes("quanto") && (lower.includes("gastei") || lower.includes("despesa"))) {
      if (transactionsSummary && transactionsSummary.totalExpense !== undefined) {
        reply = `Você possui R$ ${Number(transactionsSummary.totalExpense).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em despesas registradas.`;
      } else {
        reply = "Seus lançamentos de despesas podem ser acompanhados no Painel Principal e na aba Despesas.";
      }
    } else if (lower.includes("quanto") && (lower.includes("ganhei") || lower.includes("recebi") || lower.includes("receita"))) {
      if (transactionsSummary && transactionsSummary.totalIncome !== undefined) {
        reply = `Suas receitas totais cadastradas somam R$ ${Number(transactionsSummary.totalIncome).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`;
      } else {
        reply = "Você pode acompanhar todas as suas receitas cadastradas na aba Receitas.";
      }
    } else if (lower.includes("saldo")) {
      if (transactionsSummary && transactionsSummary.balance !== undefined) {
        reply = `Seu saldo atual é de R$ ${Number(transactionsSummary.balance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`;
      } else {
        reply = "Consulte o seu saldo total disponível diretamente no cartão do Painel Principal.";
      }
    }

    return {
      intent: "chat",
      reply
    };
  }

  let type: "receita" | "despesa" = "despesa";
  for (const kw of revenueKeywords) {
    if (lower.includes(kw)) {
      type = "receita";
      break;
    }
  }

  let category = "Outros";
  const catKeywords: Record<string, string[]> = {
    "Alimentação": ["comer", "comida", "restaurante", "almoço", "almoco", "jantar", "café", "cafe", "bauru", "padaria", "dunkin", "alimentação", "alimentacao", "supermercado", "mercado", "lanche", "janta", "pizzaria", "pizza", "hamburguer", "lanchonete", "padoca", "padaria", "mcdonalds", "bk", "burger"],
    "Transporte": ["uber", "onibus", "ônibus", "metro", "metrô", "táxi", "taxi", "combustivel", "combustível", "gasolina", "transporte", "passagem", "pedágio", "pedagio", "estacionamento", "carro", "moto", "99", "99pop"],
    "Moradia": ["aluguel", "luz", "agua", "água", "energia", "internet", "condominio", "condomínio", "moradia", "gás", "gas", "reforma", "enxoval"],
    "Salário": ["salario", "salário", "pagamento", "provento", "adiantamento", "holerite"],
    "Serviços": ["conserto", "reforma", "instalação", "instalacao", "serviço", "servico", "manutenção", "manutencao", "limpeza", "diarista", "faxina"],
    "Lazer": ["cinema", "show", "festa", "viagem", "cerveja", "bar", "lazer", "balada", "jogo", "ingresso", "praia", "futebol", "role", "rolê", "teatro"],
    "Saúde": ["farmacia", "farmácia", "médico", "medico", "remédio", "remedio", "hospital", "saúde", "saude", "dentista", "consulta", "exame", "clínica", "clinica", "drogaria"]
  };

  outerLoop: for (const [cat, keywords] of Object.entries(catKeywords)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        category = cat;
        break outerLoop;
      }
    }
  }

  let location: string | null = null;
  if (lower.includes("uber")) location = "Uber";
  else if (lower.includes("dunkin")) location = "Dunkin";
  else if (lower.includes("netflix")) location = "Netflix";
  else if (lower.includes("spotify")) location = "Spotify";
  else if (lower.includes("ifood")) location = "iFood";
  else {
    const locMatch = text.match(/(?:no|na|em)\s+([A-Z][a-zA-Z0-9À-ÿ]+)/);
    if (locMatch && locMatch[1]) {
      location = locMatch[1];
    }
  }

  let client: string | null = null;
  if (type === "receita") {
    const clientMatch = text.match(/(?:do|da|de|pelo|pela)\s+([A-Z][a-zA-Z0-9À-ÿ]+)/);
    if (clientMatch && clientMatch[1]) {
      client = clientMatch[1];
    }
  }

  const cleanDesc = text.trim();
  const description = cleanDesc.charAt(0).toUpperCase() + cleanDesc.slice(1);
  const isRecurrent = lower.includes("mensal") || lower.includes("recorrente") || lower.includes("assinatura") || lower.includes("netflix") || lower.includes("spotify") || lower.includes("aluguel") || lower.includes("todo mês") || lower.includes("todo mes");

  return {
    intent: "transaction",
    type,
    amount,
    category,
    location,
    client,
    description,
    date: `${year}-${month}-${day}`,
    isRecurrent,
    confidence: 0.75,
    reply: `Entendi! Identifiquei uma ${type === "receita" ? "ENTRADA (Receita)" : "SAÍDA (Despesa)"} de R$ ${amount.toFixed(2)}.`
  };
}

// 1. API: Parse voice command or text command
app.post("/api/parse-command", async (req, res) => {
  const { text, currentDate, transactionsSummary } = req.body;
  if (!text) {
    res.status(400).json({ error: "O texto do comando é obrigatório." });
    return;
  }

  const referenceDate = currentDate || new Date().toISOString();

  try {
    const ai = getAiClient();

    const systemPrompt = `Você é o "Contador", um assistente financeiro inteligente e amigável para brasileiros ou quem usa o app.
Sua tarefa é analisar uma frase falada ou digitada em português sobre finanças e determinar a intenção do usuário:
1. Se for para REGISTRAR ou LANÇAR uma transação (ex: "Gastei 50 no almoço", "Recebi 1500 do cliente João"), defina intent = "transaction".
2. Se for uma PERGUNTA, CONVERSA ou SAUDAÇÃO (ex: "Olá", "Quanto eu gastei este mês?", "Como economizar?"), defina intent = "chat" e escreva uma resposta amigável em "reply".

Contexto de referência do celular:
- Data de referência: ${referenceDate}
- Resumo financeiro do usuário: ${JSON.stringify(transactionsSummary || {})}

Retorne APENAS um objeto JSON válido no seguinte formato:
{
  "intent": "transaction" ou "chat",
  "reply": "Texto de resposta explicativo ou saudação para o usuário",
  "type": "receita" ou "despesa" (somente se intent = transaction),
  "amount": número (valor da transação se intent = transaction),
  "category": categoria (ex: "Alimentação", "Transporte", "Moradia", "Salário", "Serviços", "Lazer", "Saúde", "Outros"),
  "location": local/estabelecimento onde ocorreu ou null,
  "client": nome do cliente (se receita) ou null,
  "description": descrição sucinta da transação,
  "date": data da transação no formato "YYYY-MM-DD",
  "isRecurrent": boolean,
  "confidence": número de 0 a 1
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Mensagem do usuário: "${text}"`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intent: {
              type: Type.STRING,
              description: "Deve ser 'transaction' ou 'chat'."
            },
            reply: {
              type: Type.STRING,
              description: "Resposta amigável para o usuário em português."
            },
            type: {
              type: Type.STRING,
              description: "Deve ser 'receita' ou 'despesa'."
            },
            amount: {
              type: Type.NUMBER,
              description: "Valor numérico extraído da transação."
            },
            category: {
              type: Type.STRING,
              description: "Categoria da transação."
            },
            location: {
              type: Type.STRING,
              description: "Local ou estabelecimento onde ocorreu ou null."
            },
            client: {
              type: Type.STRING,
              description: "Nome do cliente (se receita) ou null."
            },
            description: {
              type: Type.STRING,
              description: "Descrição sucinta da transação."
            },
            date: {
              type: Type.STRING,
              description: "Data da transação no formato YYYY-MM-DD."
            },
            isRecurrent: {
              type: Type.BOOLEAN,
              description: "Verdadeiro se for pagamento/recebimento mensal recorrente."
            },
            confidence: {
              type: Type.NUMBER,
              description: "Nível de certeza entre 0 e 1."
            }
          },
          required: ["intent", "reply"]
        }
      }
    });

    const responseText = response.text || "";
    const cleanJson = responseText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    try {
      const parsedData = JSON.parse(cleanJson);
      res.json(parsedData);
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON, falling back locally:", responseText);
      const localResult = generateLocalFallbackCommandParse(text, referenceDate, transactionsSummary);
      res.json(localResult);
    }
  } catch (error: any) {
    console.warn("Parse command fallback activated: Gemini rate limited/offline.", error);
    const localResult = generateLocalFallbackCommandParse(text, referenceDate, transactionsSummary);
    res.json(localResult);
  }
});

// 2. API: Scan receipt image (using Gemini Multimodal capability!)
app.post("/api/scan-receipt", async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      res.status(400).json({ error: "A imagem do recibo em base64 é obrigatória." });
      return;
    }

    // Extract base64 clean data and mime type
    const matches = imageBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    let mimeType = "image/jpeg";
    let base64Data = imageBase64;

    if (matches && matches.length === 3) {
      mimeType = matches[1];
      base64Data = matches[2];
    }

    const ai = getAiClient();

    const receiptPrompt = `Analise a imagem deste recibo, cupom fiscal ou nota fiscal de compra e extraia os dados estruturados no formato JSON especificado.
Você deve retornar APENAS o objeto JSON abaixo, sem blocos de código markdown ou texto explicativo:
{
  "amount": número (valor total pago/comprado),
  "category": categoria adequada (ex: "Alimentação", "Transporte", "Moradia", "Lazer", "Saúde", "Compras", "Outros"),
  "location": nome do estabelecimento/empresa emitente do recibo ou null,
  "date": data no formato "YYYY-MM-DD" se encontrada no cupom (senão retorne o dia de hoje no formato YYYY-MM-DD),
  "description": descrição sucinta da transação ou resumo dos principais itens comprados (ex: "Almoço de negócios", "Supermercado itens", "Café Dunkin")
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          text: receiptPrompt
        },
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: {
              type: Type.NUMBER,
              description: "Valor total pago/comprado no recibo."
            },
            category: {
              type: Type.STRING,
              description: "Categoria adequada (ex: Alimentação, Transporte, Moradia, Lazer, Saúde, Compras, Outros)."
            },
            location: {
              type: Type.STRING,
              description: "Nome do estabelecimento ou null."
            },
            date: {
              type: Type.STRING,
              description: "Data no formato YYYY-MM-DD."
            },
            description: {
              type: Type.STRING,
              description: "Descrição sucinta da transação ou resumo dos principais itens."
            }
          },
          required: ["amount", "category", "date", "description"]
        }
      }
    });

    const responseText = response.text || "";
    const cleanJson = responseText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    try {
      const parsedData = JSON.parse(cleanJson);
      res.json(parsedData);
    } catch (parseError) {
      console.warn("Failed to parse Gemini receipt response as JSON, using fallback:");
      const today = new Date().toISOString().split("T")[0];
      res.json({
        amount: 0,
        category: "Compras",
        location: "Recibo (IA Offline)",
        date: today,
        description: "Recibo enviado. Digite o valor manualmente (IA Ocupada)."
      });
    }
  } catch (error: any) {
    console.warn("Scan receipt fallback activated: Gemini rate limited/offline.", error);
    const today = new Date().toISOString().split("T")[0];
    res.json({
      amount: 0,
      category: "Compras",
      location: "Recibo (IA Offline)",
      date: today,
      description: "Recibo enviado. Digite o valor manualmente (IA Ocupada)."
    });
  }
});

// 3. Helper: Local dynamic analysis when Gemini is unavailable (Quota/Rate limit/No API Key)
function generateFallbackAnalysis(
  balance: number = 0,
  totalIncome: number = 0,
  totalExpense: number = 0,
  transactions: any[] = [],
  goals: any[] = []
) {
  const netAmount = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (netAmount / totalIncome) * 100 : 0;
  
  let summary = "";
  if (transactions.length === 0) {
    summary = "Você ainda não possui lançamentos este mês. Que tal registrar sua primeira despesa ou receita para começar?";
  } else if (totalIncome === 0 && totalExpense > 0) {
    summary = `Você registrou R$ ${totalExpense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em despesas este mês, mas ainda não cadastrou nenhuma receita. Lembre-se de registrar seus ganhos para acompanhar o saldo real!`;
  } else if (netAmount < 0) {
    summary = `Atenção: Suas despesas (R$ ${totalExpense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}) superaram suas receitas (R$ ${totalIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}) em R$ ${Math.abs(netAmount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} este mês. Reduza gastos não essenciais para equilibrar as contas.`;
  } else {
    summary = `Bom trabalho! Suas finanças estão no azul este mês. Você guardou R$ ${netAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (cerca de ${savingsRate.toFixed(0)}% das suas receitas totais).`;
  }

  const alerts: string[] = [];
  
  // Categorize expenses
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
    alerts.push(`Sua maior despesa é com "${maxCategory}" (R$ ${maxAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}), representando ${pct.toFixed(0)}% dos seus gastos.`);
  }

  // Check goal progress
  if (goals && goals.length > 0) {
    goals.slice(0, 2).forEach((g: any) => {
      const target = Number(g.targetAmount || 0);
      const current = Number(g.currentAmount || 0);
      if (target > 0) {
        const pct = (current / target) * 100;
        if (pct >= 100) {
          alerts.push(`Parabéns! Você alcançou sua meta: "${g.title}"!`);
        } else if (pct >= 80) {
          alerts.push(`Você está muito perto! Já alcançou ${pct.toFixed(0)}% da sua meta "${g.title}". Faltam apenas R$ ${(target - current).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`);
        } else if (pct > 0) {
          alerts.push(`Sua meta "${g.title}" está com ${pct.toFixed(0)}% de progresso acumulado.`);
        }
      }
    });
  }

  // Savings advice / alerts
  if (totalExpense > 0 && totalIncome > 0) {
    const ratio = totalExpense / totalIncome;
    if (ratio > 0.8) {
      alerts.push("Seu nível de despesas está muito alto (mais de 80% da receita). Recomendamos criar limites de gastos semanais.");
    }
  }

  if (alerts.length === 0) {
    alerts.push("Suas contas estão equilibradas. Mantenha os registros atualizados para obter mais insights!");
  }

  // Default practical tips
  let tip = "Crie uma reserva de emergência equivalente a 3 a 6 meses do seu custo de vida essencial antes de iniciar investimentos de maior risco.";
  if (maxCategory === "Alimentação" && maxAmount > 100) {
    tip = "Dica para economizar em Alimentação: Planeje as compras do mês, faça uma lista de supermercado rígida e evite pedir delivery em dias de semana.";
  } else if (maxCategory === "Lazer" && maxAmount > 100) {
    tip = "Dica para economizar em Lazer: Busque programas gratuitos em sua cidade, como parques, eventos culturais e exposições de arte sem custo.";
  } else if (netAmount < 0) {
    tip = "Dica para equilibrar contas: Use a regra dos 3 dias: se quiser comprar algo supérfluo, espere 72 horas. Muitas vezes o desejo passa e você economiza.";
  } else if (savingsRate > 20) {
    tip = "Dica de Investimentos: Com uma excelente taxa de poupança, estude opções de renda fixa como CDBs 100% CDI com liquidez diária para fazer seu dinheiro render.";
  }

  const motivations = [
    "O sucesso financeiro não é sobre quanto você ganha, mas sim sobre o quanto você poupa.",
    "Não economize o que sobra depois de gastar, gaste o que sobra depois de economizar.",
    "A disciplina financeira é a chave que abre a porta de todos os seus grandes sonhos.",
    "Pequenos riachos formam grandes rios. Cada pequeno corte em despesas supérfluas faz diferença.",
    "Controlar o seu dinheiro hoje garante a tranquilidade do seu amanhã."
  ];
  const motivation = motivations[Math.floor(Math.random() * motivations.length)];

  return {
    summary: summary,
    alerts,
    tip,
    motivation
  };
}

// 4. API: Intelligent finance analysis
app.post("/api/analyze-finances", async (req, res) => {
  const { balance, totalIncome, totalExpense, transactions, goals } = req.body;

  try {
    const ai = getAiClient();

    const analysisPrompt = `Você é o "Contador", o assistente financeiro pessoal de IA do usuário.
Analise os dados financeiros atuais do usuário e forneça insights inteligentes, alertas e dicas de economia úteis e motivacionais.

Dados do usuário:
- Saldo atual: R$ ${balance || 0} (ou dólares)
- Receitas totais: R$ ${totalIncome || 0}
- Despesas totais: R$ ${totalExpense || 0}
- Lista de transações recentes: ${JSON.stringify(transactions || [])}
- Metas financeiras: ${JSON.stringify(goals || [])}

Escreva uma resposta de ajuda curta e direta em português, estruturada para exibição rápida em um app mobile.
Seja empático, encorajador e forneça conselhos acionáveis.

Retorne APENAS um objeto JSON válido, sem markdown:
{
  "summary": "texto curto resumindo a saúde financeira deles no momento",
  "alerts": [
    "alerta inteligente 1 (ex: 'Você gastou mais em Alimentação este mês do que a média')",
    "alerta inteligente 2 (ex: 'Você está a caminho de atingir sua meta de Viagem')"
  ],
  "tip": "dica prática de finanças ou economia",
  "motivation": "frase curta e de impacto para motivar o usuário a economizar ou progredir"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ text: analysisPrompt }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: "Texto curto resumindo a saúde financeira do usuário."
            },
            alerts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Lista de alertas ou observações de gastos."
            },
            tip: {
              type: Type.STRING,
              description: "Uma dica prática de finanças ou economia."
            },
            motivation: {
              type: Type.STRING,
              description: "Uma frase curta e de impacto motivacional."
            }
          },
          required: ["summary", "alerts", "tip", "motivation"]
        }
      }
    });

    const responseText = response.text || "";
    const cleanJson = responseText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsedData = JSON.parse(cleanJson);
    res.json(parsedData);
  } catch (error: any) {
    console.log("Finance analysis fallback activated: Gemini rate limited/offline.");
    // Fall back smoothly to high-fidelity rule-based generator
    const localAnalysis = generateFallbackAnalysis(balance, totalIncome, totalExpense, transactions, goals);
    res.json(localAnalysis);
  }
});

// 5. API: Real-Time USD to BRL Exchange Rate Endpoint
app.get("/api/usd-rate", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const now = new Date();
  const timeFormatted = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  try {
    // Primary source: AwesomeAPI with cache-buster query parameter
    const response = await fetch(`https://economia.awesomeapi.com.br/json/last/USD-BRL?t=${Date.now()}`, {
      headers: { "Cache-Control": "no-cache" }
    });
    if (response.ok) {
      const data = await response.json();
      if (data && data.USDBRL) {
        const bid = parseFloat(data.USDBRL.bid);
        const pctChange = parseFloat(data.USDBRL.pctChange || "0");
        const createDate = data.USDBRL.create_date;
        const marketTime = createDate 
          ? new Date(createDate.replace(" ", "T")).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
          : timeFormatted;

        return res.json({
          bid,
          pctChange,
          high: parseFloat(data.USDBRL.high || "0"),
          low: parseFloat(data.USDBRL.low || "0"),
          updatedAt: marketTime,
          fullTimestamp: timeFormatted,
          source: "AwesomeAPI (Tempo Real)"
        });
      }
    }
  } catch (err) {
    console.warn("Primary AwesomeAPI rate fetch failed, trying fallback:", err);
  }

  // Fallback source 1: Open Exchange Rates / ER API
  try {
    const fbRes = await fetch(`https://open.er-api.com/v6/latest/USD?t=${Date.now()}`);
    if (fbRes.ok) {
      const fbData = await fbRes.json();
      if (fbData && fbData.rates && fbData.rates.BRL) {
        return res.json({
          bid: parseFloat(fbData.rates.BRL),
          pctChange: 0,
          updatedAt: timeFormatted,
          fullTimestamp: timeFormatted,
          source: "ExchangeRate API"
        });
      }
    }
  } catch (err2) {
    console.warn("Fallback rate fetch failed:", err2);
  }

  // Fallback source 2: ExchangeRate-API
  try {
    const fb2Res = await fetch(`https://api.exchangerate-api.com/v4/latest/USD?t=${Date.now()}`);
    if (fb2Res.ok) {
      const fb2Data = await fb2Res.json();
      if (fb2Data && fb2Data.rates && fb2Data.rates.BRL) {
        return res.json({
          bid: parseFloat(fb2Data.rates.BRL),
          pctChange: 0,
          updatedAt: timeFormatted,
          fullTimestamp: timeFormatted,
          source: "ExchangeRate-API"
        });
      }
    }
  } catch (err3) {
    console.warn("Fallback 2 rate fetch failed:", err3);
  }

  return res.json({
    bid: 5.65,
    pctChange: 0,
    updatedAt: timeFormatted,
    fullTimestamp: timeFormatted,
    source: "Estimativa"
  });
});

// 6. API: Real-Time 16 Digital Commodities (Cryptocurrencies) Endpoint
app.get("/api/crypto-rates", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const now = new Date();
  const timeFormatted = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  // List of requested 16 digital commodities
  const commoditiesList = [
    { symbol: "BTC", pair: "BTCUSDT", geckoid: "bitcoin", name: "Bitcoin", category: "Reserva de Valor / Ouro Digital" },
    { symbol: "ETH", pair: "ETHUSDT", geckoid: "ethereum", name: "Ethereum Ether", category: "Contratos Inteligentes" },
    { symbol: "SOL", pair: "SOLUSDT", geckoid: "solana", name: "Solana", category: "High Performance L1" },
    { symbol: "XRP", pair: "XRPUSDT", geckoid: "ripple", name: "XRP", category: "Liquidez e Remessas" },
    { symbol: "ADA", pair: "ADAUSDT", geckoid: "cardano", name: "Cardano", category: "Proof of Stake L1" },
    { symbol: "DOGE", pair: "DOGEUSDT", geckoid: "dogecoin", name: "Dogecoin", category: "Ativo Memético / P2P" },
    { symbol: "SHIB", pair: "SHIBUSDT", geckoid: "shiba-inu", name: "Shiba Inu", category: "Ecossistema Memético / L2" },
    { symbol: "AVAX", pair: "AVAXUSDT", geckoid: "avalanche-2", name: "Avalanche", category: "Subredes & DeFi" },
    { symbol: "LINK", pair: "LINKUSDT", geckoid: "chainlink", name: "Chainlink", category: "Oráculos de Dados" },
    { symbol: "DOT", pair: "DOTUSDT", geckoid: "polkadot", name: "Polkadot", category: "Interoperabilidade Multichain" },
    { symbol: "LTC", pair: "LTCUSDT", geckoid: "litecoin", name: "Litecoin", category: "Pagamentos Rápidos / Prata Digital" },
    { symbol: "BCH", pair: "BCHUSDT", geckoid: "bitcoin-cash", name: "Bitcoin Cash", category: "Dinheiro Eletrônico P2P" },
    { symbol: "XLM", pair: "XLMUSDT", geckoid: "stellar", name: "Stellar", category: "Rede de Pagamentos Globais" },
    { symbol: "HBAR", pair: "HBARUSDT", geckoid: "hedera-hashgraph", name: "Hedera", category: "Hashgraph Enterprise" },
    { symbol: "XTZ", pair: "XTZUSDT", geckoid: "tezos", name: "Tezos", category: "Self-Amending L1" },
    { symbol: "APT", pair: "APTUSDT", geckoid: "aptos", name: "Aptos", category: "Move-Based L1" }
  ];

  // First fetch live USD/BRL rate
  let usdBrlRate = 5.65;
  try {
    const usdRes = await fetch(`https://economia.awesomeapi.com.br/json/last/USD-BRL?t=${Date.now()}`);
    if (usdRes.ok) {
      const usdData = await usdRes.json();
      if (usdData && usdData.USDBRL) {
        usdBrlRate = parseFloat(usdData.USDBRL.bid) || 5.65;
      }
    }
  } catch (err) {
    console.warn("Could not fetch USD rate for crypto conversion:", err);
  }

  // Primary attempt: Binance API 24hr Ticker
  try {
    const symbolsParam = JSON.stringify(commoditiesList.map(c => c.pair));
    const binanceUrl = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(symbolsParam)}`;
    const binanceRes = await fetch(binanceUrl, { headers: { "Cache-Control": "no-cache" } });

    if (binanceRes.ok) {
      const data = await binanceRes.json();
      if (Array.isArray(data) && data.length > 0) {
        const results = commoditiesList.map(item => {
          const ticker = data.find((t: any) => t.symbol === item.pair);
          const priceUsd = ticker ? parseFloat(ticker.lastPrice) : 0;
          const change24h = ticker ? parseFloat(ticker.priceChangePercent) : 0;
          const high24h = ticker ? parseFloat(ticker.highPrice) : 0;
          const low24h = ticker ? parseFloat(ticker.lowPrice) : 0;
          const volume24hUsd = ticker ? parseFloat(ticker.quoteVolume) : 0;

          return {
            symbol: item.symbol,
            name: item.name,
            category: item.category,
            priceUsd,
            priceBrl: priceUsd * usdBrlRate,
            change24h,
            high24hUsd: high24h,
            low24hUsd: low24h,
            volume24hUsd
          };
        });

        return res.json({
          usdBrlRate,
          timestamp: timeFormatted,
          source: "Binance API (Tempo Real)",
          items: results
        });
      }
    }
  } catch (err) {
    console.warn("Binance fetch failed, falling back to CoinGecko / fallback:", err);
  }

  // Fallback attempt: CoinGecko API
  try {
    const ids = commoditiesList.map(c => c.geckoid).join(",");
    const cgUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd,brl&include_24hr_change=true&include_24hr_vol=true`;
    const cgRes = await fetch(cgUrl);
    if (cgRes.ok) {
      const cgData = await cgRes.json();
      const results = commoditiesList.map(item => {
        const coin = cgData[item.geckoid] || {};
        const priceUsd = coin.usd || 0;
        const priceBrl = coin.brl || (priceUsd * usdBrlRate);
        const change24h = coin.usd_24h_change || 0;
        const volume24hUsd = coin.usd_24h_vol || 0;

        return {
          symbol: item.symbol,
          name: item.name,
          category: item.category,
          priceUsd,
          priceBrl,
          change24h,
          high24hUsd: priceUsd * 1.03,
          low24hUsd: priceUsd * 0.97,
          volume24hUsd
        };
      });

      return res.json({
        usdBrlRate,
        timestamp: timeFormatted,
        source: "CoinGecko API",
        items: results
      });
    }
  } catch (err) {
    console.warn("CoinGecko fallback failed:", err);
  }

  // Baseline fallback values if external crypto APIs are temporarily blocked
  const fallbackPricesUsd: Record<string, { price: number; change: number }> = {
    BTC: { price: 95450, change: 2.15 },
    ETH: { price: 2680, change: 1.84 },
    SOL: { price: 198.50, change: 4.12 },
    XRP: { price: 2.45, change: -0.85 },
    ADA: { price: 0.82, change: 1.05 },
    DOGE: { price: 0.26, change: 3.40 },
    SHIB: { price: 0.0000245, change: 1.20 },
    AVAX: { price: 34.20, change: 0.95 },
    LINK: { price: 18.60, change: 2.30 },
    DOT: { price: 7.85, change: -1.10 },
    LTC: { price: 112.40, change: 0.50 },
    BCH: { price: 445.00, change: 1.75 },
    XLM: { price: 0.38, change: -0.40 },
    HBAR: { price: 0.22, change: 5.80 },
    XTZ: { price: 1.15, change: 0.20 },
    APT: { price: 9.80, change: 3.10 }
  };

  const fallbackResults = commoditiesList.map(item => {
    const base = fallbackPricesUsd[item.symbol] || { price: 10, change: 0 };
    const priceUsd = base.price;
    return {
      symbol: item.symbol,
      name: item.name,
      category: item.category,
      priceUsd,
      priceBrl: priceUsd * usdBrlRate,
      change24h: base.change,
      high24hUsd: priceUsd * 1.025,
      low24hUsd: priceUsd * 0.975,
      volume24hUsd: priceUsd * 500000
    };
  });

  return res.json({
    usdBrlRate,
    timestamp: timeFormatted,
    source: "Estimativa Mercado",
    items: fallbackResults
  });
});

// 7. API: Real-Time & Historical Kline Chart Endpoint for Digital Commodities
app.get("/api/crypto-chart", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const symbol = ((req.query.symbol as string) || "BTC").toUpperCase();
  const period = (req.query.period as string) || "1d"; // 1m, 1d, 1w, 1M, 1y
  const pair = `${symbol}USDT`;
  const targetUsd = req.query.currentPriceUsd ? parseFloat(req.query.currentPriceUsd as string) : 0;

  // Determine Binance interval & limit based on period
  let interval = "1h";
  let limit = 24;
  let dateFormatOptions: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

  if (period === "1m") {
    interval = "1m";
    limit = 60; // 60 minutes
    dateFormatOptions = { hour: "2-digit", minute: "2-digit", second: "2-digit" };
  } else if (period === "1d") {
    interval = "1h";
    limit = 24; // 24 hours
    dateFormatOptions = { hour: "2-digit", minute: "2-digit" };
  } else if (period === "1w") {
    interval = "4h";
    limit = 42; // 7 days * 6
    dateFormatOptions = { weekday: "short", hour: "2-digit" };
  } else if (period === "1M") {
    interval = "1d";
    limit = 30; // 30 days
    dateFormatOptions = { day: "2-digit", month: "short" };
  } else if (period === "1y") {
    interval = "1w";
    limit = 52; // 52 weeks
    dateFormatOptions = { month: "short", year: "2-digit" };
  }

  // Live USD/BRL rate
  let usdBrlRate = 5.65;
  try {
    const usdRes = await fetch(`https://economia.awesomeapi.com.br/json/last/USD-BRL?t=${Date.now()}`);
    if (usdRes.ok) {
      const usdData = await usdRes.json();
      if (usdData && usdData.USDBRL) {
        usdBrlRate = parseFloat(usdData.USDBRL.bid) || 5.65;
      }
    }
  } catch (e) {
    // ignore
  }

  try {
    const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`;
    const bRes = await fetch(binanceUrl, { headers: { "Cache-Control": "no-cache" } });
    if (bRes.ok) {
      const klines = await bRes.json();
      if (Array.isArray(klines) && klines.length > 0) {
        const points = klines.map((k: any) => {
          const openTime = k[0];
          const closePrice = parseFloat(k[4]);
          const dateObj = new Date(openTime);
          const timeLabel = dateObj.toLocaleDateString("pt-BR", dateFormatOptions);

          return {
            timestamp: openTime,
            timeLabel: period === "1m" || period === "1d" ? dateObj.toLocaleTimeString("pt-BR", dateFormatOptions) : timeLabel,
            priceUsd: closePrice,
            priceBrl: closePrice * usdBrlRate,
            highUsd: parseFloat(k[2]),
            lowUsd: parseFloat(k[3]),
            volumeUsd: parseFloat(k[7]) || 0
          };
        });

        // Scale points so final point matches targetUsd if provided
        if (targetUsd > 0 && points.length > 0) {
          const lastClose = points[points.length - 1].priceUsd;
          if (lastClose > 0) {
            const scale = targetUsd / lastClose;
            points.forEach((p: any) => {
              p.priceUsd = p.priceUsd * scale;
              p.priceBrl = p.priceUsd * usdBrlRate;
              p.highUsd = p.highUsd * scale;
              p.lowUsd = p.lowUsd * scale;
            });
          }
        }

        return res.json({
          symbol,
          period,
          usdBrlRate,
          source: "Binance Klines",
          data: points
        });
      }
    }
  } catch (err) {
    console.warn(`Binance chart fetch failed for ${pair}:`, err);
  }

  // Fallback synthetic series if Binance API is unreachable
  const nowMs = Date.now();
  const points = [];
  let basePrice = targetUsd > 0 ? targetUsd : 1000;
  if (!targetUsd) {
    if (symbol === "BTC") basePrice = 95450;
    if (symbol === "ETH") basePrice = 2680;
    if (symbol === "SOL") basePrice = 198.5;
    if (symbol === "XRP") basePrice = 2.45;
    if (symbol === "ADA") basePrice = 0.82;
    if (symbol === "DOGE") basePrice = 0.26;
    if (symbol === "SHIB") basePrice = 0.0000245;
  }

  // Generate backwards from targetUsd so final point is targetUsd
  const rawPoints = [];
  let currentP = basePrice;
  for (let i = 0; i < limit; i++) {
    rawPoints.push(currentP);
    const variation = (Math.random() - 0.48) * 0.02 * currentP;
    currentP = Math.max(0.000001, currentP - variation);
  }
  rawPoints.reverse(); // Now index limit-1 is targetUsd

  const stepMs = (period === "1m" ? 60000 : period === "1d" ? 3600000 : period === "1w" ? 14400000 : period === "1M" ? 86400000 : 604800000);

  for (let i = limit - 1; i >= 0; i--) {
    const tMs = nowMs - (i * stepMs);
    const dateObj = new Date(tMs);
    const val = rawPoints[limit - 1 - i];

    points.push({
      timestamp: tMs,
      timeLabel: period === "1m" || period === "1d" ? dateObj.toLocaleTimeString("pt-BR", dateFormatOptions) : dateObj.toLocaleDateString("pt-BR", dateFormatOptions),
      priceUsd: val,
      priceBrl: val * usdBrlRate,
      highUsd: val * 1.01,
      lowUsd: val * 0.99,
      volumeUsd: val * 1000
    });
  }

  return res.json({
    symbol,
    period,
    usdBrlRate,
    source: "Simulado",
    data: points
  });
});

// Serve frontend with Vite in dev, static files in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
