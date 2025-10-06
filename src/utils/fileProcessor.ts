import * as XLSX from "xlsx";
import Papa from "papaparse";

export interface ParsedRecord {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense" | "unknown";
  category?: string;
  donor?: string;
  paymentMethod?: string;
  notes?: string;
  rawData?: any;
}

export interface ParseResult {
  records: ParsedRecord[];
  errors: Array<{ row: number; message: string }>;
  headers: string[];
  totalIncome: number;
  totalExpense: number;
}

// Common column name variations for automatic detection
const dateColumns = ["data", "date", "dt", "fecha", "datum"];
const descriptionColumns = [
  "descrição",
  "descricao",
  "description",
  "histórico",
  "historico",
  "history",
  "memo",
  "narration",
];
const amountColumns = [
  "valor",
  "amount",
  "value",
  "montante",
  "total",
  "quantia",
];
const typeColumns = ["tipo", "type", "natureza", "category", "categoria"];
const donorColumns = ["doador", "donor", "nome", "name", "membro", "member"];

function findColumnIndex(headers: string[], possibleNames: string[]): number {
  const normalizedHeaders = headers.map((h) =>
    h.toLowerCase().trim().replace(/[^a-z0-9]/g, "")
  );
  for (const name of possibleNames) {
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const index = normalizedHeaders.findIndex((h) => h.includes(normalized));
    if (index !== -1) return index;
  }
  return -1;
}

function parseDate(dateStr: any): string | null {
  if (!dateStr) return null;

  // If it's already a Date object
  if (dateStr instanceof Date) {
    return dateStr.toISOString().split("T")[0];
  }

  // Try to parse string date
  const str = String(dateStr).trim();

  // Try various date formats
  const formats = [
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
    /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
    /^(\d{2})-(\d{2})-(\d{4})$/, // DD-MM-YYYY
  ];

  for (const format of formats) {
    const match = str.match(format);
    if (match) {
      if (match[0].startsWith("20") || match[0].startsWith("19")) {
        // YYYY-MM-DD
        return `${match[1]}-${match[2]}-${match[3]}`;
      } else {
        // DD/MM/YYYY or DD-MM-YYYY
        return `${match[3]}-${match[2]}-${match[1]}`;
      }
    }
  }

  // Try Excel date number
  if (!isNaN(Number(dateStr))) {
    const excelDate = XLSX.SSF.parse_date_code(Number(dateStr));
    if (excelDate) {
      return `${excelDate.y}-${String(excelDate.m).padStart(2, "0")}-${String(
        excelDate.d
      ).padStart(2, "0")}`;
    }
  }

  return null;
}

function parseAmount(amountStr: any): number | null {
  if (amountStr === null || amountStr === undefined || amountStr === "")
    return null;

  const str = String(amountStr)
    .trim()
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");

  const amount = parseFloat(str);
  return isNaN(amount) ? null : amount;
}

function detectType(
  description: string,
  amount: number,
  typeValue?: string
): "income" | "expense" | "unknown" {
  // Check explicit type column
  if (typeValue) {
    const normalized = typeValue.toLowerCase();
    if (
      normalized.includes("receita") ||
      normalized.includes("entrada") ||
      normalized.includes("income") ||
      normalized.includes("credit") ||
      normalized.includes("dízimo") ||
      normalized.includes("dizimo") ||
      normalized.includes("oferta")
    ) {
      return "income";
    }
    if (
      normalized.includes("despesa") ||
      normalized.includes("saída") ||
      normalized.includes("saida") ||
      normalized.includes("expense") ||
      normalized.includes("debit") ||
      normalized.includes("pagamento")
    ) {
      return "expense";
    }
  }

  // Check amount sign
  if (amount < 0) return "expense";
  if (amount > 0) return "income";

  // Check description keywords
  const desc = description.toLowerCase();
  const incomeKeywords = [
    "dízimo",
    "dizimo",
    "oferta",
    "doação",
    "doacao",
    "contribuição",
    "contribuicao",
    "receita",
  ];
  const expenseKeywords = [
    "despesa",
    "pagamento",
    "conta",
    "aluguel",
    "salário",
    "salario",
    "compra",
    "fornecedor",
  ];

  if (incomeKeywords.some((k) => desc.includes(k))) return "income";
  if (expenseKeywords.some((k) => desc.includes(k))) return "expense";

  return "unknown";
}

function detectCategory(description: string, type: "income" | "expense"): string {
  const desc = description.toLowerCase();

  if (type === "income") {
    if (desc.includes("dízimo") || desc.includes("dizimo")) return "tithe";
    if (desc.includes("oferta")) return "offering";
    if (desc.includes("projeto") || desc.includes("campanha"))
      return "special_project";
    return "offering";
  } else {
    if (desc.includes("manutenção") || desc.includes("manutencao") || desc.includes("reparo"))
      return "maintenance";
    if (
      desc.includes("luz") ||
      desc.includes("água") ||
      desc.includes("agua") ||
      desc.includes("telefone") ||
      desc.includes("internet")
    )
      return "utilities";
    if (desc.includes("salário") || desc.includes("salario")) return "salaries";
    if (desc.includes("evento") || desc.includes("culto")) return "events";
    if (desc.includes("missão") || desc.includes("missao") || desc.includes("missionário"))
      return "missions";
    return "other";
  }
}

