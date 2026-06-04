import type { ParseResult, ParsedRecord } from "./types";
import { parseDate, parseAmountFlexible, detectType, detectCategory } from "./helpers";

const IGNORED = [
  /ouvidoria/i,
  /extrato gerado/i,
  /\bsac\b/i,
  /central de atendimento/i,
  /p[aá]gina\s*\d/i,
  /www\./i,
  /cnpj/i,
  /^agencia/i,
  /^agência/i,
  /saldo anterior/i,
  /saldo final/i,
  /^saldo\b/i,
  /emiss[aã]o/i,
  /titular/i,
  /extrato de conta/i,
  /banco\s+\d/i,
];

// Match Brazilian amounts: 1.234,56 or 1234,56 or 1.234.567,89
const AMOUNT_RE = /(?<!\d)([\d]{1,3}(?:[.,]\d{3})*[.,]\d{2})(?!\d)/g;

// Non-global for .test() calls
const AMOUNT_TEST = /(?<!\d)[\d]{1,3}(?:[.,]\d{3})*[.,]\d{2}(?!\d)/;

// Supports DD/MM/YYYY, DD/MM/YY, DD/MM
const DATE_TEST = /\b\d{2}\/\d{2}(?:\/\d{2,4})?\b/;
const DATE_MATCH = /\b(\d{2}\/\d{2}(?:\/\d{2,4})?)\b/;

function parseFlexibleDate(dateStr: string): string | null {
  // DD/MM/YYYY
  let m = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return parseDate(dateStr);

  // DD/MM/YY — assume 20xx for yy <= 50, else 19xx
  m = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (m) {
    const yr = parseInt(m[3]) > 50 ? `19${m[3]}` : `20${m[3]}`;
    return parseDate(`${m[1]}/${m[2]}/${yr}`);
  }

  // DD/MM — use current year
  m = dateStr.match(/^(\d{2})\/(\d{2})$/);
  if (m) {
    const yr = new Date().getFullYear();
    return parseDate(`${m[1]}/${m[2]}/${yr}`);
  }

  return null;
}

function getAmounts(line: string): Array<{ raw: string; isNeg: boolean }> {
  const re = /(?<!\d)([\d]{1,3}(?:[.,]\d{3})*[.,]\d{2})(?!\d)/g;
  const results: Array<{ raw: string; isNeg: boolean }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const raw = m[1];
    const after = line.slice(m.index + raw.length, m.index + raw.length + 5);
    const before = line.slice(Math.max(0, m.index - 4), m.index);
    const isNeg =
      before.trimEnd().endsWith("-") ||
      /\(\s*$/.test(before) ||
      /^\s*\)/.test(after) ||
      /^\s*-/.test(after) ||
      /^\s*D\b/i.test(after);
    results.push({ raw, isNeg });
  }
  return results;
}

// Extract text lines from PDF preserving spatial structure via Y-coordinates
async function extractLines(pdf: any): Promise<string[]> {
  const lines: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    // Group items by Y position with 3pt tolerance to handle minor vertical drift
    const map = new Map<number, Array<{ x: number; str: string }>>();
    for (const item of content.items as any[]) {
      const str = (item.str || "").trim();
      if (!str) continue;
      const y = Math.round(item.transform[5] / 3) * 3;
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push({ x: item.transform[4], str });
    }

    // Sort lines top-to-bottom (higher Y = higher on PDF page)
    [...map.keys()]
      .sort((a, b) => b - a)
      .forEach(y => {
        const text = map
          .get(y)!
          .sort((a, b) => a.x - b.x)
          .map(i => i.str)
          .join(" ")
          .trim();
        if (text) lines.push(text);
      });
  }

  return lines;
}

export async function parsePDF(file: File): Promise<ParseResult> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const lines = await extractLines(pdf);

  if (lines.length === 0) {
    return {
      records: [],
      errors: [{ row: 0, message: "PDF sem texto extraível. Pode ser um PDF escaneado (imagem)." }],
      headers: [],
      totalIncome: 0,
      totalExpense: 0,
      metadata: { fileType: "pdf", recordCount: 0 },
    };
  }

  // Merge lines: if a line has a date but no amount, combine with the next line
  // (some banks split description across two lines)
  const merged: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i];
    if (DATE_TEST.test(cur) && !AMOUNT_TEST.test(cur) && i + 1 < lines.length) {
      merged.push(cur + " " + lines[i + 1]);
      i++;
    } else {
      merged.push(cur);
    }
  }

  const records: ParsedRecord[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  let totalIncome = 0;
  let totalExpense = 0;

  for (const rawLine of merged) {
    const line = rawLine.trim();
    if (!line || line.length < 6) continue;
    if (IGNORED.some(p => p.test(line))) continue;

    const dateM = line.match(DATE_MATCH);
    if (!dateM) continue;
    const date = parseFlexibleDate(dateM[1]);
    if (!date) continue;

    const amounts = getAmounts(line);
    if (amounts.length === 0) continue;

    // Brazilian bank statements: last amount = running balance (saldo), skip it.
    // Use the second-to-last (or the only one if just 1 amount).
    const chosen = amounts.length >= 2 ? amounts[amounts.length - 2] : amounts[0];
    let amount = parseAmountFlexible(chosen.raw);
    if (amount === null || amount === 0) continue;
    if (chosen.isNeg) amount = -Math.abs(amount);

    // Build description: strip date, all amounts, currency symbols, D/C markers
    let desc = line
      .replace(dateM[0], "")
      .replace(/(?<!\d)[\d]{1,3}(?:[.,]\d{3})*[.,]\d{2}(?!\d)/g, "")
      .replace(/\bR\$\b/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (desc.length < 2) desc = "Movimentação";

    const type = detectType(desc, amount);
    const finalType = type === "unknown" ? (amount >= 0 ? "income" : "expense") : type;
    const abs = Math.abs(amount);
    const category = detectCategory(desc, finalType);

    if (finalType === "income") totalIncome += abs;
    else totalExpense += abs;

    records.push({
      date,
      description: desc,
      amount: abs,
      type: finalType,
      category,
      status: "ok",
      rawData: line,
    });
  }

  if (records.length === 0) {
    errors.push({
      row: 0,
      message:
        "Nenhuma transação identificada no PDF. Verifique se é um extrato bancário válido.",
    });
  }

  const dates = records.map(r => r.date).sort();

  return {
    records,
    errors,
    headers: ["Data", "Descrição", "Valor", "Tipo", "Categoria"],
    totalIncome,
    totalExpense,
    metadata: {
      fileType: "pdf",
      recordCount: records.length,
      startDate: dates[0],
      endDate: dates[dates.length - 1],
    },
  };
}
