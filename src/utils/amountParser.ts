/**
 * Accurately extract numerical financial amounts from text/speech transcripts.
 * Handles formats like:
 * - $10.00, $10, $ 10.00, R$ 10,00, €10.50
 * - 10.00, 10,00, 10, 1500, 1.500,00, 1,500.00
 * - Spoken words: "dez dólares", "dez reais", "dez", "vinte", "cem", "dois mil", etc.
 */

export function parseFinancialAmount(rawText: string): number {
  if (!rawText) return 0;
  const text = rawText.trim();
  const lower = text.toLowerCase();

  // 1. Explicit currency symbol followed by number: e.g. "$10.00", "$ 10.00", "R$ 10,00", "€ 50.00"
  const currencySymbolRegex = /(?:r\$\s*|\$\s*|€\s*|£\s*|¥\s*|chf\s*|a\$\s*|c\$\s*|zł\s*|kr\s*)([0-9]+(?:[.,][0-9]+)*)/i;
  const symbolMatch = text.match(currencySymbolRegex);
  if (symbolMatch && symbolMatch[1]) {
    const val = parseCleanNumberString(symbolMatch[1]);
    if (val > 0) return val;
  }

  // 2. Number followed by currency word: e.g. "10 dólares", "10 dolares", "10 reais", "10.00 dólares", "10,00 reais"
  const currencyWordRegex = /\b([0-9]+(?:[.,][0-9]+)*)\s*(?:reais|real|dólares|dolares|dólar|dolar|euros|euro|libras|libra|pesos|peso|bucks|mangos|pratas|contos)\b/i;
  const wordMatch = text.match(currencyWordRegex);
  if (wordMatch && wordMatch[1]) {
    const val = parseCleanNumberString(wordMatch[1]);
    if (val > 0) return val;
  }

  // 3. Spoken Portuguese number words (e.g. "dez dólares", "dez", "cem", "mil")
  const spokenWordAmount = parseSpokenPortugueseNumber(lower);
  if (spokenWordAmount > 0) {
    return spokenWordAmount;
  }

  // 4. Any numeric digit sequences in the string:
  const anyNumberMatches = text.match(/\b([0-9]+(?:[.,][0-9]+)*)\b/g);
  if (anyNumberMatches) {
    const currentYear = new Date().getFullYear();
    for (const numStr of anyNumberMatches) {
      const val = parseCleanNumberString(numStr);
      // Skip year numbers (e.g. 2024, 2025, 2026) unless explicitly single item
      if (val > 0 && val !== currentYear) {
        return val;
      }
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
    // Only comma: e.g. "10,00" or "10,5" or "1,000"
    const parts = str.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      // Decimal comma (e.g. 10,50 -> 10.50)
      str = str.replace(",", ".");
    } else {
      // Thousands separator (e.g. 1,000 -> 1000)
      str = str.replace(/,/g, "");
    }
  } else if (str.includes(".")) {
    // Only dot: e.g. "10.00" (US decimal) or "1.000" (BR thousands)
    const parts = str.split(".");
    if (parts.length === 2 && parts[1].length <= 2) {
      // Decimal dot e.g. 10.00 -> 10.00
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

export function parseSpokenPortugueseNumber(lowerText: string): number {
  // Check compound / multi-word numbers first (ordered from largest/longest to smallest)
  const spokenMap: [RegExp, number][] = [
    [/\bdez\s+mil\b/i, 10000],
    [/\bcinco\s+mil\b/i, 5000],
    [/\bquatro\s+mil\b/i, 4000],
    [/\btr[eê]s\s+mil\b/i, 3000],
    [/\bdois\s+mil\b/i, 2000],
    [/\bum\s+mil\b/i, 1000],
    [/\bmil\b/i, 1000],
    [/\bnovecentos\b/i, 900],
    [/\boitocentos\b/i, 800],
    [/\bsetecentos\b/i, 700],
    [/\bseiscentos\b/i, 600],
    [/\bquinhentos\b/i, 500],
    [/\bquatrocentos\b/i, 400],
    [/\btrezentos\b/i, 300],
    [/\bduzentos\b/i, 200],
    [/\bcem\b/i, 100],
    [/\bcento\b/i, 100],
    [/\bnoventa\b/i, 90],
    [/\boitenta\b/i, 80],
    [/\bsetenta\b/i, 70],
    [/\bsessenta\b/i, 60],
    [/\bcinquenta\b/i, 50],
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
    [/\bdez\b/i, 10],
    [/\bnove\b/i, 9],
    [/\boito\b/i, 8],
    [/\bsete\b/i, 7],
    [/\bseis\b/i, 6],
    [/\bcinco\b/i, 5],
    [/\bquatro\b/i, 4],
    [/\btr[eê]s\b/i, 3],
    [/\bdois\b|\bduas\b/i, 2],
    [/\bum\s+(?:dólar|dolar|real|euro|peso|conto|mango|prata)\b/i, 1],
    [/\buma\s+(?:libra|prata)\b/i, 1]
  ];

  for (const [regex, val] of spokenMap) {
    if (regex.test(lowerText)) {
      return val;
    }
  }

  return 0;
}