export async function processExcelFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
          header: 1,
          raw: false,
          dateNF: "yyyy-mm-dd",
        }) as any[][];

        if (jsonData.length < 2) {
          resolve({
            records: [],
            errors: [{ row: 0, message: "Arquivo vazio ou sem dados" }],
            headers: [],
            totalIncome: 0,
            totalExpense: 0,
          });
          return;
        }

        const headers = jsonData[0].map((h) => String(h || "").trim());
        const dateIdx = findColumnIndex(headers, dateColumns);
        const descIdx = findColumnIndex(headers, descriptionColumns);
        const amountIdx = findColumnIndex(headers, amountColumns);
        const typeIdx = findColumnIndex(headers, typeColumns);
        const donorIdx = findColumnIndex(headers, donorColumns);

        const records: ParsedRecord[] = [];
        const errors: Array<{ row: number; message: string }> = [];
        let totalIncome = 0;
        let totalExpense = 0;

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0 || row.every((cell) => !cell)) continue;

          const date = dateIdx >= 0 ? parseDate(row[dateIdx]) : null;
          const description =
            descIdx >= 0 ? String(row[descIdx] || "").trim() : "";
          const amount =
            amountIdx >= 0 ? parseAmount(row[amountIdx]) : null;
          const typeValue = typeIdx >= 0 ? String(row[typeIdx] || "") : "";
          const donor = donorIdx >= 0 ? String(row[donorIdx] || "").trim() : "";

          if (!date) {
            errors.push({
              row: i + 1,
              message: "Data inválida ou ausente",
            });
            continue;
          }

          if (amount === null || amount === 0) {
            errors.push({
              row: i + 1,
              message: "Valor inválido ou ausente",
            });
            continue;
          }

          if (!description) {
            errors.push({
              row: i + 1,
              message: "Descrição ausente",
            });
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
            type,
            category,
            donor: donor || undefined,
            rawData: row,
          });
        }

        resolve({
          records,
          errors,
          headers,
          totalIncome,
          totalExpense,
        });
      } catch (error: any) {
        reject(new Error(`Erro ao processar Excel: ${error.message}`));
      }
    };

    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsArrayBuffer(file);
  });
}

export async function processCSVFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      complete: (results) => {
        try {
          const data = results.data as any[][];

          if (data.length < 2) {
            resolve({
              records: [],
              errors: [{ row: 0, message: "Arquivo CSV vazio ou sem dados" }],
              headers: [],
              totalIncome: 0,
              totalExpense: 0,
            });
            return;
          }

          const headers = data[0].map((h) => String(h || "").trim());
          const dateIdx = findColumnIndex(headers, dateColumns);
          const descIdx = findColumnIndex(headers, descriptionColumns);
          const amountIdx = findColumnIndex(headers, amountColumns);
          const typeIdx = findColumnIndex(headers, typeColumns);
          const donorIdx = findColumnIndex(headers, donorColumns);

          const records: ParsedRecord[] = [];
          const errors: Array<{ row: number; message: string }> = [];
          let totalIncome = 0;
          let totalExpense = 0;

          for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0 || row.every((cell) => !cell))
              continue;

            const date = dateIdx >= 0 ? parseDate(row[dateIdx]) : null;
            const description =
              descIdx >= 0 ? String(row[descIdx] || "").trim() : "";
            const amount = amountIdx >= 0 ? parseAmount(row[amountIdx]) : null;
            const typeValue = typeIdx >= 0 ? String(row[typeIdx] || "") : "";
            const donor =
              donorIdx >= 0 ? String(row[donorIdx] || "").trim() : "";

            if (!date) {
              errors.push({
                row: i + 1,
                message: "Data inválida ou ausente",
              });
              continue;
            }

            if (amount === null || amount === 0) {
              errors.push({
                row: i + 1,
                message: "Valor inválido ou ausente",
              });
              continue;
            }

            if (!description) {
              errors.push({
                row: i + 1,
                message: "Descrição ausente",
              });
              continue;
            }

            const absAmount = Math.abs(amount);
            const type = detectType(description, amount, typeValue);
            const category =
              type !== "unknown" ? detectCategory(description, type) : undefined;

            if (type === "income") totalIncome += absAmount;
            else if (type === "expense") totalExpense += absAmount;

            records.push({
              date,
              description,
              amount: absAmount,
              type,
              category,
              donor: donor || undefined,
              rawData: row,
            });
          }

          resolve({
            records,
            errors,
            headers,
            totalIncome,
            totalExpense,
          });
        } catch (error: any) {
          reject(new Error(`Erro ao processar CSV: ${error.message}`));
        }
      },
      error: (error) => {
        reject(new Error(`Erro ao ler CSV: ${error.message}`));
      },
      skipEmptyLines: true,
    });
  });
}

export async function processPDFFile(file: File): Promise<ParseResult> {
  // For PDF processing, we'll use a simplified approach
  // In a real implementation, you'd use pdf-parse or similar library
  // For now, we'll return an error suggesting manual entry
  return Promise.reject(
    new Error(
      "Processamento de PDF requer análise avançada. Por favor, converta o PDF para Excel ou CSV primeiro."
    )
  );
}

export async function processFile(file: File): Promise<ParseResult> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "xlsx":
    case "xls":
      return processExcelFile(file);
    case "csv":
      return processCSVFile(file);
    case "pdf":
      return processPDFFile(file);
    default:
      throw new Error(
        "Formato de arquivo não suportado. Use Excel (.xlsx, .xls), CSV ou PDF."
      );
  }
}
