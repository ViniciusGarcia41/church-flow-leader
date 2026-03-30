import type { ParseResult, ParsedRecord } from "./types";
import { parseDate, parseAmountFlexible, detectType, detectCategory } from "./helpers";

export async function parsePDF(file: File): Promise<ParseResult> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(" ");
    fullText += pageText + "\n";
  }

  if (!fullText.trim()) {
    return {
      records: [],
      errors: [{ row: 0, message: "PDF sem texto extraível. Pode ser um PDF escaneado (imagem)." }],
      headers: [],
      totalIncome: 0,
      totalExpense: 0,
      metadata: { fileType: "pdf", recordCount: 0 },
    };
  }

  const records: ParsedRecord[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  let totalIncome = 0, totalExpense = 0;

  // Try to extract transactions line-by-line
  const lines = fullText.split("\n").flatMap(l => l.split(/(?=\d{2}\/\d{2}\/\d{4})/));

  const ignoredPatterns = [
    /ouvidoria/i, /extrato gerado/i, /sac/i, /central de atendimento/i,
    /^\s*$/, /página/i, /telefone/i, /www\./i, /cnpj/i,
  ];

  let lineNum = 0;
  for (const rawLine of lines) {
    lineNum++;
    const line = rawLine.trim();
    if (!line || line.length < 8) continue;
    if (ignoredPatterns.some(p => p.test(line))) continue;

    // Try to find a date in the line
    const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (!dateMatch) continue;

    const date = parseDate(dateMatch[1]);
    if (!date) continue;

    // Try to find amounts (possibly multiple)
    const amountMatches = line.match(/[R$\s]*[\d.,]+[,.][\d]{2}/g);
    if (!amountMatches || amountMatches.length === 0) continue;

    // Take the last amount as the transaction value
    const rawAmount = amountMatches[amountMatches.length - 1];
    const amount = parseAmountFlexible(rawAmount);
    if (amount === null || amount === 0) continue;

    // Extract description: everything between date and amount
    let description = line
      .replace(dateMatch[0], "")
      .replace(rawAmount, "")
      .replace(/[R$]/g, "")
      .trim()
      .replace(/\s+/g, " ");

    if (description.length < 2) description = "Movimentação";

    // Detect type from description and amount sign
    const descLower = description.toLowerCase();
    let type: "income" | "expense" | "unknown" = "unknown";

    if (descLower.includes("transferência recebida") || descLower.includes("pix recebido") || descLower.includes("depósito") || descLower.includes("crédito")) {
      type = "income";
    } else if (descLower.includes("transferência enviada") || descLower.includes("pix enviado") || descLower.includes("pagamento") || descLower.includes("boleto") || descLower.includes("fatura") || descLower.includes("débito")) {
      type = "expense";
    } else {
      type = detectType(description, amount);
    }

    const absAmount = Math.abs(amount);
    const finalType = type === "unknown" ? (amount >= 0 ? "income" : "expense") : type;
    const category = detectCategory(description, finalType);

    if (finalType === "income") totalIncome += absAmount;
    else totalExpense += absAmount;

    records.push({
      date,
      description,
      amount: absAmount,
      type: finalType,
      category,
      status: "ok",
      rawData: line,
    });
  }

  if (records.length === 0) {
    errors.push({ row: 0, message: "Nenhuma transação identificada no PDF. Verifique se é um extrato bancário válido." });
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
