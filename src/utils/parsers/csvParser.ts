import Papa from "papaparse";
import type { ParseResult } from "./types";
import { isLikelyDate, parseAmountFlexible, processRowData } from "./helpers";

export async function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      complete: (results) => {
        try {
          const data = results.data as any[][];
          if (data.length < 2) {
            resolve({ records: [], errors: [{ row: 0, message: "Arquivo CSV vazio ou sem dados" }], headers: [], totalIncome: 0, totalExpense: 0, metadata: { fileType: "csv", recordCount: 0 } });
            return;
          }
          let headerRowIdx = 0;
          for (let i = 0; i < Math.min(data.length, 5); i++) {
            const row = data[i];
            if (row && row.filter(cell => cell && String(cell).length > 0).length >= 2) {
              const textCount = row.filter(cell => {
                const str = String(cell || "");
                return str.length > 0 && !isLikelyDate(str) && parseAmountFlexible(str) === null;
              }).length;
              if (textCount >= row.filter(c => c).length * 0.5) { headerRowIdx = i; break; }
            }
          }
          const headers = data[headerRowIdx].map(h => String(h || "").trim());
          const result = processRowData(data, headers, headerRowIdx);
          const dates = result.records.map(r => r.date).filter(Boolean).sort();
          resolve({
            ...result,
            metadata: {
              fileType: "csv",
              recordCount: result.records.length,
              startDate: dates[0],
              endDate: dates[dates.length - 1],
            },
          });
        } catch (error: any) {
          reject(new Error(`Erro ao processar CSV: ${error.message}`));
        }
      },
      error: (error) => reject(new Error(`Erro ao ler CSV: ${error.message}`)),
      skipEmptyLines: true,
    });
  });
}
