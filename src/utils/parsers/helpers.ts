import * as XLSX from "xlsx";

// Column name variations for automatic detection
export const dateColumns = [
  "data", "date", "dt", "fecha", "datum", "dia", "day",
  "data_lancamento", "data_transacao", "dt_lanc", "dt_mov",
  "data_movimento", "data_pgto", "data_pag", "vencimento"
];

export const descriptionColumns = [
  "descrição", "descricao", "description", "histórico", "historico",
  "history", "memo", "narration", "finalidade", "observacao", "obs",
  "observações", "detalhe", "detalhes", "motivo", "referencia",
  "lancamento", "lançamento", "item", "produto", "servico", "serviço"
];

export const amountColumns = [
  "valor", "amount", "value", "montante", "total", "quantia",
  "vl", "vlr", "preco", "preço", "price", "custo", "cost",
  "entrada", "saida", "saída", "credito", "crédito", "debito", "débito",
  "receita", "despesa", "pagamento", "recebimento"
];

export const typeColumns = [
  "tipo", "type", "natureza", "category", "categoria",
  "classificacao", "classificação", "operacao", "operação",
  "movimento", "mov", "d/c", "dc", "entrada_saida"
];

export const donorColumns = [
  "doador", "donor", "nome", "name", "membro", "member",
  "pessoa", "cliente", "fornecedor", "pagador", "beneficiario",
  "origem", "destinatario", "responsavel"
];

