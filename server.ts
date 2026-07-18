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
function generateLocalFallbackCommandParse(text: string, referenceDate: string) {
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

  let type: "receita" | "despesa" = "despesa";
  const revenueKeywords = [
    "recebi", "ganhei", "receita", "salario", "salário", "ganho", "ganhos", 
    "provento", "pix de", "recebimento", "vendi", "faturamento", "faturei", 
    "receber", "entrada", "faturou", "ganhou", "salários"
  ];
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
    type,
    amount,
    category,
    location,
    client,
    description,
    date: `${year}-${month}-${day}`,
    isRecurrent,
    confidence: 0.65
  };
}

// 1. API: Parse voice command or text command
app.post("/api/parse-command", async (req, res) => {
  const { text, currentDate } = req.body;
  if (!text) {
    res.status(400).json({ error: "O texto do comando é obrigatório." });
    return;
  }

  const referenceDate = currentDate || new Date().toISOString();

  try {
    const ai = getAiClient();

    const systemPrompt = `Você é o "Contador", um assistente financeiro inteligente e amigável para brasileiros ou quem usa o app.
Sua tarefa é analisar uma frase falada ou digitada em português sobre finanças e extrair os dados estruturados no formato JSON especificado.

Considere a data e hora de referência do celular do usuário: ${referenceDate}.

Você deve retornar APENAS o objeto JSON abaixo, sem blocos de código markdown ou texto explicativo:
{
  "type": "receita" ou "despesa",
  "amount": número (valor da transação),
  "category": categoria (ex: "Alimentação", "Transporte", "Moradia", "Salário", "Serviços", "Lazer", "Saúde", "Outros"),
  "location": local/estabelecimento onde ocorreu (ex: "Dunkin", "Uber", "Supermercado") ou null,
  "client": nome do cliente (se receita, ex: nome da pessoa ou empresa que pagou) ou null,
  "description": descrição sucinta da transação,
  "date": data da transação no formato "YYYY-MM-DD" (se não especificado na frase, use o dia da data de referência),
  "isRecurrent": boolean (se parecer algo recorrente mensalmente como aluguel, assinatura, salário),
  "confidence": número de 0 a 1 indicando sua certeza
}

Se o valor estiver em dólares ($), reais (R$) ou outra moeda, extraia apenas o número cru (ex: 15 para "15 dólares", 350 para "350 dólares").
Seja inteligente ao categorizar. Ex: "café" -> "Alimentação", "Uber" -> "Transporte", "fatura de luz" -> "Moradia", "salário" -> "Salário", "instalação" -> "Serviços".
Se a frase indicar recebimento/ganho, o tipo é "receita". Se indicar gasto/compra/pagamento, o tipo é "despesa".`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Analise a frase: "${text}"`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
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
              description: "Categoria da transação (ex: Alimentação, Transporte, Moradia, Salário, Serviços, Lazer, Saúde, Outros)."
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
              description: "Verdadeiro se parecer um pagamento/recebimento mensal recorrente."
            },
            confidence: {
              type: Type.NUMBER,
              description: "Nível de certeza entre 0 e 1."
            }
          },
          required: ["type", "amount", "category", "description", "date", "isRecurrent", "confidence"]
        }
      }
    });

    const responseText = response.text || "";
    // Clean up any markdown json blocks if the model included them
    const cleanJson = responseText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    try {
      const parsedData = JSON.parse(cleanJson);
      res.json(parsedData);
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON, falling back locally:", responseText);
      const localResult = generateLocalFallbackCommandParse(text, referenceDate);
      res.json(localResult);
    }
  } catch (error: any) {
    console.warn("Parse command fallback activated: Gemini rate limited/offline.", error);
    // Fall back smoothly to high-fidelity rule-based local command parser
    const localResult = generateLocalFallbackCommandParse(text, referenceDate);
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
      model: "gemini-3.5-flash",
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
      model: "gemini-3.5-flash",
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
