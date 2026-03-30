import type { ParseResult, ParsedRecord } from "./types";
import { parseDate, parseAmountFlexible, detectType, detectCategory } from "./helpers";

export async function parseTXT(file: File): Promise<ParseResult> {
  const text = await file.text();
  const lines = text.split("\n").filter(l => l.trim().length > 0);

  if (lines.length === 0) {
    return { records: [], errors: [{ row: 0, message: "Arquivo TXT vazio" }], headers: [], totalIncome: 0, totalExpense: 0, metadata: { fileType: "txt", recordCount: 0 } };
  }

  const records: ParsedRecord[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  let totalIncome = 0, totalExpense = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length < 5) continue;

    const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) continue;

    const date = parseDate(dateMatch[1]);
    if (!date) continue;

    const amountMatches = line.match(/[-]?[\d.,]+[,.][\d]{2}/g);
    if (!amountMatches) continue;

    const rawAmount = amountMatches[amountMatches.length - 1];
    const amount = parseAmountFlexible(rawAmount);
    if (amount === null || amount === 0) continue;

    let description = line.replace(dateMatch[0], "").replace(rawAmount, "").replace(/[R$]/g, "").trim().replace(/\s+/g, " ");
    if (description.length < 2) description = "Movimentação";

    const absAmount = Math.abs(amount);
    const type = detectType(description, amount);
    const finalType = type === "unknown" ? (amount >= 0 ? "income" : "expense") : type;
    const category = detectCategory(description, finalType);

    if (finalType === "income") totalIncome += absAmount;
    else totalExpense += absAmount;

    records.push({ date, description, amount: absAmount, type: finalType, category, status: "ok", rawData: line });
  }

  if (records.length === 0) {
    errors.push({ row: 0, message: "Nenhuma transação identificada no arquivo TXT." });
  }

  const dates = records.map(r => r.date).sort();
  return {
    records, errors, headers: ["Data", "Descrição", "Valor", "Tipo", "Categoria"],
    totalIncome, totalExpense,
    metadata: { fileType: "txt", recordCount: records.length, startDate: dates[0], endDate: dates[dates.length - 1] },
  };
}
