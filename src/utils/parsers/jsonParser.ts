import type { ParseResult, ParsedRecord } from "./types";
import { parseDate, parseAmountFlexible, detectType, detectCategory, findColumnIndex, dateColumns, descriptionColumns, amountColumns, typeColumns } from "./helpers";

export async function parseJSON(file: File): Promise<ParseResult> {
  const text = await file.text();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { records: [], errors: [{ row: 0, message: "JSON inválido. Verifique a estrutura do arquivo." }], headers: [], totalIncome: 0, totalExpense: 0, metadata: { fileType: "json", recordCount: 0 } };
  }

  // Handle both array and object with array property
  let items: any[] = [];
  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (typeof parsed === "object") {
    const arrayProp = Object.values(parsed).find(v => Array.isArray(v)) as any[] | undefined;
    if (arrayProp) items = arrayProp;
  }

  if (items.length === 0) {
    return { records: [], errors: [{ row: 0, message: "Nenhum registro encontrado no JSON." }], headers: [], totalIncome: 0, totalExpense: 0, metadata: { fileType: "json", recordCount: 0 } };
  }

  const keys = Object.keys(items[0] || {});
  const dateKey = keys.find(k => dateColumns.some(dc => k.toLowerCase().includes(dc))) || keys.find(k => /dat/i.test(k));
  const descKey = keys.find(k => descriptionColumns.some(dc => k.toLowerCase().includes(dc))) || keys.find(k => /desc|hist|memo/i.test(k));
  const amountKey = keys.find(k => amountColumns.some(ac => k.toLowerCase().includes(ac))) || keys.find(k => /val|amount|total/i.test(k));
  const typeKey = keys.find(k => typeColumns.some(tc => k.toLowerCase().includes(tc))) || keys.find(k => /tipo|type/i.test(k));

  const records: ParsedRecord[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  let totalIncome = 0, totalExpense = 0;

  items.forEach((item, idx) => {
    const dateRaw = dateKey ? item[dateKey] : null;
    const date = parseDate(dateRaw);
    const amountRaw = amountKey ? item[amountKey] : null;
    const amount = parseAmountFlexible(amountRaw);
    const description = descKey ? String(item[descKey] || "Sem descrição") : JSON.stringify(item).slice(0, 100);
    const typeValue = typeKey ? String(item[typeKey] || "") : "";

    if (!date && amount === null) return;
    if (amount === null || amount === 0) {
      errors.push({ row: idx + 1, message: "Valor inválido ou ausente" });
      return;
    }

    const absAmount = Math.abs(amount);
    const type = detectType(description, amount, typeValue);
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
      rawData: item,
    });
  });

  const dates = records.map(r => r.date).sort();
  return {
    records, errors, headers: keys,
    totalIncome, totalExpense,
    metadata: { fileType: "json", recordCount: records.length, startDate: dates[0], endDate: dates[dates.length - 1] },
  };
}
