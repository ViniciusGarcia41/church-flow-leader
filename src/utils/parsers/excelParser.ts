import * as XLSX from "xlsx";
import type { ParseResult } from "./types";
import { isLikelyDate, parseAmountFlexible, processRowData } from "./helpers";

export async function parseExcel(file: File, sheetName?: string): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const sheetNames = workbook.SheetNames;
        const selectedSheet = sheetName || sheetNames[0];
        const sheet = workbook.Sheets[selectedSheet];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: "yyyy-mm-dd" }) as any[][];

        if (jsonData.length < 2) {
          resolve({ records: [], errors: [{ row: 0, message: "Planilha vazia ou sem dados" }], headers: [], totalIncome: 0, totalExpense: 0, metadata: { fileType: "excel", sheetNames, selectedSheet, recordCount: 0 } });
          return;
        }

        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(jsonData.length, 5); i++) {
          const row = jsonData[i];
          if (row && row.filter(cell => cell && String(cell).length > 0).length >= 2) {
            const textCount = row.filter(cell => {
              const str = String(cell || "");
              return str.length > 0 && !isLikelyDate(str) && parseAmountFlexible(str) === null;
            }).length;
            if (textCount >= row.filter(c => c).length * 0.5) { headerRowIdx = i; break; }
          }
        }

        const headers = jsonData[headerRowIdx].map(h => String(h || "").trim());
        const result = processRowData(jsonData, headers, headerRowIdx);
        const dates = result.records.map(r => r.date).filter(Boolean).sort();

        resolve({
          ...result,
          metadata: {
            fileType: "excel",
            sheetNames,
            selectedSheet,
            recordCount: result.records.length,
            startDate: dates[0],
            endDate: dates[dates.length - 1],
          },
        });
      } catch (error: any) {
        reject(new Error(`Erro ao processar Excel: ${error.message}`));
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler arquivo Excel"));
    reader.readAsArrayBuffer(file);
  });
}

export async function getExcelSheetNames(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array", bookSheets: true });
        resolve(workbook.SheetNames);
      } catch { resolve([]); }
    };
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsArrayBuffer(file);
  });
}
