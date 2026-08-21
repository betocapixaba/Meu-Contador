/**
 * Accurately extract numerical financial amounts from text/speech transcripts.
 * Handles formats like:
 * - $150.00, $150, $ 150.00, 150.00, 150,00, R$ 150,00, €150.50
 * - 10.00, 10,00, 10, 1500, 1.500,00, 1,500.00
 * - Spoken compound words: "cento e cinquenta", "cento e cinquenta dólares", "mil e quinhentos", "duzentos e cinquenta", "dez dólares", "dez reais", etc.
 */

export function parseFinancialAmount(rawText: string): number {
  if (!rawText) return 0;
  const text = rawText.trim();
  const lower = text.toLowerCase();

  // 1. Explicit currency symbol followed by number: e.g. "$150.00", "$ 150.00", "$150", "R$ 150,00", "€ 50.00"
  const currencySymbolRegex = /(?:r\$\s*|\$\s*|€\s*|£\s*|¥\s*|chf\s*|a\$\s*|c\$\s*|zł\s*|kr\s*)([0-9]+(?:[.,][0-9]+)*)/i;
  const symbolMatch = text.match(currencySymbolRegex);
  if (symbolMatch && symbolMatch[1]) {
    const val = parseCleanNumberString(symbolMatch[1]);
    if (val > 0) return val;
  }

  // 2. Number followed by currency word: e.g. "150 dólares", "150 dolares", "150 reais", "150.00 dólares", "150,00 reais", "150 usd"
  const currencyWordRegex = /\b([0-9]+(?:[.,][0-9]+)*)\s*(?:reais|real|dólares|dolares|dólar|dolar|euros|euro|libras|libra|pesos|peso|bucks|usd|brl|eur|mangos|pratas|contos)\b/i;
  const wordMatch = text.match(currencyWordRegex);
  if (wordMatch && wordMatch[1]) {
    const val = parseCleanNumberString(wordMatch[1]);
    if (val > 0) return val;
  }

  // 3. Spoken Portuguese compound numbers (e.g. "cento e cinquenta", "mil e quinhentos", "duzentos e cinquenta", "quinhentos", "dez")
  const spokenWordAmount = parseSpokenPortugueseNumber(lower);
  if (spokenWordAmount > 0) {
    return spokenWordAmount;
  }

  // 4. Any numeric digit sequences in the string: e.g. "150.00 de gasto", "gastei 150", "150 no mercado"
  const anyNumberMatches = text.match(/\b([0-9]+(?:[.,][0-9]+)*)\b/g);
  if (anyNumberMatches) {
    const currentYear = new Date().getFullYear();
    // Filter out obvious years (2024, 2025, 2026, etc.) if there are other candidates
    const validMatches = anyNumberMatches.filter(n => {
      const v = parseCleanNumberString(n);
      return v > 0 && v !== currentYear;
    });

    if (validMatches.length > 0) {
      return parseCleanNumberString(validMatches[0]);
    } else if (anyNumberMatches.length > 0) {
      return parseCleanNumberString(anyNumberMatches[0]);
    }
  }

  return 0;
}

export function parseCleanNumberString(rawNum: string): number {
  if (!rawNum) return 0;
  let str = rawNum.replace(/\s+/g, "").trim();

  // If contains both '.' and ','
  if (str.includes(".") && str.includes(",")) {
    const lastDot = str.lastIndexOf(".");
    const lastComma = str.lastIndexOf(",");
    if (lastComma > lastDot) {
      // Brazilian/European format: 1.500,50 -> 1500.50
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      // US format: 1,500.50 -> 1500.50
      str = str.replace(/,/g, "");
    }
  } else if (str.includes(",")) {
    // Only comma: e.g. "150,00" or "10,50" or "1,000"
    const parts = str.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      // Decimal comma (e.g. 150,00 -> 150.00)
      str = str.replace(",", ".");
    } else {
      // Thousands separator (e.g. 1,000 -> 1000)
      str = str.replace(/,/g, "");
    }
  } else if (str.includes(".")) {
    // Only dot: e.g. "150.00" (US decimal) or "1.000" (BR thousands)
    const parts = str.split(".");
    if (parts.length === 2 && parts[1].length <= 2) {
      // Decimal dot e.g. 150.00 -> 150.00
      // str is already formatted as decimal
    } else if (parts.length === 2 && parts[1].length === 3) {
      // Ambiguous thousands vs decimal. E.g. "1.000"
      str = str.replace(/\./g, "");
    } else {
      // Multiple dots e.g. 1.000.000
      str = str.replace(/\./g, "");
    }
  }

  const result = parseFloat(str);
  return isNaN(result) ? 0 : result;
}

