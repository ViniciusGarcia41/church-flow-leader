export type { ParsedRecord, ParseResult, ColumnMapping } from "./types";
export { parseCSV } from "./csvParser";
export { parseExcel, getExcelSheetNames } from "./excelParser";
export { parsePDF } from "./pdfParser";
export { parseTXT } from "./txtParser";
export { parseJSON } from "./jsonParser";
export { parseXML } from "./xmlParser";

import type { ParseResult } from "./types";
import { parseCSV } from "./csvParser";
import { parseExcel } from "./excelParser";
import { parsePDF } from "./pdfParser";
import { parseTXT } from "./txtParser";
import { parseJSON } from "./jsonParser";
import { parseXML } from "./xmlParser";

export const SUPPORTED_EXTENSIONS = ["csv", "xlsx", "xls", "pdf", "txt", "json", "xml"];
export const SUPPORTED_MIME_TYPES = [
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/pdf",
  "text/plain",
  "application/json",
  "text/xml",
  "application/xml",
];

export const ACCEPT_STRING = ".csv,.xlsx,.xls,.pdf,.txt,.json,.xml";

export function getFileExtension(file: File): string {
  return file.name.split(".").pop()?.toLowerCase() || "";
}

export function isFileSupported(file: File): boolean {
  return SUPPORTED_EXTENSIONS.includes(getFileExtension(file));
}

export function getFileTypeLabel(ext: string): string {
  const labels: Record<string, string> = {
    csv: "CSV",
    xlsx: "Excel",
    xls: "Excel",
    pdf: "PDF",
    txt: "Texto",
    json: "JSON",
    xml: "XML",
  };
  return labels[ext] || ext.toUpperCase();
}

export async function processFile(file: File, sheetName?: string): Promise<ParseResult> {
  const ext = getFileExtension(file);
  switch (ext) {
    case "csv": return parseCSV(file);
    case "xlsx":
    case "xls": return parseExcel(file, sheetName);
    case "pdf": return parsePDF(file);
    case "txt": return parseTXT(file);
    case "json": return parseJSON(file);
    case "xml": return parseXML(file);
    default:
      throw new Error(`Formato .${ext} não suportado. Use: ${SUPPORTED_EXTENSIONS.join(", ")}`);
  }
}
