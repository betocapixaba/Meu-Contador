export const INCOME_CATEGORIES = [
  "Salário",
  "Serviços",
  "Vendas",
  "Investimentos",
  "Outros"
] as const;

export const EXPENSE_CATEGORIES = [
  "Alimentação",
  "Transporte",
  "Moradia",
  "Lazer",
  "Saúde",
  "Compras",
  "Outros"
] as const;

export type IncomeCategory = typeof INCOME_CATEGORIES[number];
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];
export type TransactionCategory = IncomeCategory | ExpenseCategory;

/**
 * Intelligently classifies and normalizes a category string or raw text
 * into the strict official categories of the application.
 */
export function normalizeCategory(
  rawCategory: string | null | undefined,
  type: "receita" | "despesa",
  rawText?: string
): string {
  const combined = `${rawCategory || ""} ${rawText || ""}`.toLowerCase().trim();

  if (type === "receita") {
    // 1. Salário
    if (
      combined.includes("salario") ||
      combined.includes("salário") ||
      combined.includes("holerite") ||
      combined.includes("contracheque") ||
      combined.includes("adiantamento salarial") ||
      combined.includes("décimo terceiro") ||
      combined.includes("13º") ||
      combined.includes("pró-labore") ||
      combined.includes("pro-labore") ||
      combined.includes("folha") ||
      combined.includes("bônus da empresa")
    ) {
      return "Salário";
    }

    // 2. Vendas
    if (
      combined.includes("venda") ||
      combined.includes("vendi") ||
      combined.includes("faturamento") ||
      combined.includes("faturei") ||
      combined.includes("mercadoria") ||
      combined.includes("produto") ||
      combined.includes("comércio") ||
      combined.includes("comercio") ||
      combined.includes("lojinha") ||
      combined.includes("bazar") ||
      combined.includes("desapego") ||
      combined.includes("loja") ||
      combined.includes("revenda") ||
      combined.includes("e-commerce") ||
      combined.includes("ecommerce")
    ) {
      return "Vendas";
    }

    // 3. Investimentos
    if (
      combined.includes("investimento") ||
      combined.includes("investimentos") ||
      combined.includes("dividendo") ||
      combined.includes("dividendos") ||
      combined.includes("rendimento") ||
      combined.includes("juros") ||
      combined.includes("cdb") ||
      combined.includes("ações") ||
      combined.includes("acoes") ||
      combined.includes("bolsa") ||
      combined.includes("cripto") ||
      combined.includes("bitcoin") ||
      combined.includes("fii") ||
      combined.includes("poupança") ||
      combined.includes("poupanca") ||
      combined.includes("tesouro") ||
      combined.includes("aplicação") ||
      combined.includes("aplicacao")
    ) {
      return "Investimentos";
    }

    // 4. Serviços
    if (
      combined.includes("serviço") ||
      combined.includes("servico") ||
      combined.includes("serviços") ||
      combined.includes("servicos") ||
      combined.includes("consultoria") ||
      combined.includes("freela") ||
      combined.includes("freelance") ||
      combined.includes("diária") ||
      combined.includes("diaria") ||
      combined.includes("faxina") ||
      combined.includes("diarista") ||
      combined.includes("conserto") ||
      combined.includes("manutenção") ||
      combined.includes("manutencao") ||
      combined.includes("reforma") ||
      combined.includes("instalação") ||
      combined.includes("instalacao") ||
      combined.includes("mão de obra") ||
      combined.includes("mao de obra") ||
      combined.includes("projeto") ||
      combined.includes("aula") ||
      combined.includes("mentoria") ||
      combined.includes("atendimento") ||
      combined.includes("honorários") ||
      combined.includes("honorarios") ||
      combined.includes("comissão") ||
      combined.includes("comissao")
    ) {
      return "Serviços";
    }

    // Check if rawCategory directly matches an income category
    const exactIncome = INCOME_CATEGORIES.find(
      c => c.toLowerCase() === (rawCategory || "").trim().toLowerCase()
    );
    if (exactIncome) return exactIncome;

    // Default for income when unspecified
    return "Serviços";
  }

  // DESPESAS
  // 1. Alimentação
  if (
    combined.includes("alimenta") ||
    combined.includes("almoço") ||
    combined.includes("almoco") ||
    combined.includes("jantar") ||
    combined.includes("janta") ||
    combined.includes("comer") ||
    combined.includes("comida") ||
    combined.includes("restaurante") ||
    combined.includes("mercado") ||
    combined.includes("supermercado") ||
    combined.includes("padaria") ||
    combined.includes("padoca") ||
    combined.includes("café") ||
    combined.includes("cafe") ||
    combined.includes("cafezinho") ||
    combined.includes("lanche") ||
    combined.includes("lanchonete") ||
    combined.includes("ifood") ||
    combined.includes("rappi") ||
    combined.includes("delivery") ||
    combined.includes("pizza") ||
    combined.includes("pizzaria") ||
    combined.includes("hamburguer") ||
    combined.includes("mcdonalds") ||
    combined.includes("bk") ||
    combined.includes("burger") ||
    combined.includes("dunkin") ||
    combined.includes("churrasco") ||
    combined.includes("açougue") ||
    combined.includes("acougue") ||
    combined.includes("feira") ||
    combined.includes("hortifruti") ||
    combined.includes("sorvete") ||
    combined.includes("doces") ||
    combined.includes("salgados")
  ) {
    return "Alimentação";
  }

  // 2. Transporte
  if (
    combined.includes("transporte") ||
    combined.includes("uber") ||
    combined.includes("99") ||
    combined.includes("taxi") ||
    combined.includes("táxi") ||
    combined.includes("gasolina") ||
    combined.includes("combustível") ||
    combined.includes("combustivel") ||
    combined.includes("etanol") ||
    combined.includes("diesel") ||
    combined.includes("abastecer") ||
    combined.includes("posto") ||
    combined.includes("onibus") ||
    combined.includes("ônibus") ||
    combined.includes("metro") ||
    combined.includes("metrô") ||
    combined.includes("passagem") ||
    combined.includes("pedagio") ||
    combined.includes("pedágio") ||
    combined.includes("estacionamento") ||
    combined.includes("estacionar") ||
    combined.includes("mecanico") ||
    combined.includes("mecânico") ||
    combined.includes("oficina") ||
    combined.includes("pneu") ||
    combined.includes("troca de óleo") ||
    combined.includes("troca de oleo") ||
    combined.includes("ipva") ||
    combined.includes("seguro auto") ||
    combined.includes("sem parar") ||
    combined.includes("veloe") ||
    combined.includes("taggy") ||
    combined.includes("carro") ||
    combined.includes("moto")
  ) {
    return "Transporte";
  }

  // 3. Moradia
  if (
    combined.includes("moradia") ||
    combined.includes("aluguel") ||
    combined.includes("luz") ||
    combined.includes("energia") ||
    combined.includes("enel") ||
    combined.includes("cpfl") ||
    combined.includes("cemig") ||
    combined.includes("agua") ||
    combined.includes("água") ||
    combined.includes("sabesp") ||
    combined.includes("sanepar") ||
    combined.includes("internet") ||
    combined.includes("wifi") ||
    combined.includes("claro") ||
    combined.includes("vivo") ||
    combined.includes("tim") ||
    combined.includes("condominio") ||
    combined.includes("condomínio") ||
    combined.includes("gás") ||
    combined.includes("gas") ||
    combined.includes("iptu") ||
    combined.includes("reforma da casa") ||
    combined.includes("faxineira") ||
    combined.includes("diarista da casa") ||
    combined.includes("eletrodoméstico") ||
    combined.includes("eletrodomestico") ||
    combined.includes("móveis") ||
    combined.includes("moveis") ||
    combined.includes("cama") ||
    combined.includes("mesa") ||
    combined.includes("banho")
  ) {
    return "Moradia";
  }

  // 4. Lazer
  if (
    combined.includes("lazer") ||
    combined.includes("cinema") ||
    combined.includes("show") ||
    combined.includes("teatro") ||
    combined.includes("balada") ||
    combined.includes("festa") ||
    combined.includes("bar") ||
    combined.includes("barzinho") ||
    combined.includes("cerveja") ||
    combined.includes("chopp") ||
    combined.includes("bebida") ||
    combined.includes("boteco") ||
    combined.includes("viagem") ||
    combined.includes("viajar") ||
    combined.includes("hotel") ||
    combined.includes("pousada") ||
    combined.includes("passagem aérea") ||
    combined.includes("airbnb") ||
    combined.includes("streaming") ||
    combined.includes("netflix") ||
    combined.includes("spotify") ||
    combined.includes("amazon prime") ||
    combined.includes("hbo") ||
    combined.includes("disney") ||
    combined.includes("game") ||
    combined.includes("games") ||
    combined.includes("jogo") ||
    combined.includes("jogos") ||
    combined.includes("videogame") ||
    combined.includes("playstation") ||
    combined.includes("xbox") ||
    combined.includes("steam") ||
    combined.includes("praia") ||
    combined.includes("passeio") ||
    combined.includes("clube") ||
    combined.includes("parque") ||
    combined.includes("ingresso") ||
    combined.includes("rolê") ||
    combined.includes("role")
  ) {
    return "Lazer";
  }

  // 5. Saúde
  if (
    combined.includes("saúde") ||
    combined.includes("saude") ||
    combined.includes("farmácia") ||
    combined.includes("farmacia") ||
    combined.includes("drogaria") ||
    combined.includes("remédio") ||
    combined.includes("remedio") ||
    combined.includes("medicamento") ||
    combined.includes("médico") ||
    combined.includes("medico") ||
    combined.includes("doutor") ||
    combined.includes("consulta") ||
    combined.includes("dentista") ||
    combined.includes("odontologia") ||
    combined.includes("psicólogo") ||
    combined.includes("psicologo") ||
    combined.includes("terapia") ||
    combined.includes("hospital") ||
    combined.includes("pronto socorro") ||
    combined.includes("exame") ||
    combined.includes("laboratório") ||
    combined.includes("laboratorio") ||
    combined.includes("plano de saúde") ||
    combined.includes("plano de saude") ||
    combined.includes("unimed") ||
    combined.includes("bradesco saude") ||
    combined.includes("óculos") ||
    combined.includes("oculos") ||
    combined.includes("ótica") ||
    combined.includes("otica") ||
    combined.includes("fisioterapia") ||
    combined.includes("suplemento") ||
    combined.includes("whey") ||
    combined.includes("academia") ||
    combined.includes("smartfit") ||
    combined.includes("gympass") ||
    combined.includes("totalpass")
  ) {
    return "Saúde";
  }

  // 6. Compras
  if (
    combined.includes("compra") ||
    combined.includes("compras") ||
    combined.includes("shopping") ||
    combined.includes("roupa") ||
    combined.includes("roupas") ||
    combined.includes("vestuário") ||
    combined.includes("vestuario") ||
    combined.includes("sapato") ||
    combined.includes("sapatos") ||
    combined.includes("tênis") ||
    combined.includes("tenis") ||
    combined.includes("camisa") ||
    combined.includes("calça") ||
    combined.includes("calca") ||
    combined.includes("vestido") ||
    combined.includes("celular") ||
    combined.includes("iphone") ||
    combined.includes("computador") ||
    combined.includes("notebook") ||
    combined.includes("eletrônico") ||
    combined.includes("eletronico") ||
    combined.includes("presente") ||
    combined.includes("perfume") ||
    combined.includes("cosmético") ||
    combined.includes("cosmetico") ||
    combined.includes("maquiagem") ||
    combined.includes("shopee") ||
    combined.includes("shein") ||
    combined.includes("mercado livre") ||
    combined.includes("amazon") ||
    combined.includes("magalu") ||
    combined.includes("aliexpress") ||
    combined.includes("bolsa") ||
    combined.includes("acessório") ||
    combined.includes("acessorio") ||
    combined.includes("ferramenta") ||
    combined.includes("livro") ||
    combined.includes("papelaria")
  ) {
    return "Compras";
  }

  // Check direct exact match
  const exactExpense = EXPENSE_CATEGORIES.find(
    c => c.toLowerCase() === (rawCategory || "").trim().toLowerCase()
  );
  if (exactExpense) return exactExpense;

  return "Outros";
}