/**
 * Parses Portuguese spoken numbers including compound numbers like:
 * - "cento e cinquenta" -> 150
 * - "cento e cinquenta e cinco" -> 155
 * - "mil e quinhentos" -> 1500
 * - "dois mil e quatrocentos e cinquenta" -> 2450
 * - "duzentos e cinquenta" -> 250
 * - "quinhentos" -> 500
 * - "cinquenta" -> 50
 * - "quinze" -> 15
 */
export function parseSpokenPortugueseNumber(lowerText: string): number {
  if (!lowerText) return 0;

  // Check for cents (centavos) pattern e.g. "cento e cinquenta reais e cinquenta centavos"
  let cents = 0;
  const centsMatch = lowerText.match(/(?:e|com)\s+(cinquenta|vinte|trinta|quarenta|sessenta|setenta|oitenta|noventa|[0-9]+)\s+centavos/i);
  if (centsMatch && centsMatch[1]) {
    const rawCents = centsMatch[1].toLowerCase();
    if (rawCents === "cinquenta" || rawCents === "50") cents = 0.50;
    else if (rawCents === "vinte" || rawCents === "20") cents = 0.20;
    else if (rawCents === "trinta" || rawCents === "30") cents = 0.30;
    else if (rawCents === "quarenta" || rawCents === "40") cents = 0.40;
    else if (rawCents === "sessenta" || rawCents === "60") cents = 0.60;
    else if (rawCents === "setenta" || rawCents === "70") cents = 0.70;
    else if (rawCents === "oitenta" || rawCents === "80") cents = 0.80;
    else if (rawCents === "noventa" || rawCents === "90") cents = 0.90;
    else {
      const num = parseInt(rawCents, 10);
      if (!isNaN(num)) cents = num / 100;
    }
  }

  // 1. Comprehensive compound patterns:
  // "cento e cinquenta" -> 150
  if (/\bcento\s+e\s+cinquenta\b/i.test(lowerText)) {
    let extra = 0;
    if (/\bcento\s+e\s+cinquenta\s+e\s+nove\b/i.test(lowerText)) extra = 9;
    else if (/\bcento\s+e\s+cinquenta\s+e\s+oito\b/i.test(lowerText)) extra = 8;
    else if (/\bcento\s+e\s+cinquenta\s+e\s+sete\b/i.test(lowerText)) extra = 7;
    else if (/\bcento\s+e\s+cinquenta\s+e\s+seis\b/i.test(lowerText)) extra = 6;
    else if (/\bcento\s+e\s+cinquenta\s+e\s+cinco\b/i.test(lowerText)) extra = 5;
    else if (/\bcento\s+e\s+cinquenta\s+e\s+quatro\b/i.test(lowerText)) extra = 4;
    else if (/\bcento\s+e\s+cinquenta\s+e\s+tr[eê]s\b/i.test(lowerText)) extra = 3;
    else if (/\bcento\s+e\s+cinquenta\s+e\s+dois\b|\bcento\s+e\s+cinquenta\s+e\s+duas\b/i.test(lowerText)) extra = 2;
    else if (/\bcento\s+e\s+cinquenta\s+e\s+um\b|\bcento\s+e\s+cinquenta\s+e\s+uma\b/i.test(lowerText)) extra = 1;
    return 150 + extra + cents;
  }

  // Compound hundreds + tens:
  const hundredsList: [RegExp, number][] = [
    [/\bnovecentos\b|\bnovecentas\b/i, 900],
    [/\boitocentos\b|\boitocentas\b/i, 800],
    [/\bsetecentos\b|\bsetecentas\b/i, 700],
    [/\bseiscentos\b|\bseiscentas\b/i, 600],
    [/\bquinhentos\b|\bquinhentas\b/i, 500],
    [/\bquatrocentos\b|\bquatrocentas\b/i, 400],
    [/\btrezentos\b|\btrezentas\b/i, 300],
    [/\bduzentos\b|\bduzentas\b/i, 200],
    [/\bcento\b/i, 100],
    [/\bcem\b/i, 100]
  ];

  const tensList: [RegExp, number][] = [
    [/\bnoventa\b/i, 90],
    [/\boitenta\b/i, 80],
    [/\bsetenta\b/i, 70],
    [/\bsessenta\b/i, 60],
    [/\bcinquenta\b|\bcincoenta\b/i, 50],
    [/\bquarenta\b/i, 40],
    [/\btrinta\b/i, 30],
    [/\bvinte\b/i, 20],
    [/\bdezenove\b/i, 19],
    [/\bdezoito\b/i, 18],
    [/\bdezessete\b/i, 17],
    [/\bdezesseis\b/i, 16],
    [/\bquinze\b/i, 15],
    [/\bquatorze\b|\bcatorze\b/i, 14],
    [/\btreze\b/i, 13],
    [/\bdoze\b/i, 12],
    [/\bonze\b/i, 11],
    [/\bdez\b/i, 10]
  ];

  const unitsList: [RegExp, number][] = [
    [/\bnove\b/i, 9],
    [/\boito\b/i, 8],
    [/\bsete\b/i, 7],
    [/\bseis\b/i, 6],
    [/\bcinco\b/i, 5],
    [/\bquatro\b/i, 4],
    [/\btr[eê]s\b/i, 3],
    [/\bdois\b|\bduas\b/i, 2],
    [/\bum\b|\buma\b|\bhum\b/i, 1]
  ];

  const thousandsList: [RegExp, number][] = [
    [/\bdez\s+mil\b/i, 10000],
    [/\bnove\s+mil\b/i, 9000],
    [/\boito\s+mil\b/i, 8000],
    [/\bsete\s+mil\b/i, 7000],
    [/\bseis\s+mil\b/i, 6000],
    [/\bcinco\s+mil\b/i, 5000],
    [/\bquatro\s+mil\b/i, 4000],
    [/\btr[eê]s\s+mil\b/i, 3000],
    [/\bdois\s+mil\b|\bduas\s+mil\b/i, 2000],
    [/\bum\s+mil\b|\bmil\b/i, 1000]
  ];

  // Try compound calculation: Thousands + Hundreds + Tens + Units
  let totalSpoken = 0;
  let matchedSpoken = false;

  for (const [thRegex, thVal] of thousandsList) {
    if (thRegex.test(lowerText)) {
      totalSpoken += thVal;
      matchedSpoken = true;
      break;
    }
  }

  for (const [hRegex, hVal] of hundredsList) {
    if (hRegex.test(lowerText)) {
      totalSpoken += hVal;
      matchedSpoken = true;
      break;
    }
  }

  for (const [tRegex, tVal] of tensList) {
    if (tRegex.test(lowerText)) {
      totalSpoken += tVal;
      matchedSpoken = true;
      break;
    }
  }

  // If tens was >= 20, check units (e.g. "cinquenta e cinco" -> 50 + 5)
  if (totalSpoken === 0 || totalSpoken % 10 === 0) {
    // Only check units if we have "e <unit>" or stand alone
    for (const [uRegex, uVal] of unitsList) {
      if (totalSpoken > 0) {
        const compUnitRegex = new RegExp(`(?:e\\s+|\\s+)${uRegex.source}`, "i");
        if (compUnitRegex.test(lowerText)) {
          totalSpoken += uVal;
          break;
        }
      } else if (uRegex.test(lowerText)) {
        // Standalone unit word e.g. "cinco dólares"
        const unitCurrency = new RegExp(`${uRegex.source}\\s+(?:reais|real|dólares|dolares|dólar|dolar|euros|euro|pesos|peso|bucks)`, "i");
        if (unitCurrency.test(lowerText)) {
          totalSpoken = uVal;
          matchedSpoken = true;
          break;
        }
      }
    }
  }

  if (matchedSpoken && totalSpoken > 0) {
    return totalSpoken + cents;
  }

  return 0;
}

