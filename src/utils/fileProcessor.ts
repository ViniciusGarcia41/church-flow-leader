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

// Expanded column name variations for automatic detection
const dateColumns = [
  "data", "date", "dt", "fecha", "datum", "dia", "day", 
  "data_lancamento", "data_transacao", "dt_lanc", "dt_mov",
  "data_movimento", "data_pgto", "data_pag", "vencimento"
];

const descriptionColumns = [
  "descrição", "descricao", "description", "histórico", "historico",
  "history", "memo", "narration", "finalidade", "observacao", "obs",
  "observações", "detalhe", "detalhes", "motivo", "referencia",
  "lancamento", "lançamento", "item", "produto", "servico", "serviço"
];

const amountColumns = [
  "valor", "amount", "value", "montante", "total", "quantia",
  "vl", "vlr", "preco", "preço", "price", "custo", "cost",
  "entrada", "saida", "saída", "credito", "crédito", "debito", "débito",
  "receita", "despesa", "pagamento", "recebimento"
];

const typeColumns = [
  "tipo", "type", "natureza", "category", "categoria", 
  "classificacao", "classificação", "operacao", "operação",
  "movimento", "mov", "d/c", "dc", "entrada_saida"
];

const donorColumns = [
  "doador", "donor", "nome", "name", "membro", "member",
  "pessoa", "cliente", "fornecedor", "pagador", "beneficiario",
  "origem", "destinatario", "responsavel"
];

// Smart column detection with fuzzy matching
function findColumnIndex(headers: string[], possibleNames: string[]): number {
  const normalizedHeaders = headers.map((h) =>
    String(h || "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")
  );
  
  for (const name of possibleNames) {
    const normalized = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    
    // Exact match
    const exactIndex = normalizedHeaders.findIndex((h) => h === normalized);
    if (exactIndex !== -1) return exactIndex;
    
    // Contains match
    const containsIndex = normalizedHeaders.findIndex((h) => h.includes(normalized) || normalized.includes(h));
    if (containsIndex !== -1) return containsIndex;
  }
  return -1;
}

// Heuristic analysis to detect column types by content
function analyzeColumnContent(data: any[][], colIndex: number): {
  isDate: boolean;
  isNumeric: boolean;
  isText: boolean;
  hasNegatives: boolean;
} {
  let dateCount = 0;
  let numericCount = 0;
  let textCount = 0;
  let negativeCount = 0;
  let totalSamples = 0;

  for (let i = 1; i < Math.min(data.length, 20); i++) {
    const cell = data[i]?.[colIndex];
    if (cell === null || cell === undefined || cell === "") continue;
    
    totalSamples++;
    const str = String(cell).trim();
    
    // Check if date
    if (isLikelyDate(str)) dateCount++;
    
    // Check if numeric
    const numVal = parseAmountFlexible(str);
    if (numVal !== null) {
      numericCount++;
      if (numVal < 0) negativeCount++;
    }
    
    // Check if text (has letters)
    if (/[a-zA-ZÀ-ÿ]/.test(str) && str.length > 2) textCount++;
  }

  return {
    isDate: totalSamples > 0 && dateCount / totalSamples > 0.5,
    isNumeric: totalSamples > 0 && numericCount / totalSamples > 0.5,
    isText: totalSamples > 0 && textCount / totalSamples > 0.5,
    hasNegatives: negativeCount > 0,
  };
}

