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
  status?: "ok" | "duplicate" | "suspicious" | "incomplete";
}

export interface ParseResult {
  records: ParsedRecord[];
  errors: Array<{ row: number; message: string }>;
  headers: string[];
  totalIncome: number;
  totalExpense: number;
  metadata?: {
    fileType: string;
    sheetNames?: string[];
    selectedSheet?: string;
    startDate?: string;
    endDate?: string;
    recordCount: number;
  };
}

export interface ColumnMapping {
  date: number;
  description: number;
  amount: number;
  type: number;
  donor: number;
  [key: string]: number;
}
