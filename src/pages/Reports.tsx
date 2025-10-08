import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/hooks/useCurrency";
import Navbar from "@/components/Navbar";
import { FileDown, Calendar } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface ReportData {
  donations: any[];
  expenses: any[];
  totalDonations: number;
  totalExpenses: number;
  balance: number;
}

const Reports = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  const fetchReportData = async (): Promise<ReportData | null> => {
    try {
      const [donationsRes, expensesRes] = await Promise.all([
        supabase
          .from("donations")
          .select("*, donors(name)")
          .eq("user_id", user?.id)
          .gte("donation_date", startDate)
          .lte("donation_date", endDate)
          .order("donation_date", { ascending: false }),
        supabase
          .from("expenses")
          .select("*")
          .eq("user_id", user?.id)
          .gte("expense_date", startDate)
          .lte("expense_date", endDate)
          .order("expense_date", { ascending: false }),
      ]);

      if (donationsRes.error) throw donationsRes.error;
      if (expensesRes.error) throw expensesRes.error;

      const totalDonations = (donationsRes.data || []).reduce((sum, d) => sum + Number(d.amount), 0);
      const totalExpenses = (expensesRes.data || []).reduce((sum, e) => sum + Number(e.amount), 0);

      return {
        donations: donationsRes.data || [],
        expenses: expensesRes.data || [],
        totalDonations,
        totalExpenses,
        balance: totalDonations - totalExpenses,
      };
    } catch (error: any) {
      toast.error(t("reports.loadError"), { description: error.message });
      return null;
    }
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString + "T00:00:00").toLocaleDateString(language === "pt" ? "pt-BR" : "en-US");
  };

  const getDonationTypeLabel = (type: string) => {
    const typeKey = `donations.types.${type}` as const;
    return t(typeKey);
  };

  const getCategoryLabel = (category: string) => {
    const categoryKey = `expenses.categories.${category}` as const;
    return t(categoryKey);
  };

  const generatePDF = async () => {
    setLoading(true);
    const data = await fetchReportData();
    if (!data) {
      setLoading(false);
      return;
    }

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;

      // Título
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório Financeiro Mensal", pageWidth / 2, 20, { align: "center" });

      // Período
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`Período: ${formatDate(startDate)} a ${formatDate(endDate)}`, pageWidth / 2, 28, {
        align: "center",
      });

      // Resumo
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Resumo Financeiro", 14, 40);

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`Total de Receitas: ${formatCurrency(data.totalDonations)}`, 14, 48);
      doc.text(`Total de Despesas: ${formatCurrency(data.totalExpenses)}`, 14, 55);

      doc.setFont("helvetica", "bold");
      const balanceColor = data.balance >= 0 ? [34, 197, 94] : [239, 68, 68];
      doc.setTextColor(balanceColor[0], balanceColor[1], balanceColor[2]);
      doc.text(`Saldo: ${formatCurrency(data.balance)}`, 14, 62);
      doc.setTextColor(0, 0, 0);

      // Tabela de Doações
      doc.setFont("helvetica", "bold");
      doc.text("Receitas (Doações)", 14, 75);

      autoTable(doc, {
        startY: 78,
        head: [["Data", "Tipo", "Valor", "Doador"]],
        body: data.donations.map((d) => [
          formatDate(d.donation_date),
          getDonationTypeLabel(d.donation_type),
          formatCurrency(Number(d.amount)),
          d.donors?.name || t("donations.anonymous"),
        ]),
        theme: "grid",
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        styles: { fontSize: 9 },
      });

      // Tabela de Despesas
      const finalY = (doc as any).lastAutoTable.finalY || 78;
      doc.setFont("helvetica", "bold");
      doc.text(t("nav.expenses"), 14, finalY + 15);

      autoTable(doc, {
        startY: finalY + 18,
        head: [["Data", "Categoria", "Descrição", "Valor"]],
        body: data.expenses.map((e) => [
          formatDate(e.expense_date),
          getCategoryLabel(e.category),
          e.description,
          formatCurrency(Number(e.amount)),
        ]),
        theme: "grid",
        headStyles: { fillColor: [239, 68, 68], textColor: 255 },
        styles: { fontSize: 9 },
      });

      // Rodapé
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const pageHeight = doc.internal.pageSize.height;
        doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 10, {
          align: "center",
        });
        doc.text(
          `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
          pageWidth - 14,
          pageHeight - 10,
          { align: "right" }
        );
      }

      doc.save(`financial-report-${startDate}-${endDate}.pdf`);
      toast.success(t("reports.pdfSuccess"));
    } catch (error: any) {
      toast.error(t("reports.error"), { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const generateExcel = async () => {
    setLoading(true);
    const data = await fetchReportData();
    if (!data) {
      setLoading(false);
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      // Planilha de Resumo
      const summaryData = [
        ["Relatório Financeiro Mensal"],
        [`Período: ${formatDate(startDate)} a ${formatDate(endDate)}`],
        [],
        ["Total de Receitas", formatCurrency(data.totalDonations)],
        ["Total de Despesas", formatCurrency(data.totalExpenses)],
        ["Saldo", formatCurrency(data.balance)],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");

      // Planilha de Doações
      const donationsData = [
        ["Data", "Tipo", "Valor", "Doador", "Categoria", "Forma de Pagamento", "Observações"],
        ...data.donations.map((d) => [
          formatDate(d.donation_date),
          getDonationTypeLabel(d.donation_type),
          Number(d.amount),
          d.donors?.name || t("donations.anonymous"),
          d.category || "",
          d.payment_method || "",
          d.notes || "",
        ]),
      ];
      const wsDonations = XLSX.utils.aoa_to_sheet(donationsData);
      XLSX.utils.book_append_sheet(wb, wsDonations, t("nav.donations"));

      // Planilha de Despesas
      const expensesData = [
        ["Data", "Categoria", "Descrição", "Valor", "Fornecedor", "Forma de Pagamento", "Observações"],
        ...data.expenses.map((e) => [
          formatDate(e.expense_date),
          getCategoryLabel(e.category),
          e.description,
          Number(e.amount),
          e.vendor || "",
          e.payment_method || "",
          e.notes || "",
        ]),
      ];
      const wsExpenses = XLSX.utils.aoa_to_sheet(expensesData);
      XLSX.utils.book_append_sheet(wb, wsExpenses, t("nav.expenses"));

      XLSX.writeFile(wb, `financial-report-${startDate}-${endDate}.xlsx`);
      toast.success(t("reports.excelSuccess"));
    } catch (error: any) {
      toast.error(t("reports.error"), { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-6 space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">{t("reports.title")}</h1>
          <p className="text-muted-foreground">{t("reports.subtitle")}</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t("reports.selectPeriod")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">{t("reports.startDate")}</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">{t("reports.endDate")}</Label>
                <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <Button onClick={generatePDF} disabled={loading} className="gap-2">
                <FileDown className="h-4 w-4" />
                {loading ? t("reports.generating") : t("reports.exportPDF")}
              </Button>
              <Button onClick={generateExcel} disabled={loading} variant="outline" className="gap-2">
                <FileDown className="h-4 w-4" />
                {loading ? t("reports.generating") : t("reports.exportExcel")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>{t("reports.about")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong>PDF:</strong> {t("reports.pdfDesc")}
            </p>
            <p>
              <strong>Excel:</strong> {t("reports.excelDesc")}
            </p>
            <p>{t("reports.includesDesc")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Reports;