// Auto-detect columns when headers don't match known patterns
function autoDetectColumns(headers: string[], data: any[][]): {
  dateIdx: number;
  descIdx: number;
  amountIdx: number;
  typeIdx: number;
  donorIdx: number;
} {
  // First try standard detection
  let dateIdx = findColumnIndex(headers, dateColumns);
  let descIdx = findColumnIndex(headers, descriptionColumns);
  let amountIdx = findColumnIndex(headers, amountColumns);
  let typeIdx = findColumnIndex(headers, typeColumns);
  let donorIdx = findColumnIndex(headers, donorColumns);

  // If any critical columns are missing, use heuristic detection
  const analyses: Array<{ idx: number; analysis: ReturnType<typeof analyzeColumnContent> }> = [];
  
  for (let i = 0; i < headers.length; i++) {
    analyses.push({ idx: i, analysis: analyzeColumnContent(data, i) });
  }

  // Find date column by content if not found by header
  if (dateIdx === -1) {
    const dateCol = analyses.find(a => a.analysis.isDate);
    if (dateCol) dateIdx = dateCol.idx;
  }

  // Find amount column by content (numeric with possible negatives)
  if (amountIdx === -1) {
    const amountCol = analyses.find(a => a.analysis.isNumeric && !a.analysis.isDate);
    if (amountCol) amountIdx = amountCol.idx;
  }

  // Find description column (longest text content, not already assigned)
  if (descIdx === -1) {
    const textCols = analyses.filter(a => 
      a.analysis.isText && 
      a.idx !== dateIdx && 
      a.idx !== amountIdx
    );
    if (textCols.length > 0) {
      // Pick the one with longest average text
      let bestIdx = -1;
      let maxAvgLen = 0;
      for (const col of textCols) {
        let totalLen = 0;
        let count = 0;
        for (let i = 1; i < Math.min(data.length, 10); i++) {
          const cell = data[i]?.[col.idx];
          if (cell) {
            totalLen += String(cell).length;
            count++;
          }
        }
        const avgLen = count > 0 ? totalLen / count : 0;
        if (avgLen > maxAvgLen) {
          maxAvgLen = avgLen;
          bestIdx = col.idx;
        }
      }
      if (bestIdx !== -1) descIdx = bestIdx;
    }
  }

  return { dateIdx, descIdx, amountIdx, typeIdx, donorIdx };
}

function isLikelyDate(str: string): boolean {
  if (!str) return false;
  const s = String(str).trim();
  
  // Check common date patterns
  const datePatterns = [
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,      // DD/MM/YYYY or D/M/YY
    /^\d{4}-\d{2}-\d{2}$/,               // YYYY-MM-DD
    /^\d{1,2}-\d{1,2}-\d{2,4}$/,         // DD-MM-YYYY
    /^\d{1,2}\.\d{1,2}\.\d{2,4}$/,       // DD.MM.YYYY
    /^\d{8}$/,                            // YYYYMMDD or DDMMYYYY
  ];
  
  for (const pattern of datePatterns) {
    if (pattern.test(s)) return true;
  }
  
  // Check if it's an Excel date number (typically 30000-50000 for recent dates)
  const num = Number(s);
  if (!isNaN(num) && num > 25000 && num < 60000) return true;
  
  return false;
}