export function normalize(str: string): string {
  return str.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

export function findColumnIndex(headers: string[], possibleNames: string[]): number {
  const normalizedHeaders = headers.map(h => normalize(String(h || "")));
  for (const name of possibleNames) {
    const normalized = normalize(name);
    const exactIndex = normalizedHeaders.findIndex(h => h === normalized);
    if (exactIndex !== -1) return exactIndex;
    const containsIndex = normalizedHeaders.findIndex(h => h.includes(normalized) || normalized.includes(h));
    if (containsIndex !== -1) return containsIndex;
  }
  return -1;
}

export function isLikelyDate(str: string): boolean {
  if (!str) return false;
  const s = String(str).trim();
  const datePatterns = [
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,
    /^\d{4}-\d{2}-\d{2}$/,
    /^\d{1,2}-\d{1,2}-\d{2,4}$/,
    /^\d{1,2}\.\d{1,2}\.\d{2,4}$/,
    /^\d{8}$/,
  ];
  for (const pattern of datePatterns) {
    if (pattern.test(s)) return true;
  }
  const num = Number(s);
  if (!isNaN(num) && num > 25000 && num < 60000) return true;
  return false;
}

export function parseDate(dateStr: any): string | null {
  if (!dateStr) return null;
  if (dateStr instanceof Date && !isNaN(dateStr.getTime())) {
    return dateStr.toISOString().split("T")[0];
  }
  const str = String(dateStr).trim();
  const patterns: Array<{ regex: RegExp; format: (m: RegExpMatchArray) => string }> = [
    { regex: /^(\d{2})\/(\d{2})\/(\d{4})$/, format: (m) => `${m[3]}-${m[2]}-${m[1]}` },
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, format: (m) => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` },
    { regex: /^(\d{4})-(\d{2})-(\d{2})$/, format: (m) => `${m[1]}-${m[2]}-${m[3]}` },
    { regex: /^(\d{2})-(\d{2})-(\d{4})$/, format: (m) => `${m[3]}-${m[2]}-${m[1]}` },
    { regex: /^(\d{2})\.(\d{2})\.(\d{4})$/, format: (m) => `${m[3]}-${m[2]}-${m[1]}` },
    { regex: /^(\d{4})(\d{2})(\d{2})$/, format: (m) => `${m[1]}-${m[2]}-${m[3]}` },
    { regex: /^(\d{2})(\d{2})(\d{4})$/, format: (m) => `${m[3]}-${m[2]}-${m[1]}` },
  ];
  for (const { regex, format } of patterns) {
    const match = str.match(regex);
    if (match) {
      const result = format(match);
      const [y, m, d] = result.split('-').map(Number);
      if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return result;
      }
    }
  }
  if (!isNaN(Number(dateStr))) {
    try {
      const excelDate = XLSX.SSF.parse_date_code(Number(dateStr));
      if (excelDate && excelDate.y >= 1900) {
        return `${excelDate.y}-${String(excelDate.m).padStart(2, "0")}-${String(excelDate.d).padStart(2, "0")}`;
      }
    } catch { /* ignore */ }
  }
  const nativeDate = new Date(str);
  if (!isNaN(nativeDate.getTime()) && nativeDate.getFullYear() >= 1900) {
    return nativeDate.toISOString().split("T")[0];
  }
  return null;
}

export function parseAmountFlexible(amountStr: any): number | null {
  if (amountStr === null || amountStr === undefined || amountStr === "") return null;
  let str = String(amountStr).trim();
  str = str.replace(/^[R$€£¥\s]+|[R$€£¥\s]+$/gi, "");
  const isNegative = str.includes("(") || str.startsWith("-") || /\bD\b/i.test(str);
  str = str.replace(/[()]/g, "").replace(/[^\d,.-]/g, "");
  const hasCommaDot = str.includes(",") && str.includes(".");
  const commaIndex = str.lastIndexOf(",");
  const dotIndex = str.lastIndexOf(".");
  if (hasCommaDot) {
    if (commaIndex > dotIndex) {
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      str = str.replace(/,/g, "");
    }
  } else if (str.includes(",")) {
    const parts = str.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      str = str.replace(",", ".");
    } else {
      str = str.replace(/,/g, "");
    }
  }
  const amount = parseFloat(str);
  if (isNaN(amount)) return null;
  return isNegative ? -Math.abs(amount) : amount;
}

export function detectType(
  description: string, amount: number, typeValue?: string
): "income" | "expense" | "unknown" {
  if (typeValue) {
    const normalized = normalize(typeValue);
    const incomePatterns = ["receita", "entrada", "income", "credit", "credito", "c", "dizimo", "oferta", "doacao", "contribuicao", "recebimento", "deposito", "recebido", "rec"];
    if (incomePatterns.some(p => normalized.includes(p) || normalized === p)) return "income";
    const expensePatterns = ["despesa", "saida", "expense", "debit", "debito", "d", "pagamento", "pago", "compra", "transferencia", "transf", "pag"];
    if (expensePatterns.some(p => normalized.includes(p) || normalized === p)) return "expense";
  }
  if (amount < 0) return "expense";
  const desc = normalize(description);
  const incomeKeywords = ["dizimo", "oferta", "doacao", "contribuicao", "receita", "recebimento", "deposito", "entrada", "credito", "recebido", "arrecadacao", "coleta", "campanha", "projeto especial", "pix recebido", "transferencia recebida"];
  const expenseKeywords = ["despesa", "pagamento", "conta", "aluguel", "salario", "compra", "fornecedor", "manutencao", "luz", "agua", "telefone", "internet", "combustivel", "transporte", "material", "equipamento", "taxa", "imposto", "debito", "transferencia enviada", "pago", "saida", "boleto", "fatura", "energia"];
  if (incomeKeywords.some(k => desc.includes(k))) return "income";
  if (expenseKeywords.some(k => desc.includes(k))) return "expense";
  if (amount > 0) return "income";
  return "unknown";
}

export function detectCategory(description: string, type: "income" | "expense"): string {
  const desc = normalize(description);
  if (type === "income") {
    if (desc.includes("dizimo")) return "tithe";
    if (desc.includes("oferta") || desc.includes("coleta")) return "offering";
    if (desc.includes("projeto") || desc.includes("especial")) return "special_project";
    if (desc.includes("campanha")) return "campaign";
    return "offering";
  } else {
    if (desc.includes("manutencao") || desc.includes("reparo") || desc.includes("conserto")) return "maintenance";
    if (desc.includes("luz") || desc.includes("energia") || desc.includes("agua") || desc.includes("telefone") || desc.includes("internet") || desc.includes("gas")) return "utilities";
    if (desc.includes("salario") || desc.includes("pastor") || desc.includes("funcionario")) return "salaries";
    if (desc.includes("evento") || desc.includes("culto") || desc.includes("celebracao")) return "events";
    if (desc.includes("missao") || desc.includes("missionario") || desc.includes("evangelismo")) return "missions";
    if (desc.includes("material") || desc.includes("escritorio") || desc.includes("limpeza")) return "supplies";
    return "other";
  }
}

export function analyzeColumnContent(data: any[][], colIndex: number) {
  let dateCount = 0, numericCount = 0, textCount = 0, negativeCount = 0, totalSamples = 0;
  for (let i = 1; i < Math.min(data.length, 20); i++) {
    const cell = data[i]?.[colIndex];
    if (cell === null || cell === undefined || cell === "") continue;
    totalSamples++;
    const str = String(cell).trim();
    if (isLikelyDate(str)) dateCount++;
    const numVal = parseAmountFlexible(str);
    if (numVal !== null) { numericCount++; if (numVal < 0) negativeCount++; }
    if (/[a-zA-ZÀ-ÿ]/.test(str) && str.length > 2) textCount++;
  }
  return {
    isDate: totalSamples > 0 && dateCount / totalSamples > 0.5,
    isNumeric: totalSamples > 0 && numericCount / totalSamples > 0.5,
    isText: totalSamples > 0 && textCount / totalSamples > 0.5,
    hasNegatives: negativeCount > 0,
  };
}

export function autoDetectColumns(headers: string[], data: any[][]) {
  let dateIdx = findColumnIndex(headers, dateColumns);
  let descIdx = findColumnIndex(headers, descriptionColumns);
  let amountIdx = findColumnIndex(headers, amountColumns);
  let typeIdx = findColumnIndex(headers, typeColumns);
  let donorIdx = findColumnIndex(headers, donorColumns);

  const analyses = headers.map((_, idx) => ({ idx, analysis: analyzeColumnContent(data, idx) }));

  if (dateIdx === -1) {
    const dateCol = analyses.find(a => a.analysis.isDate);
    if (dateCol) dateIdx = dateCol.idx;
  }
  if (amountIdx === -1) {
    const amountCol = analyses.find(a => a.analysis.isNumeric && !a.analysis.isDate);
    if (amountCol) amountIdx = amountCol.idx;
  }
  if (descIdx === -1) {
    const textCols = analyses.filter(a => a.analysis.isText && a.idx !== dateIdx && a.idx !== amountIdx);
    if (textCols.length > 0) {
      let bestIdx = -1, maxAvgLen = 0;
      for (const col of textCols) {
        let totalLen = 0, count = 0;
        for (let i = 1; i < Math.min(data.length, 10); i++) {
          const cell = data[i]?.[col.idx];
          if (cell) { totalLen += String(cell).length; count++; }
        }
        const avgLen = count > 0 ? totalLen / count : 0;
        if (avgLen > maxAvgLen) { maxAvgLen = avgLen; bestIdx = col.idx; }
      }
      if (bestIdx !== -1) descIdx = bestIdx;
    }
  }
  return { dateIdx, descIdx, amountIdx, typeIdx, donorIdx };
}

export function buildDescription(row: any[], headers: string[], descIdx: number): string {
  let description = descIdx >= 0 ? String(row[descIdx] || "").trim() : "";
  if (description.length < 3 || /^[\d\s-]+$/.test(description)) {
    const additionalInfo: string[] = [];
    for (let i = 0; i < row.length; i++) {
      if (i === descIdx) continue;
      const cell = String(row[i] || "").trim();
      if (isLikelyDate(cell) || parseAmountFlexible(cell) !== null) continue;
      if (cell.length > 3 && /[a-zA-ZÀ-ÿ]/.test(cell)) additionalInfo.push(cell);
    }
    if (additionalInfo.length > 0) description = additionalInfo.join(" - ");
  }
  return description || "Sem descrição";
}

export function processRowData(
  data: any[][],
  headers: string[],
  headerRowIdx: number
) {
  const { dateIdx, descIdx, amountIdx, typeIdx, donorIdx } = autoDetectColumns(headers, data);
  const records: import("./types").ParsedRecord[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  let totalIncome = 0, totalExpense = 0;

  for (let i = headerRowIdx + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0 || row.every(cell => !cell)) continue;

    let date: string | null = null;
    if (dateIdx >= 0) date = parseDate(row[dateIdx]);
    if (!date) {
      for (const cell of row) {
        const parsed = parseDate(cell);
        if (parsed) { date = parsed; break; }
      }
    }

    let amount: number | null = null;
    if (amountIdx >= 0) amount = parseAmountFlexible(row[amountIdx]);
    if (amount === null) {
      for (let j = 0; j < row.length; j++) {
        const parsed = parseAmountFlexible(row[j]);
        if (parsed !== null && !isLikelyDate(String(row[j]))) { amount = parsed; break; }
      }
    }

    const description = buildDescription(row, headers, descIdx);
    const typeValue = typeIdx >= 0 ? String(row[typeIdx] || "") : "";
    const donor = donorIdx >= 0 ? String(row[donorIdx] || "").trim() : "";

    if (!date && amount === null) continue;
    if (!date) date = new Date().toISOString().split("T")[0];
    if (amount === null || amount === 0) {
      errors.push({ row: i + 1, message: "Valor inválido ou ausente" });
      continue;
    }

    const absAmount = Math.abs(amount);
    const type = detectType(description, amount, typeValue);
    const category = type !== "unknown" ? detectCategory(description, type) : undefined;

    if (type === "income") totalIncome += absAmount;
    else if (type === "expense") totalExpense += absAmount;

    records.push({
      date,
      description,
      amount: absAmount,
      type: type === "unknown" ? "income" : type,
      category: category || (type === "income" || type === "unknown" ? "offering" : "other"),
      donor: donor || undefined,
      rawData: row,
      status: "ok",
    });
  }

  return { records, errors, headers, totalIncome, totalExpense };
}
