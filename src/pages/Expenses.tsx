import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/hooks/useCurrency";
import Navbar from "@/components/Navbar";
import FilterBar from "@/components/FilterBar";
import { Plus, Trash2, Pencil, FileDown, Paperclip, Eye, FileText, FileSpreadsheet, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  payment_method: string | null;
  vendor: string | null;
  notes: string | null;
  expense_date: string;
  attachment_url: string | null;
}

const Expenses = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { formatCurrency } = useCurrency();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [viewAttachmentUrl, setViewAttachmentUrl] = useState<string | null>(null);
  const [isViewAttachmentOpen, setIsViewAttachmentOpen] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (user) fetchExpenses();
  }, [user]);

  const fetchExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", user?.id)
        .order("expense_date", { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error: any) {
      toast.error(t("expenses.loadError"), { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const uploadAttachment = async (file: File, transactionId: string): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const filePath = `${user?.id}/${transactionId}.${fileExt}`;
    const { error } = await supabase.storage.from("transaction-attachments").upload(filePath, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("transaction-attachments").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const deleteAttachment = async (attachmentUrl: string) => {
    try {
      const url = new URL(attachmentUrl);
      const pathParts = url.pathname.split('/transaction-attachments/');
      if (pathParts.length > 1) {
        await supabase.storage.from("transaction-attachments").remove([pathParts[1]]);
      }
    } catch (e) {
      console.error("Error deleting attachment:", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const expenseData: any = {
      user_id: user?.id,
      description: formData.get("description") as string,
      amount: parseFloat(formData.get("amount") as string),
      category: formData.get("category") as string,
      payment_method: formData.get("payment_method") as string || null,
      vendor: formData.get("vendor") as string || null,
      notes: formData.get("notes") as string || null,
      expense_date: formData.get("expense_date") as string,
    };

    try {
      const { data, error } = await supabase.from("expenses").insert([expenseData]).select().single();
      if (error) throw error;

      if (attachmentFile && data) {
        const url = await uploadAttachment(attachmentFile, data.id);
        await supabase.from("expenses").update({ attachment_url: url }).eq("id", data.id);
      }

      toast.success(t("expenses.success"));
      setIsDialogOpen(false);
      setAttachmentFile(null);
      fetchExpenses();
      e.currentTarget.reset();
    } catch (error: any) {
      toast.error(t("expenses.registerError"), { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setExpenseToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!expenseToDelete) return;
    try {
      const expense = expenses.find(e => e.id === expenseToDelete);
      if (expense?.attachment_url) await deleteAttachment(expense.attachment_url);

      const { error } = await supabase.from("expenses").delete().eq("id", expenseToDelete);
      if (error) throw error;
      toast.success(t("expenses.deleteSuccess"));
      fetchExpenses();
    } catch (error: any) {
      toast.error(t("expenses.deleteError"), { description: error.message });
    } finally {
      setDeleteDialogOpen(false);
      setExpenseToDelete(null);
    }
  };

  const getPaymentMethodKey = (method: string | null): string => {
    if (!method) return "";
    const lowerMethod = method.toLowerCase();
    if (lowerMethod.includes("dinheiro") || lowerMethod.includes("cash")) return "cash";
    if (lowerMethod.includes("cheque") || lowerMethod.includes("check")) return "check";
    if (lowerMethod.includes("transferência") || lowerMethod.includes("transfer")) return "bank_transfer";
    if (lowerMethod.includes("crédito") || lowerMethod.includes("credit")) return "credit_card";
    if (lowerMethod.includes("débito") || lowerMethod.includes("debit")) return "debit_card";
    if (lowerMethod.includes("pix")) return "pix";
    return "other";
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setEditPaymentMethod(expense.payment_method ? getPaymentMethodKey(expense.payment_method) : "");
    setIsEditDialogOpen(true);
  };

  const getPaymentMethodLabel = (key: string): string => {
    if (!key) return "";
    return t(`expenses.paymentMethods.${key}` as const);
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingExpense) return;
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const expenseData: any = {
      description: formData.get("description") as string,
      amount: parseFloat(formData.get("amount") as string),
      category: formData.get("category") as string,
      payment_method: editPaymentMethod ? getPaymentMethodLabel(editPaymentMethod) : null,
      vendor: formData.get("vendor") as string || null,
      notes: formData.get("notes") as string || null,
      expense_date: formData.get("expense_date") as string,
    };

    try {
      if (attachmentFile) {
        if (editingExpense.attachment_url) await deleteAttachment(editingExpense.attachment_url);
        const url = await uploadAttachment(attachmentFile, editingExpense.id);
        expenseData.attachment_url = url;
      }

      const { error } = await supabase.from("expenses").update(expenseData).eq("id", editingExpense.id);
      if (error) throw error;

      toast.success(t("expenses.updateSuccess"));
      setIsEditDialogOpen(false);
      setEditingExpense(null);
      setEditPaymentMethod("");
      setAttachmentFile(null);
      fetchExpenses();
    } catch (error: any) {
      toast.error(t("expenses.updateError"), { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateReceipt = async (expense: Expense) => {
    try {
      const { data: profile } = await supabase.from("profiles").select("church_name, church_cnpj").eq("id", user?.id).single();

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const churchName = profile?.church_name || localStorage.getItem("churchledger-appname") || "ChurchLedger";
      const churchCnpj = (profile as any)?.church_cnpj || "";
      const receiptNumber = `REC-${expense.id.substring(0, 8).toUpperCase()}`;

      const savedLogo = localStorage.getItem("churchledger-logo");
      let yPos = 15;
      if (savedLogo) {
        try {
          doc.addImage(savedLogo, "PNG", 14, yPos, 25, 25);
          doc.setFontSize(18);
          doc.setFont("helvetica", "bold");
          doc.text(churchName, 44, yPos + 10);
          if (churchCnpj) { doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text(`CNPJ: ${churchCnpj}`, 44, yPos + 17); }
          yPos += 32;
        } catch {
          doc.setFontSize(18); doc.setFont("helvetica", "bold");
          doc.text(churchName, pageWidth / 2, yPos + 5, { align: "center" });
          if (churchCnpj) { doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text(`CNPJ: ${churchCnpj}`, pageWidth / 2, yPos + 12, { align: "center" }); }
          yPos += 20;
        }
      } else {
        doc.setFontSize(18); doc.setFont("helvetica", "bold");
        doc.text(churchName, pageWidth / 2, yPos + 5, { align: "center" });
        if (churchCnpj) { doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text(`CNPJ: ${churchCnpj}`, pageWidth / 2, yPos + 12, { align: "center" }); }
        yPos += 20;
      }

      doc.setDrawColor(200, 200, 200); doc.line(14, yPos, pageWidth - 14, yPos); yPos += 8;

      doc.setFontSize(16); doc.setFont("helvetica", "bold");
      doc.text(language === "pt" ? "RECIBO DE DESPESA" : "EXPENSE RECEIPT", pageWidth / 2, yPos, { align: "center" });
      yPos += 7;
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      doc.text(`Nº ${receiptNumber}`, pageWidth / 2, yPos, { align: "center" }); yPos += 12;

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold"); doc.text(language === "pt" ? "Descrição:" : "Description:", 14, yPos);
      doc.setFont("helvetica", "normal"); doc.text(expense.description, 55, yPos); yPos += 7;

      if (expense.vendor) {
        doc.setFont("helvetica", "bold"); doc.text(language === "pt" ? "Fornecedor:" : "Vendor:", 14, yPos);
        doc.setFont("helvetica", "normal"); doc.text(expense.vendor, 55, yPos); yPos += 7;
      }

      doc.setFont("helvetica", "bold"); doc.text(language === "pt" ? "Data:" : "Date:", 14, yPos);
      doc.setFont("helvetica", "normal"); doc.text(new Date(expense.expense_date + "T00:00:00").toLocaleDateString(language === "pt" ? "pt-BR" : "en-US"), 55, yPos); yPos += 7;

      doc.setFont("helvetica", "bold"); doc.text(language === "pt" ? "Categoria:" : "Category:", 14, yPos);
      doc.setFont("helvetica", "normal"); doc.text(t(`expenses.categories.${expense.category}` as const), 55, yPos); yPos += 7;

      if (expense.payment_method) {
        doc.setFont("helvetica", "bold"); doc.text(language === "pt" ? "Pagamento:" : "Payment:", 14, yPos);
        doc.setFont("helvetica", "normal"); doc.text(expense.payment_method, 55, yPos); yPos += 7;
      }

      yPos += 3; doc.setDrawColor(200, 200, 200); doc.line(14, yPos, pageWidth - 14, yPos); yPos += 10;

      doc.setFontSize(14); doc.setFont("helvetica", "bold");
      doc.text(language === "pt" ? "Valor:" : "Amount:", 14, yPos);
      doc.text(formatCurrency(Number(expense.amount)), pageWidth - 14, yPos, { align: "right" }); yPos += 10;

      doc.setDrawColor(200, 200, 200); doc.line(14, yPos, pageWidth - 14, yPos); yPos += 8;

      if (expense.notes) {
        doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text(language === "pt" ? "Observações:" : "Notes:", 14, yPos); yPos += 6;
        doc.setFont("helvetica", "normal");
        const splitNotes = doc.splitTextToSize(expense.notes, pageWidth - 28);
        doc.text(splitNotes, 14, yPos);
      }

      const footerY = doc.internal.pageSize.height - 20;
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(150);
      doc.text(`${language === "pt" ? "Emitido em" : "Issued on"}: ${new Date().toLocaleDateString(language === "pt" ? "pt-BR" : "en-US")}`, pageWidth / 2, footerY, { align: "center" });

      doc.save(`recibo-despesa-${receiptNumber}.pdf`);
      toast.success(t("expenses.receiptSuccess"));
    } catch (error: any) {
      toast.error(t("expenses.receiptError"), { description: error.message });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString + "T00:00:00").toLocaleDateString(language === "pt" ? "pt-BR" : "en-US");
  };

  const getCategoryLabel = (category: string) => t(`expenses.categories.${category}` as const);

  const exportToExcel = (dataSource: Expense[] = filteredExpenses) => {
    const data = dataSource.map((e) => ({
      [t("expenses.date")]: formatDate(e.expense_date),
      [t("expenses.description")]: e.description,
      [t("expenses.category")]: getCategoryLabel(e.category),
      [t("expenses.amount")]: Number(e.amount),
      [t("expenses.vendor")]: e.vendor || "",
      [t("expenses.paymentMethod")]: e.payment_method || "",
      [t("expenses.notes")]: e.notes || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t("nav.expenses"));
    XLSX.writeFile(wb, `expenses-${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success(t("expenses.exportSuccess"));
  };

  const exportFilteredCSV = () => {
    const headers = [t("expenses.date"), t("expenses.description"), t("expenses.category"), t("expenses.amount"), t("expenses.vendor"), t("expenses.paymentMethod"), t("expenses.notes")];
    const rows = filteredExpenses.map((e) => [
      formatDate(e.expense_date),
      e.description,
      getCategoryLabel(e.category),
      Number(e.amount).toString(),
      e.vendor || "",
      e.payment_method || "",
      e.notes || "",
    ]);
    const csvContent = [headers, ...rows].map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("filters.exportSuccess"));
  };

  const exportFilteredPDF = async () => {
    const { data: profile } = await supabase.from("profiles").select("church_name, church_cnpj").eq("id", user?.id).single();
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const churchName = profile?.church_name || "ChurchLedger";

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(churchName, pageWidth / 2, 15, { align: "center" });
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(t("expenses.title"), pageWidth / 2, 23, { align: "center" });

    const hasFilters = searchTerm || categoryFilter !== "all" || dateFrom || dateTo;
    if (hasFilters) {
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`${t("filters.exportFiltered")} (${filteredExpenses.length} ${t("import.records")})`, pageWidth / 2, 30, { align: "center" });
      doc.setTextColor(0);
    }

    autoTable(doc, {
      startY: hasFilters ? 35 : 30,
      head: [[t("expenses.date"), t("expenses.description"), t("expenses.category"), t("expenses.amount")]],
      body: filteredExpenses.map(e => [
        formatDate(e.expense_date),
        e.description,
        getCategoryLabel(e.category),
        formatCurrency(Number(e.amount)),
      ]),
      foot: [["", "", "Total:", formatCurrency(filteredTotal)]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [220, 38, 38] },
    });

    doc.save(`expenses-${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success(t("filters.exportSuccess"));
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const searchLower = searchTerm.toLowerCase();
      const catLabel = getCategoryLabel(expense.category).toLowerCase();
      const amountStr = Number(expense.amount).toString();
      const formattedAmount = formatCurrency(Number(expense.amount)).toLowerCase();
      const matchesSearch = !searchTerm || 
        expense.description.toLowerCase().includes(searchLower) ||
        expense.category.toLowerCase().includes(searchLower) ||
        catLabel.includes(searchLower) ||
        (expense.vendor?.toLowerCase().includes(searchLower)) ||
        (expense.notes?.toLowerCase().includes(searchLower)) ||
        (expense.payment_method?.toLowerCase().includes(searchLower)) ||
        amountStr.includes(searchLower) ||
        formattedAmount.includes(searchLower);
      const matchesCategory = categoryFilter === "all" || expense.category === categoryFilter;
      const expenseDate = new Date(expense.expense_date);
      const matchesDateFrom = !dateFrom || expenseDate >= new Date(dateFrom);
      const matchesDateTo = !dateTo || expenseDate <= new Date(dateTo);
      return matchesSearch && matchesCategory && matchesDateFrom && matchesDateTo;
    });
  }, [expenses, searchTerm, categoryFilter, dateFrom, dateTo]);

  const filteredTotal = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const categoryOptions = [
    { value: "salaries", label: t("expenses.categories.salaries") },
    { value: "utilities", label: t("expenses.categories.utilities") },
    { value: "maintenance", label: t("expenses.categories.maintenance") },
    { value: "missions", label: t("expenses.categories.missions") },
    { value: "events", label: t("expenses.categories.events") },
    { value: "supplies", label: t("expenses.categories.supplies") },
    { value: "other", label: t("expenses.categories.other") },
  ];

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      toast.error(t("common.error"), { description: t("attachments.invalidType") });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("common.error"), { description: t("attachments.tooLarge") });
      return;
    }
    setAttachmentFile(file);
  };

  const viewAttachment = (url: string) => {
    setViewAttachmentUrl(url);
    setIsViewAttachmentOpen(true);
  };

  const AttachmentField = () => (
    <div className="space-y-2">
      <Label>{t("attachments.label")}</Label>
      <Input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={handleAttachmentChange} disabled={isSubmitting} className="text-base" />
      {attachmentFile && <p className="text-xs text-muted-foreground">{attachmentFile.name}</p>}
      <p className="text-xs text-muted-foreground">{t("attachments.hint")}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6 sm:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">{t("expenses.title")}</h1>
            <p className="text-sm sm:text-base text-muted-foreground">{t("expenses.subtitle")}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 w-full sm:w-auto">
                  <FileDown className="h-4 w-4" />
                  {t("filters.export")}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => exportToExcel()}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  {t("filters.exportExcel")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportFilteredCSV}>
                  <FileDown className="h-4 w-4 mr-2" />
                  {t("filters.exportCSV")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportFilteredPDF}>
                  <FileText className="h-4 w-4 mr-2" />
                  {t("filters.exportPDF")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setAttachmentFile(null); }}>
              <DialogTrigger asChild>
                <Button className="gap-2 w-full sm:w-auto">
                  <Plus className="h-4 w-4" />
                  {t("expenses.new")}
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("expenses.newTitle")}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">{t("expenses.amount")} {t("common.required")}</Label>
                    <Input id="amount" name="amount" type="number" step="0.01" min="0.01" placeholder="0.00" required disabled={isSubmitting} className="text-base" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expense_date">{t("expenses.date")} {t("common.required")}</Label>
                    <Input id="expense_date" name="expense_date" type="date" defaultValue={new Date().toISOString().split("T")[0]} required disabled={isSubmitting} className="text-base" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">{t("expenses.description")} {t("common.required")}</Label>
                  <Input id="description" name="description" type="text" placeholder={t("expenses.descriptionPlaceholder")} required disabled={isSubmitting} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">{t("expenses.category")} {t("common.required")}</Label>
                    <Select name="category" defaultValue="other" required disabled={isSubmitting}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="salaries">{t("expenses.categories.salaries")}</SelectItem>
                        <SelectItem value="utilities">{t("expenses.categories.utilities")}</SelectItem>
                        <SelectItem value="maintenance">{t("expenses.categories.maintenance")}</SelectItem>
                        <SelectItem value="missions">{t("expenses.categories.missions")}</SelectItem>
                        <SelectItem value="events">{t("expenses.categories.events")}</SelectItem>
                        <SelectItem value="supplies">{t("expenses.categories.supplies")}</SelectItem>
                        <SelectItem value="other">{t("expenses.categories.other")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_method">{t("expenses.paymentMethod")}</Label>
                    <Input id="payment_method" name="payment_method" type="text" placeholder={t("common.paymentMethodPlaceholder")} disabled={isSubmitting} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vendor">{t("expenses.vendor")}</Label>
                  <Input id="vendor" name="vendor" type="text" placeholder={t("expenses.vendorPlaceholder")} disabled={isSubmitting} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">{t("expenses.notes")}</Label>
                  <Input id="notes" name="notes" type="text" placeholder={t("expenses.notesPlaceholder")} disabled={isSubmitting} />
                </div>

                <AttachmentField />

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? t("expenses.registering") : t("expenses.register")}
                </Button>
              </form>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="bg-expense-light border-expense/20 shadow-md">
          <CardHeader>
            <CardTitle className="text-expense">{t("expenses.total")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-expense">{formatCurrency(totalExpenses)}</p>
          </CardContent>
        </Card>

        <FilterBar
          searchPlaceholder={t("filters.searchPlaceholder")}
          onSearchChange={setSearchTerm}
          onTypeFilterChange={setCategoryFilter}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          typeOptions={categoryOptions}
          typeLabel={t("expenses.category")}
        />

        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("expenses.history")}</CardTitle>
            {(searchTerm || categoryFilter !== "all" || dateFrom || dateTo) && (
              <span className="text-sm text-muted-foreground">
                {filteredExpenses.length} {t("import.records")} • {formatCurrency(filteredTotal)}
              </span>
            )}
          </CardHeader>
          <CardContent>
            {filteredExpenses.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {expenses.length === 0 ? t("expenses.none") : t("filters.noResults")}
              </p>
            ) : (
              <div className="space-y-2 overflow-x-auto">
                {filteredExpenses.map((expense) => (
                  <div key={expense.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors gap-3 min-w-[280px]">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm sm:text-base">{expense.description}</p>
                        {expense.attachment_url && <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                      </div>
                      <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                        <span>{formatDate(expense.expense_date)}</span>
                        <span>• {getCategoryLabel(expense.category)}</span>
                        {expense.vendor && <span className="hidden sm:inline">• {expense.vendor}</span>}
                        {expense.payment_method && <span className="hidden sm:inline">• {expense.payment_method}</span>}
                      </div>
                      {expense.notes && <p className="text-xs sm:text-sm text-muted-foreground truncate">{expense.notes}</p>}
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                      <p className="text-lg sm:text-xl font-bold text-expense whitespace-nowrap">{formatCurrency(Number(expense.amount))}</p>
                      <div className="flex items-center gap-2">
                        {expense.attachment_url && (
                          <Button variant="outline" size="icon" onClick={() => viewAttachment(expense.attachment_url!)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="outline" size="icon" onClick={() => generateReceipt(expense)}>
                          <FileDown className="h-4 w-4" />
                        </Button>
                        <Button variant="edit" size="icon" onClick={() => handleEdit(expense)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => handleDeleteClick(expense.id)} className="bg-button-secondary hover:bg-button-secondary-hover text-button-secondary-foreground border-button-secondary flex-shrink-0">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="bg-background border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground text-lg font-semibold">{t("common.confirmDeleteTitle")}</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">{t("expenses.deleteConfirm")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-0">
              <AlertDialogCancel className="bg-button-secondary hover:bg-button-secondary-hover text-button-secondary-foreground hover:text-button-secondary-foreground border-0">{t("common.no")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} className="bg-expense hover:bg-expense/90 text-expense-foreground border-0">{t("common.yes")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* View Attachment */}
        <Dialog open={isViewAttachmentOpen} onOpenChange={setIsViewAttachmentOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader><DialogTitle>{t("attachments.view")}</DialogTitle></DialogHeader>
            {viewAttachmentUrl && (
              viewAttachmentUrl.toLowerCase().endsWith('.pdf') ? (
                <iframe src={viewAttachmentUrl} className="w-full h-[70vh] rounded-lg" />
              ) : (
                <img src={viewAttachmentUrl} alt="Attachment" className="w-full max-h-[70vh] object-contain rounded-lg" />
              )
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Expense */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) setAttachmentFile(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{t("expenses.editTitle")}</DialogTitle></DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-description">{t("expenses.description")}</Label>
                  <Input id="edit-description" name="description" defaultValue={editingExpense?.description} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-amount">{t("expenses.amount")}</Label>
                  <Input id="edit-amount" name="amount" type="number" step="0.01" defaultValue={editingExpense?.amount} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">{t("expenses.category")}</Label>
                  <Select name="category" defaultValue={editingExpense?.category}>
                    <SelectTrigger id="edit-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="salaries">{t("expenses.categories.salaries")}</SelectItem>
                      <SelectItem value="utilities">{t("expenses.categories.utilities")}</SelectItem>
                      <SelectItem value="maintenance">{t("expenses.categories.maintenance")}</SelectItem>
                      <SelectItem value="missions">{t("expenses.categories.missions")}</SelectItem>
                      <SelectItem value="events">{t("expenses.categories.events")}</SelectItem>
                      <SelectItem value="supplies">{t("expenses.categories.supplies")}</SelectItem>
                      <SelectItem value="other">{t("expenses.categories.other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-payment_method">{t("expenses.paymentMethod")}</Label>
                  <Select value={editPaymentMethod} onValueChange={setEditPaymentMethod}>
                    <SelectTrigger id="edit-payment_method"><SelectValue placeholder={t("expenses.paymentMethod")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{t("expenses.paymentMethods.cash")}</SelectItem>
                      <SelectItem value="check">{t("expenses.paymentMethods.check")}</SelectItem>
                      <SelectItem value="bank_transfer">{t("expenses.paymentMethods.bank_transfer")}</SelectItem>
                      <SelectItem value="credit_card">{t("expenses.paymentMethods.credit_card")}</SelectItem>
                      <SelectItem value="debit_card">{t("expenses.paymentMethods.debit_card")}</SelectItem>
                      <SelectItem value="pix">{t("expenses.paymentMethods.pix")}</SelectItem>
                      <SelectItem value="other">{t("expenses.paymentMethods.other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-vendor">{t("expenses.vendor")}</Label>
                  <Input id="edit-vendor" name="vendor" defaultValue={editingExpense?.vendor || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-expense_date">{t("expenses.date")}</Label>
                  <Input id="edit-expense_date" name="expense_date" type="date" defaultValue={editingExpense?.expense_date} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-notes">{t("expenses.notes")}</Label>
                <Input id="edit-notes" name="notes" defaultValue={editingExpense?.notes || ""} />
              </div>

              <AttachmentField />
              {editingExpense?.attachment_url && !attachmentFile && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Paperclip className="h-3 w-3" /> {t("attachments.existing")}
                </p>
              )}

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => { setIsEditDialogOpen(false); setEditingExpense(null); setEditPaymentMethod(""); setAttachmentFile(null); }} disabled={isSubmitting}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Expenses;
