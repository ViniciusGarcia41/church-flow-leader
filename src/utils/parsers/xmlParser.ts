import type { ParseResult, ParsedRecord } from "./types";
import { parseDate, parseAmountFlexible, detectType, detectCategory } from "./helpers";

export async function parseXML(file: File): Promise<ParseResult> {
  const text = await file.text();
  let doc: Document;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(text, "text/xml");
    const parseError = doc.querySelector("parsererror");
    if (parseError) {
      return { records: [], errors: [{ row: 0, message: "XML inválido. Verifique a estrutura do arquivo." }], headers: [], totalIncome: 0, totalExpense: 0, metadata: { fileType: "xml", recordCount: 0 } };
    }
  } catch {
    return { records: [], errors: [{ row: 0, message: "Erro ao ler XML." }], headers: [], totalIncome: 0, totalExpense: 0, metadata: { fileType: "xml", recordCount: 0 } };
  }

  // Find repeating elements (likely transaction rows)
  const allElements = doc.querySelectorAll("*");
  const tagCounts: Record<string, number> = {};
  allElements.forEach(el => {
    const tag = el.tagName;
    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  });

  // Find the most common repeating element (likely transaction rows)
  const repeatingTag = Object.entries(tagCounts)
    .filter(([_, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .find(([tag]) => {
      const first = doc.querySelector(tag);
      return first && first.children.length >= 2;
    });

  if (!repeatingTag) {
    return { records: [], errors: [{ row: 0, message: "Nenhuma estrutura de transação identificada no XML." }], headers: [], totalIncome: 0, totalExpense: 0, metadata: { fileType: "xml", recordCount: 0 } };
  }

  const elements = doc.querySelectorAll(repeatingTag[0]);
  const records: ParsedRecord[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  let totalIncome = 0, totalExpense = 0;
  const headers: string[] = [];

  elements.forEach((el, idx) => {
    const fields: Record<string, string> = {};
    Array.from(el.children).forEach(child => {
      fields[child.tagName] = child.textContent?.trim() || "";
      if (idx === 0 && !headers.includes(child.tagName)) headers.push(child.tagName);
    });

    const dateVal = Object.entries(fields).find(([k]) => /dat/i.test(k));
    const amountVal = Object.entries(fields).find(([k]) => /val|amount|total|preco/i.test(k));
    const descVal = Object.entries(fields).find(([k]) => /desc|hist|memo|obs/i.test(k));
    const typeVal = Object.entries(fields).find(([k]) => /tipo|type|nat/i.test(k));

    const date = dateVal ? parseDate(dateVal[1]) : null;
    const amount = amountVal ? parseAmountFlexible(amountVal[1]) : null;
    const description = descVal ? descVal[1] : Object.values(fields).join(" - ").slice(0, 100);

    if (!date && amount === null) return;
    if (amount === null || amount === 0) {
      errors.push({ row: idx + 1, message: "Valor inválido" });
      return;
    }

    const absAmount = Math.abs(amount);
    const type = detectType(description, amount, typeVal?.[1]);
    const finalType = type === "unknown" ? (amount >= 0 ? "income" : "expense") : type;
    const category = detectCategory(description, finalType);

    if (finalType === "income") totalIncome += absAmount;
    else totalExpense += absAmount;

    records.push({
      date: date || new Date().toISOString().split("T")[0],
      description,
      amount: absAmount,
      type: finalType,
      category,
      status: "ok",
      rawData: fields,
    });
  });

  const dates = records.map(r => r.date).sort();
  return {
    records, errors, headers,
    totalIncome, totalExpense,
    metadata: { fileType: "xml", recordCount: records.length, startDate: dates[0], endDate: dates[dates.length - 1] },
  };
}
