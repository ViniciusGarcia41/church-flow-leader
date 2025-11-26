import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import Navbar from "@/components/Navbar";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Eye,
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { processFile, ParsedRecord, ParseResult } from "@/utils/fileProcessor";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCurrency } from "@/hooks/useCurrency";

const Import = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [editedRecords, setEditedRecords] = useState<ParsedRecord[]>([]);
  const [step, setStep] = useState<"upload" | "preview" | "confirm">("upload");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (selectedFile.size > maxSize) {
        toast.error(t("import.error"), {
          description: "Max 10MB",
        });
        return;
      }
      setFile(selectedFile);
      setParseResult(null);
      setStep("upload");
    }
  };

  const handleProcessFile = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const result = await processFile(file);
      setParseResult(result);
      setEditedRecords(result.records);
      setStep("preview");

      if (result.errors.length > 0) {
        toast.warning(t("import.error"), {
          description: `${result.errors.length} ${t("import.with")} ${t("import.errors")}`,
        });
      } else {
        toast.success(t("import.processing"), {
          description: `${result.records.length} ${t("import.records")}`,
        });
      }
    } catch (error: any) {
      toast.error(t("import.parseError"), {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRecordChange = (
    index: number,
    field: keyof ParsedRecord,
    value: any
  ) => {
    setEditedRecords((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveRecord = (index: number) => {
    setEditedRecords((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImport = async () => {
    if (!parseResult || !file || !user) return;

    setLoading(true);
    try {
      const donationsToInsert = editedRecords
        .filter((r) => r.type === "income")
        .map((r) => ({
          user_id: user.id,
          amount: r.amount,
          donation_type: (r.category || "offering") as "tithe" | "offering" | "special_project" | "campaign",
          donation_date: r.date,
          notes: r.notes || r.description,
          payment_method: r.paymentMethod,
          category: r.category,
        }));

      const expensesToInsert = editedRecords
        .filter((r) => r.type === "expense")
        .map((r) => ({
          user_id: user.id,
          amount: r.amount,
          category: (r.category || "other") as "maintenance" | "utilities" | "salaries" | "events" | "missions" | "supplies" | "other",
          expense_date: r.date,
          description: r.description,
          payment_method: r.paymentMethod,
          notes: r.notes,
        }));

      // Insert donations
      let donationsInserted = 0;
      if (donationsToInsert.length > 0) {
        const { error: donationsError } = await supabase
          .from("donations")
          .insert(donationsToInsert);

        if (donationsError) throw donationsError;
        donationsInserted = donationsToInsert.length;
      }

      // Insert expenses
      let expensesInserted = 0;
      if (expensesToInsert.length > 0) {
        const { error: expensesError } = await supabase
          .from("expenses")
          .insert(expensesToInsert);

        if (expensesError) throw expensesError;
        expensesInserted = expensesToInsert.length;
      }

      // Record import history
      const totalAmount =
        parseResult.totalIncome - parseResult.totalExpense;
      const importType =
        donationsInserted > 0 && expensesInserted > 0
          ? "mixed"
          : donationsInserted > 0
          ? "donations"
          : "expenses";

      await supabase.from("file_imports").insert([{
        user_id: user.id,
        file_name: file.name,
        file_type: file.type || "unknown",
        file_size: file.size,
        records_imported: editedRecords.length,
        records_failed: parseResult.errors.length,
        total_amount: totalAmount,
        import_type: importType,
        status: "completed",
        error_log: parseResult.errors.length > 0 ? JSON.parse(JSON.stringify(parseResult.errors)) : null,
        imported_data: JSON.parse(JSON.stringify(editedRecords)),
      }]);

      toast.success(t("import.success"), {
        description: `${donationsInserted} ${t("import.imported")} + ${expensesInserted}`,
      });

      // Reset state
      setFile(null);
      setParseResult(null);
      setEditedRecords([]);
      setStep("upload");
    } catch (error: any) {
      toast.error(t("import.saveError"), {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };


  const getTypeBadgeVariant = (type: string) => {
    if (type === "income") return "default";
    if (type === "expense") return "destructive";
    return "secondary";
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-6 space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">{t("import.title")}</h1>
          <p className="text-muted-foreground">
            {t("import.subtitle")}
          </p>
        </div>

        {step === "upload" && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                {t("import.upload")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label htmlFor="file" className="text-sm text-muted-foreground">
                    {t("import.supported")}
                  </Label>
                  <div className="flex flex-col items-center gap-3">
                    <Input
                      id="file"
                      type="file"
                      accept=".xlsx,.xls,.csv,.pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <Label
                      htmlFor="file"
                      className="cursor-pointer inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-8 py-2 w-full max-w-[280px] shadow-sm"
                    >
                      {t("import.chooseFile")}
                    </Label>
                    <span className="text-sm text-muted-foreground text-center">
                      {file ? file.name : t("import.noFileChosen")}
                    </span>
                  </div>
                </div>

                {file && (
                  <Alert>
                    <FileSpreadsheet className="h-4 w-4" />
                    <AlertDescription>
                  <div className="space-y-1">
                        <p className="font-semibold">{file.name}</p>
                        <p className="text-sm">
                          {t("import.fileSize")}: {(file.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-center">
                  <Button
                    onClick={handleProcessFile}
                    disabled={!file || loading}
                    className="w-full max-w-[280px]"
                    size="default"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("import.processingFile")}
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" />
                        {t("import.processAndView")}
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-semibold mb-3">{t("import.howItWorks")}</h3>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>{t("import.step1")}</li>
                  <li>{t("import.step2")}</li>
                  <li>{t("import.step3")}</li>
                  <li>{t("import.step4")}</li>
                  <li>{t("import.step5")}</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "preview" && parseResult && (
          <div className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    {t("import.viewData")}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setStep("upload");
                      setParseResult(null);
                      setEditedRecords([]);
                    }}
                  >
                    {t("import.upload")}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      {t("import.totalIncome")}
                    </p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(parseResult.totalIncome)}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {editedRecords.filter((r) => r.type === "income").length}{" "}
                      {t("import.recordsPlural")}
                    </p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      {t("import.totalExpenses")}
                    </p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(parseResult.totalExpense)}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {editedRecords.filter((r) => r.type === "expense").length}{" "}
                      {t("import.recordsPlural")}
                    </p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">{t("import.balance")}</p>
                    <p
                      className={`text-2xl font-bold ${
                        parseResult.totalIncome - parseResult.totalExpense >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {formatCurrency(
                        parseResult.totalIncome - parseResult.totalExpense
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {editedRecords.length} {t("import.totalRecords")}
                    </p>
                  </div>
                </div>

                {parseResult.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-semibold mb-2">
                        {parseResult.errors.length} {t("import.errorsFound")}
                      </p>
                      <ul className="text-sm space-y-1">
                        {parseResult.errors.slice(0, 5).map((err, i) => (
                          <li key={i}>
                            {t("import.date")} {err.row}: {err.message}
                          </li>
                        ))}
                        {parseResult.errors.length > 5 && (
                          <li>... {t("import.andMore")} {parseResult.errors.length - 5}</li>
                        )}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("import.date")}</TableHead>
                        <TableHead>{t("import.type")}</TableHead>
                        <TableHead>{t("import.description")}</TableHead>
                        <TableHead>{t("import.amount")}</TableHead>
                        <TableHead>{t("import.category")}</TableHead>
                        <TableHead className="text-right">{t("import.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editedRecords.map((record, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Input
                              type="date"
                              value={record.date}
                              onChange={(e) =>
                                handleRecordChange(index, "date", e.target.value)
                              }
                              className="w-36"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={record.type}
                              onValueChange={(value) =>
                                handleRecordChange(index, "type", value)
                              }
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="income">{t("import.income")}</SelectItem>
                                <SelectItem value="expense">{t("import.expense")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={record.description}
                              onChange={(e) =>
                                handleRecordChange(
                                  index,
                                  "description",
                                  e.target.value
                                )
                              }
                              className="min-w-[200px]"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={record.amount}
                              onChange={(e) =>
                                handleRecordChange(
                                  index,
                                  "amount",
                                  parseFloat(e.target.value)
                                )
                              }
                              className="w-32"
                            />
                          </TableCell>
                          <TableCell>
                            <Badge variant={getTypeBadgeVariant(record.type)}>
                              {record.category || "N/A"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveRecord(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end gap-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStep("upload");
                      setParseResult(null);
                      setEditedRecords([]);
                    }}
                  >
                    {t("import.upload")}
                  </Button>
                  <Button onClick={handleImport} disabled={loading || editedRecords.length === 0}>
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t("import.confirming")}
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {t("import.confirm")} ({editedRecords.length} {t("import.records")})
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Import;
