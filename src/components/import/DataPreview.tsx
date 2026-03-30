import type { ParseResult, ParsedRecord } from "@/utils/parsers/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/hooks/useCurrency";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { X, AlertCircle, TrendingUp, TrendingDown, BarChart3, Calendar, FileText, Hash } from "lucide-react";

interface DataPreviewProps {
  result: ParseResult;
  records: ParsedRecord[];
  onRecordChange: (index: number, field: keyof ParsedRecord, value: any) => void;
  onRemoveRecord: (index: number) => void;
}

export default function DataPreview({ result, records, onRecordChange, onRemoveRecord }: DataPreviewProps) {
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();

  const incomeRecords = records.filter(r => r.type === "income");
  const expenseRecords = records.filter(r => r.type === "expense");
  const totalIncome = incomeRecords.reduce((sum, r) => sum + r.amount, 0);
  const totalExpense = expenseRecords.reduce((sum, r) => sum + r.amount, 0);
  const balance = totalIncome - totalExpense;

  return (
    <div className="space-y-6">
      {/* Metadata */}
      {result.metadata && (
        <div className="flex flex-wrap gap-3 text-sm">
          {result.metadata.fileType && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              <span>{result.metadata.fileType.toUpperCase()}</span>
            </div>
          )}
          {result.metadata.startDate && result.metadata.endDate && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>{result.metadata.startDate} → {result.metadata.endDate}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Hash className="h-3.5 w-3.5" />
            <span>{records.length} {t("import.recordsPlural")}</span>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 bg-income-light">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-income" />
              <span className="text-sm text-muted-foreground">{t("import.totalIncome")}</span>
            </div>
            <p className="text-xl font-bold text-income">{formatCurrency(totalIncome)}</p>
            <p className="text-xs text-muted-foreground mt-1">{incomeRecords.length} {t("import.recordsPlural")}</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-expense-light">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-expense" />
              <span className="text-sm text-muted-foreground">{t("import.totalExpenses")}</span>
            </div>
            <p className="text-xl font-bold text-expense">{formatCurrency(totalExpense)}</p>
            <p className="text-xs text-muted-foreground mt-1">{expenseRecords.length} {t("import.recordsPlural")}</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-accent/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-foreground" />
              <span className="text-sm text-muted-foreground">{t("import.balance")}</span>
            </div>
            <p className={`text-xl font-bold ${balance >= 0 ? "text-income" : "text-expense"}`}>
              {formatCurrency(balance)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{records.length} {t("import.totalRecords")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Errors */}
      {result.errors.length > 0 && (
        <Alert variant="destructive" className="bg-destructive-light border-destructive/20">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium mb-1">{result.errors.length} {t("import.errorsFound")}</p>
            <ul className="text-sm space-y-0.5">
              {result.errors.slice(0, 5).map((err, i) => (
                <li key={i}>Linha {err.row}: {err.message}</li>
              ))}
              {result.errors.length > 5 && <li>... {t("import.andMore")} {result.errors.length - 5}</li>}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Data table */}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">{t("import.date")}</TableHead>
              <TableHead className="w-[120px]">{t("import.type")}</TableHead>
              <TableHead className="min-w-[200px]">{t("import.description")}</TableHead>
              <TableHead className="w-[130px]">{t("import.amount")}</TableHead>
              <TableHead className="w-[140px]">{t("import.category")}</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record, index) => (
              <TableRow key={index} className={record.status === "duplicate" ? "opacity-50" : ""}>
                <TableCell>
                  <Input type="date" value={record.date} onChange={e => onRecordChange(index, "date", e.target.value)} className="h-8 text-sm" />
                </TableCell>
                <TableCell>
                  <Select value={record.type} onValueChange={v => onRecordChange(index, "type", v)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">
                        <span className="text-income">{t("import.income")}</span>
                      </SelectItem>
                      <SelectItem value="expense">
                        <span className="text-expense">{t("import.expense")}</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input value={record.description} onChange={e => onRecordChange(index, "description", e.target.value)} className="h-8 text-sm" />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    value={record.amount}
                    onChange={e => onRecordChange(index, "amount", parseFloat(e.target.value) || 0)}
                    className={`h-8 text-sm font-medium ${record.type === "income" ? "text-income" : "text-expense"}`}
                  />
                </TableCell>
                <TableCell>
                  <Badge variant={record.type === "income" ? "default" : "destructive"} className="text-xs">
                    {record.category || "N/A"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemoveRecord(index)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