function parseDate(dateStr: any): string | null {
  if (!dateStr) return null;

  // If it's already a Date object
  if (dateStr instanceof Date && !isNaN(dateStr.getTime())) {
    return dateStr.toISOString().split("T")[0];
  }

  const str = String(dateStr).trim();

  // Try various date formats
  const patterns: Array<{ regex: RegExp; format: (m: RegExpMatchArray) => string }> = [
    { 
      regex: /^(\d{2})\/(\d{2})\/(\d{4})$/, 
      format: (m) => `${m[3]}-${m[2]}-${m[1]}` // DD/MM/YYYY
    },
    { 
      regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, 
      format: (m) => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` // D/M/YYYY
    },
    { 
      regex: /^(\d{4})-(\d{2})-(\d{2})$/, 
      format: (m) => `${m[1]}-${m[2]}-${m[3]}` // YYYY-MM-DD
    },
    { 
      regex: /^(\d{2})-(\d{2})-(\d{4})$/, 
      format: (m) => `${m[3]}-${m[2]}-${m[1]}` // DD-MM-YYYY
    },
    { 
      regex: /^(\d{2})\.(\d{2})\.(\d{4})$/, 
      format: (m) => `${m[3]}-${m[2]}-${m[1]}` // DD.MM.YYYY
    },
    { 
      regex: /^(\d{4})(\d{2})(\d{2})$/, 
      format: (m) => `${m[1]}-${m[2]}-${m[3]}` // YYYYMMDD
    },
    { 
      regex: /^(\d{2})(\d{2})(\d{4})$/, 
      format: (m) => `${m[3]}-${m[2]}-${m[1]}` // DDMMYYYY
    },
  ];

  for (const { regex, format } of patterns) {
    const match = str.match(regex);
    if (match) {
      const result = format(match);
      // Validate the result
      const [y, m, d] = result.split('-').map(Number);
      if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return result;
      }
    }
  }

  // Try Excel date number
  if (!isNaN(Number(dateStr))) {
    try {
      const excelDate = XLSX.SSF.parse_date_code(Number(dateStr));
      if (excelDate && excelDate.y >= 1900) {
        return `${excelDate.y}-${String(excelDate.m).padStart(2, "0")}-${String(
          excelDate.d
        ).padStart(2, "0")}`;
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Try native Date parsing as last resort
  const nativeDate = new Date(str);
  if (!isNaN(nativeDate.getTime()) && nativeDate.getFullYear() >= 1900) {
    return nativeDate.toISOString().split("T")[0];
  }

  return null;
}

function parseAmountFlexible(amountStr: any): number | null {
  if (amountStr === null || amountStr === undefined || amountStr === "") return null;

  let str = String(amountStr).trim();
  
  // Remove currency symbols and common prefixes
  str = str.replace(/^[R$€£¥\s]+|[R$€£¥\s]+$/gi, "");
  
  // Detect if negative (parentheses, minus sign, "D" for debit)
  const isNegative = str.includes("(") || str.startsWith("-") || /\bD\b/i.test(str);
  
  // Remove non-numeric except decimal separators
  str = str.replace(/[()]/g, "").replace(/[^\d,.-]/g, "");
  
  // Handle Brazilian format (1.234,56) vs US format (1,234.56)
  const hasCommaDot = str.includes(",") && str.includes(".");
  const commaIndex = str.lastIndexOf(",");
  const dotIndex = str.lastIndexOf(".");
  
  if (hasCommaDot) {
    if (commaIndex > dotIndex) {
      // Brazilian: 1.234,56 -> comma is decimal
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      // US: 1,234.56 -> dot is decimal
      str = str.replace(/,/g, "");
    }
  } else if (str.includes(",")) {
    // Only comma: could be decimal or thousands
    const parts = str.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      // Likely decimal: 1234,56
      str = str.replace(",", ".");
    } else {
      // Likely thousands: 1,234
      str = str.replace(/,/g, "");
    }
  }

  const amount = parseFloat(str);
  if (isNaN(amount)) return null;
  
  return isNegative ? -Math.abs(amount) : amount;
}

function detectType(
  description: string,
  amount: number,
  typeValue?: string,
  allRowData?: any[]
): "income" | "expense" | "unknown" {
  // Check explicit type column
  if (typeValue) {
    const normalized = typeValue.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Income indicators
    const incomePatterns = [
      "receita", "entrada", "income", "credit", "credito", "c",
      "dizimo", "dízimo", "oferta", "doacao", "doação", "contribuicao",
      "recebimento", "deposito", "depósito", "recebido", "rec"
    ];
    
    if (incomePatterns.some(p => normalized.includes(p) || normalized === p)) {
      return "income";
    }
    
    // Expense indicators
    const expensePatterns = [
      "despesa", "saida", "saída", "expense", "debit", "debito", "débito", "d",
      "pagamento", "pago", "compra", "transferencia", "transf", "pag"
    ];
    
    if (expensePatterns.some(p => normalized.includes(p) || normalized === p)) {
      return "expense";
    }
  }

  // Check amount sign
  if (amount < 0) return "expense";
  
  // Check description keywords
  const desc = description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  const incomeKeywords = [
    "dizimo", "oferta", "doacao", "contribuicao", "receita",
    "recebimento", "deposito", "entrada", "credito", "recebido",
    "arrecadacao", "coleta", "campanha", "projeto especial"
  ];
  
  const expenseKeywords = [
    "despesa", "pagamento", "conta", "aluguel", "salario", "compra",
    "fornecedor", "manutencao", "luz", "agua", "telefone", "internet",
    "combustivel", "transporte", "material", "equipamento", "taxa",
    "imposto", "debito", "transferencia", "pago", "saida"
  ];

  if (incomeKeywords.some((k) => desc.includes(k))) return "income";
  if (expenseKeywords.some((k) => desc.includes(k))) return "expense";

  // Default to income for positive amounts (common in church finances)
  if (amount > 0) return "income";

  return "unknown";
}

function detectCategory(description: string, type: "income" | "expense"): string {
  const desc = description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (type === "income") {
    if (desc.includes("dizimo") || desc.includes("dízimo")) return "tithe";
    if (desc.includes("oferta") || desc.includes("coleta")) return "offering";
    if (desc.includes("projeto") || desc.includes("campanha") || desc.includes("especial"))
      return "special_project";
    if (desc.includes("campanha")) return "campaign";
    return "offering";
  } else {
    if (desc.includes("manutencao") || desc.includes("reparo") || desc.includes("conserto"))
      return "maintenance";
    if (
      desc.includes("luz") ||
      desc.includes("energia") ||
      desc.includes("agua") ||
      desc.includes("telefone") ||
      desc.includes("internet") ||
      desc.includes("gas")
    )
      return "utilities";
    if (desc.includes("salario") || desc.includes("pastor") || desc.includes("funcionario"))
      return "salaries";
    if (desc.includes("evento") || desc.includes("culto") || desc.includes("celebracao"))
      return "events";
    if (desc.includes("missao") || desc.includes("missionario") || desc.includes("evangelismo"))
      return "missions";
    if (desc.includes("material") || desc.includes("escritorio") || desc.includes("limpeza"))
      return "supplies";
    return "other";
  }
}

// Try to extract description from multiple columns if main description is generic
function buildDescription(row: any[], headers: string[], descIdx: number): string {
  let description = descIdx >= 0 ? String(row[descIdx] || "").trim() : "";
  
  // If description is too short or generic, try to combine with other columns
  if (description.length < 3 || /^[\d\s-]+$/.test(description)) {
    const additionalInfo: string[] = [];
    
    for (let i = 0; i < row.length; i++) {
      if (i === descIdx) continue;
      const cell = String(row[i] || "").trim();
      const header = String(headers[i] || "").toLowerCase();
      
      // Skip date and numeric columns
      if (isLikelyDate(cell) || parseAmountFlexible(cell) !== null) continue;
      
      // Include text columns that might have useful info
      if (cell.length > 3 && /[a-zA-ZÀ-ÿ]/.test(cell)) {
        additionalInfo.push(cell);
      }
    }
    
    if (additionalInfo.length > 0) {
      description = additionalInfo.join(" - ");
    }
  }
  
  return description || "Sem descrição";
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

        // Find the header row (might not be the first row)
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(jsonData.length, 5); i++) {
          const row = jsonData[i];
          if (row && row.filter(cell => cell && String(cell).length > 0).length >= 2) {
            // Check if this row looks like headers (mostly text, not dates/numbers)
            const textCount = row.filter(cell => {
              const str = String(cell || "");
              return str.length > 0 && !isLikelyDate(str) && parseAmountFlexible(str) === null;
            }).length;
            if (textCount >= row.filter(c => c).length * 0.5) {
              headerRowIdx = i;
              break;
            }
          }
        }

        const headers = jsonData[headerRowIdx].map((h) => String(h || "").trim());
        const { dateIdx, descIdx, amountIdx, typeIdx, donorIdx } = autoDetectColumns(headers, jsonData);

        const records: ParsedRecord[] = [];
        const errors: Array<{ row: number; message: string }> = [];
        let totalIncome = 0;
        let totalExpense = 0;

        for (let i = headerRowIdx + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0 || row.every((cell) => !cell)) continue;

          // Try to find date - check detected column or scan row
          let date: string | null = null;
          if (dateIdx >= 0) {
            date = parseDate(row[dateIdx]);
          }
          if (!date) {
            // Scan all cells for a date
            for (const cell of row) {
              const parsed = parseDate(cell);
              if (parsed) {
                date = parsed;
                break;
              }
            }
          }

          // Try to find amount - check detected column or scan row
          let amount: number | null = null;
          let amountCellIdx = amountIdx;
          if (amountIdx >= 0) {
            amount = parseAmountFlexible(row[amountIdx]);
          }
          if (amount === null) {
            // Scan for numeric values that look like amounts
            for (let j = 0; j < row.length; j++) {
              const parsed = parseAmountFlexible(row[j]);
              if (parsed !== null && !isLikelyDate(String(row[j]))) {
                amount = parsed;
                amountCellIdx = j;
                break;
              }
            }
          }

          const description = buildDescription(row, headers, descIdx);
          const typeValue = typeIdx >= 0 ? String(row[typeIdx] || "") : "";
          const donor = donorIdx >= 0 ? String(row[donorIdx] || "").trim() : "";

          // Skip rows without essential data
          if (!date && amount === null) {
            continue; // Skip completely empty/invalid rows silently
          }

          if (!date) {
            // Use current date as fallback
            date = new Date().toISOString().split("T")[0];
          }

          if (amount === null || amount === 0) {
            errors.push({
              row: i + 1,
              message: "Valor inválido ou ausente",
            });
            continue;
          }

          const absAmount = Math.abs(amount);
          const type = detectType(description, amount, typeValue, row);
          const category = type !== "unknown" ? detectCategory(description, type) : undefined;

          if (type === "income") totalIncome += absAmount;
          else if (type === "expense") totalExpense += absAmount;

          records.push({
            date,
            description,
            amount: absAmount,
            type: type === "unknown" ? "income" : type, // Default unknown to income
            category: category || (type === "income" || type === "unknown" ? "offering" : "other"),
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

          // Find the header row
          let headerRowIdx = 0;
          for (let i = 0; i < Math.min(data.length, 5); i++) {
            const row = data[i];
            if (row && row.filter(cell => cell && String(cell).length > 0).length >= 2) {
              const textCount = row.filter(cell => {
                const str = String(cell || "");
                return str.length > 0 && !isLikelyDate(str) && parseAmountFlexible(str) === null;
              }).length;
              if (textCount >= row.filter(c => c).length * 0.5) {
                headerRowIdx = i;
                break;
              }
            }
          }

          const headers = data[headerRowIdx].map((h) => String(h || "").trim());
          const { dateIdx, descIdx, amountIdx, typeIdx, donorIdx } = autoDetectColumns(headers, data);

          const records: ParsedRecord[] = [];
          const errors: Array<{ row: number; message: string }> = [];
          let totalIncome = 0;
          let totalExpense = 0;

          for (let i = headerRowIdx + 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0 || row.every((cell) => !cell)) continue;

            // Try to find date
            let date: string | null = null;
            if (dateIdx >= 0) {
              date = parseDate(row[dateIdx]);
            }
            if (!date) {
              for (const cell of row) {
                const parsed = parseDate(cell);
                if (parsed) {
                  date = parsed;
                  break;
                }
              }
            }

            // Try to find amount
            let amount: number | null = null;
            if (amountIdx >= 0) {
              amount = parseAmountFlexible(row[amountIdx]);
            }
            if (amount === null) {
              for (let j = 0; j < row.length; j++) {
                const parsed = parseAmountFlexible(row[j]);
                if (parsed !== null && !isLikelyDate(String(row[j]))) {
                  amount = parsed;
                  break;
                }
              }
            }

            const description = buildDescription(row, headers, descIdx);
            const typeValue = typeIdx >= 0 ? String(row[typeIdx] || "") : "";
            const donor = donorIdx >= 0 ? String(row[donorIdx] || "").trim() : "";

            if (!date && amount === null) {
              continue;
            }

            if (!date) {
              date = new Date().toISOString().split("T")[0];
            }

            if (amount === null || amount === 0) {
              errors.push({
                row: i + 1,
                message: "Valor inválido ou ausente",
              });
              continue;
            }

            const absAmount = Math.abs(amount);
            const type = detectType(description, amount, typeValue, row);
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
