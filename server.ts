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

// 1. API: Parse voice command or text command
app.post("/api/parse-command", async (req, res) => {
  try {
    const { text, currentDate } = req.body;
    if (!text) {
      res.status(400).json({ error: "O texto do comando é obrigatório." });
      return;
    }

    const ai = getAiClient();
    const referenceDate = currentDate || new Date().toISOString();

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
      console.error("Failed to parse Gemini response as JSON:", responseText);
      res.status(500).json({
        error: "Falha ao estruturar os dados.",
        rawText: responseText
      });
    }
  } catch (error: any) {
    console.error("Error in /api/parse-command:", error);
    res.status(500).json({ error: error.message || "Erro interno do servidor." });
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
      console.error("Failed to parse Gemini receipt response as JSON:", responseText);
      res.status(500).json({
        error: "Falha ao estruturar os dados do recibo.",
        rawText: responseText
      });
    }
  } catch (error: any) {
    console.error("Error in /api/scan-receipt:", error);
    res.status(500).json({ error: error.message || "Erro interno ao ler recibo." });
  }
});

// 3. API: Intelligent finance analysis
app.post("/api/analyze-finances", async (req, res) => {
  try {
    const { balance, totalIncome, totalExpense, transactions, goals } = req.body;

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

    try {
      const parsedData = JSON.parse(cleanJson);
      res.json(parsedData);
    } catch (parseError) {
      console.error("Failed to parse Gemini finance analysis response as JSON:", responseText);
      res.status(500).json({
        error: "Falha ao estruturar a análise financeira.",
        rawText: responseText
      });
    }
  } catch (error: any) {
    console.error("Error in /api/analyze-finances:", error);
    res.status(500).json({ error: error.message || "Erro interno ao analisar finanças." });
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
