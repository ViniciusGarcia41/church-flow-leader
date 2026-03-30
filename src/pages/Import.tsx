import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import Navbar from "@/components/Navbar";
import { Loader2, Save, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { processFile, getExcelSheetNames } from "@/utils/parsers";
import type { ParseResult, ParsedRecord } from "@/utils/parsers/types";
import FileUploadZone from "@/components/import/FileUploadZone";
import StepIndicator from "@/components/import/StepIndicator";
import type { ImportStep } from "@/components/import/StepIndicator";
import DataPreview from "@/components/import/DataPreview";

const Import = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [editedRecords, setEditedRecords] = useState<ParsedRecord[]>([]);
  const [step, setStep] = useState<ImportStep>("upload");
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");

  const handleFileSelect = useCallback(async (f: File) => {
    setFile(f);
    setParseResult(null);
    setEditedRecords([]);
    setStep("upload");
    setSheetNames([]);
    setSelectedSheet("");

    // Check if Excel with multiple sheets
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext === "xlsx" || ext === "xls") {
      try {
        const names = await getExcelSheetNames(f);
        if (names.length > 1) {
          setSheetNames(names);
          setSelectedSheet(names[0]);
        }
      } catch { /* ignore */ }
    }
  }, []);

  const handleFileClear = useCallback(() => {
    setFile(null);
    setParseResult(null);
    setEditedRecords([]);
    setStep("upload");
    setSheetNames([]);
    setSelectedSheet("");
  }, []);

  const handleProcess = async () => {
    if (!file) return;
    setLoading(true);
    setStep("processing");

    try {
      const result = await processFile(file, selectedSheet || undefined);
      setParseResult(result);
      setEditedRecords(result.records);
      setStep("preview");

      if (result.errors.length > 0 && result.records.length > 0) {
        toast.warning(t("import.partialSuccess") || "Processado com avisos", {
          description: `${result.records.length} ${t("import.records")} • ${result.errors.length} ${t("import.errors")}`,
        });
      } else if (result.records.length > 0) {
        toast.success(t("import.processing"), {
          description: `${result.records.length} ${t("import.records")}`,
        });
      } else {
        toast.error(t("import.noRecords") || "Nenhum registro encontrado", {
          description: result.errors[0]?.message || "",
        });
      }
    } catch (error: any) {
      setStep("upload");
      toast.error(t("import.parseError"), { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRecordChange = useCallback((index: number, field: keyof ParsedRecord, value: any) => {
    setEditedRecords(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  const handleRemoveRecord = useCallback((index: number) => {
    setEditedRecords(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleImport = async () => {
    if (!parseResult || !file || !user) return;
    setLoading(true);
    setStep("confirm");

    try {
      const donationsToInsert = editedRecords
        .filter(r => r.type === "income")
        .map(r => ({
          user_id: user.id,
          amount: r.amount,
          donation_type: (r.category || "offering") as "tithe" | "offering" | "special_project" | "campaign",
          donation_date: r.date,
          notes: r.notes || r.description,
          payment_method: r.paymentMethod,
          category: r.category,
        }));

      const expensesToInsert = editedRecords
        .filter(r => r.type === "expense")
        .map(r => ({
          user_id: user.id,
          amount: r.amount,
          category: (r.category || "other") as "maintenance" | "utilities" | "salaries" | "events" | "missions" | "supplies" | "other",
          expense_date: r.date,
          description: r.description,
          payment_method: r.paymentMethod,
          notes: r.notes,
        }));

      let donationsInserted = 0;
      if (donationsToInsert.length > 0) {
        const { error } = await supabase.from("donations").insert(donationsToInsert);
        if (error) throw error;
        donationsInserted = donationsToInsert.length;
      }

      let expensesInserted = 0;
      if (expensesToInsert.length > 0) {
        const { error } = await supabase.from("expenses").insert(expensesToInsert);
        if (error) throw error;
        expensesInserted = expensesToInsert.length;
      }

      const totalAmount = editedRecords.filter(r => r.type === "income").reduce((s, r) => s + r.amount, 0)
        - editedRecords.filter(r => r.type === "expense").reduce((s, r) => s + r.amount, 0);

      const importType = donationsInserted > 0 && expensesInserted > 0 ? "mixed"
        : donationsInserted > 0 ? "donations" : "expenses";

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
        description: `${donationsInserted} ${t("import.incomeRecords") || "receitas"} + ${expensesInserted} ${t("import.expenseRecords") || "despesas"}`,
      });

      handleFileClear();
    } catch (error: any) {
      setStep("preview");
      toast.error(t("import.saveError"), { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-5xl">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">{t("import.title")}</h1>
          <p className="text-muted-foreground">{t("import.subtitle")}</p>
        </div>

        {/* Step indicator */}
        <StepIndicator currentStep={step} hasErrors={parseResult ? parseResult.errors.length > 0 && parseResult.records.length === 0 : false} />

        {/* Upload step */}
        {(step === "upload" || step === "processing") && (
          <Card>
            <CardContent className="p-6 space-y-6">
              <FileUploadZone file={file} onFileSelect={handleFileSelect} onFileClear={handleFileClear} />

              {/* Sheet selector for Excel */}
              {sheetNames.length > 1 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t("import.selectSheet") || "Selecionar aba da planilha"}</label>
                  <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sheetNames.map(name => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {file && (
                <div className="flex justify-center">
                  <Button onClick={handleProcess} disabled={loading} size="lg" className="min-w-[220px]">
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        {t("import.processingFile")}
                      </>
                    ) : (
                      <>
                        <ArrowRight className="h-4 w-4 mr-2" />
                        {t("import.processAndView")}
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* How it works */}
              <div className="border-t pt-6">
                <h3 className="font-semibold text-foreground mb-3">{t("import.howItWorks")}</h3>
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

        {/* Preview step */}
        {step === "preview" && parseResult && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">{t("import.viewData")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <DataPreview
                result={parseResult}
                records={editedRecords}
                onRecordChange={handleRecordChange}
                onRemoveRecord={handleRemoveRecord}
              />

              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <Button variant="outline" onClick={handleFileClear} className="min-w-[160px]">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t("import.upload")}
                </Button>
                <Button onClick={handleImport} disabled={loading || editedRecords.length === 0} className="min-w-[200px]">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t("import.confirming")}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {t("import.confirm")} ({editedRecords.length})
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Import;
