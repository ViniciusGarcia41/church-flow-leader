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
import { Plus, Trash2, FileDown, Pencil, Paperclip, Eye, FileText, FileSpreadsheet, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Donation {
  id: string;
  amount: number;
  donation_type: string;
  category: string | null;
  payment_method: string | null;
  notes: string | null;
  donation_date: string;
  donor_id: string | null;
  attachment_url: string | null;
  donors?: { name: string; cpf_cnpj?: string | null } | null;
}

interface Donor {
  id: string;
  name: string;
  cpf_cnpj?: string | null;
}

const Donations = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { formatCurrency } = useCurrency();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDonor, setSelectedDonor] = useState<string>("");
  const [editingDonation, setEditingDonation] = useState<Donation | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [donationToDelete, setDonationToDelete] = useState<string | null>(null);
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [viewAttachmentUrl, setViewAttachmentUrl] = useState<string | null>(null);
  const [isViewAttachmentOpen, setIsViewAttachmentOpen] = useState(false);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (user) {
      fetchDonations();
      fetchDonors();
    }
  }, [user]);

  const fetchDonors = async () => {
    try {
      const { data, error } = await supabase
        .from("donors")
        .select("id, name, cpf_cnpj")
        .eq("user_id", user?.id)
        .order("name", { ascending: true });

      if (error) throw error;
      setDonors(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar doadores:", error.message);
    }
  };

  const fetchDonations = async () => {
    try {
      const { data, error } = await supabase
        .from("donations")
        .select(`
          *,
          donors (name, cpf_cnpj)
        `)
        .eq("user_id", user?.id)
        .order("donation_date", { ascending: false });

      if (error) throw error;
      setDonations(data || []);
    } catch (error: any) {
      toast.error(t("donations.loadError"), {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadAttachment = async (file: File, transactionId: string): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const filePath = `${user?.id}/${transactionId}.${fileExt}`;
    
    const { error } = await supabase.storage
      .from("transaction-attachments")
      .upload(filePath, file, { upsert: true });
    
    if (error) throw error;
    
    const { data } = supabase.storage
      .from("transaction-attachments")
      .getPublicUrl(filePath);
    
    return data.publicUrl;
  };

  const deleteAttachment = async (attachmentUrl: string) => {
    try {
      const url = new URL(attachmentUrl);
      const pathParts = url.pathname.split('/transaction-attachments/');
      if (pathParts.length > 1) {
        await supabase.storage
          .from("transaction-attachments")
          .remove([pathParts[1]]);
      }
    } catch (e) {
      console.error("Error deleting attachment:", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const donationData: any = {
      user_id: user?.id,
      donor_id: selectedDonor === "anonymous" || !selectedDonor ? null : selectedDonor,
      amount: parseFloat(formData.get("amount") as string),
      donation_type: formData.get("donation_type") as "tithe" | "offering" | "special_project" | "campaign",
      category: formData.get("category") as string || null,
      payment_method: formData.get("payment_method") as string || null,
      notes: formData.get("notes") as string || null,
      donation_date: formData.get("donation_date") as string,
    };

    try {
      const { data, error } = await supabase.from("donations").insert([donationData]).select().single();
      if (error) throw error;

      if (attachmentFile && data) {
        const url = await uploadAttachment(attachmentFile, data.id);
        await supabase.from("donations").update({ attachment_url: url }).eq("id", data.id);
      }

      toast.success(t("donations.success"));
      setIsDialogOpen(false);
      setSelectedDonor("");
      setIsRecurring(false);
      setAttachmentFile(null);
      fetchDonations();
      e.currentTarget.reset();
    } catch (error: any) {
      toast.error(t("donations.registerError"), {
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setDonationToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!donationToDelete) return;

    try {
      const donation = donations.find(d => d.id === donationToDelete);
      if (donation?.attachment_url) {
        await deleteAttachment(donation.attachment_url);
      }

      const { error } = await supabase.from("donations").delete().eq("id", donationToDelete);
      if (error) throw error;

      toast.success(t("donations.deleteSuccess"));
      fetchDonations();
    } catch (error: any) {
      toast.error(t("donations.deleteError"), {
        description: error.message,
      });
    } finally {
      setDeleteDialogOpen(false);
      setDonationToDelete(null);
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

  const handleEdit = (donation: Donation) => {
    setEditingDonation(donation);
    setSelectedDonor(donation.donor_id || "anonymous");
    setEditPaymentMethod(donation.payment_method ? getPaymentMethodKey(donation.payment_method) : "");
    setIsEditDialogOpen(true);
  };

  const getPaymentMethodLabel = (key: string): string => {
    if (!key) return "";
    const translationKey = `donations.paymentMethods.${key}` as const;
    return t(translationKey);
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingDonation) return;
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const donationData: any = {
      donor_id: selectedDonor === "anonymous" || !selectedDonor ? null : selectedDonor,
      amount: parseFloat(formData.get("amount") as string),
      donation_type: formData.get("donation_type") as "tithe" | "offering" | "special_project" | "campaign",
      category: formData.get("category") as string || null,
      payment_method: editPaymentMethod ? getPaymentMethodLabel(editPaymentMethod) : null,
      notes: formData.get("notes") as string || null,
      donation_date: formData.get("donation_date") as string,
    };

    try {
      if (attachmentFile) {
        if (editingDonation.attachment_url) {
          await deleteAttachment(editingDonation.attachment_url);
        }
        const url = await uploadAttachment(attachmentFile, editingDonation.id);
        donationData.attachment_url = url;
      }

      const { error } = await supabase
        .from("donations")
        .update(donationData)
        .eq("id", editingDonation.id);

      if (error) throw error;

      toast.success(t("donations.updateSuccess"));
      setIsEditDialogOpen(false);
      setEditingDonation(null);
      setSelectedDonor("");
      setEditPaymentMethod("");
      setAttachmentFile(null);
      fetchDonations();
    } catch (error: any) {
      toast.error(t("donations.updateError"), {
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateReceipt = async (donation: Donation) => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("church_name, church_cnpj")
        .eq("id", user?.id)
        .single();

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const churchName = profile?.church_name || localStorage.getItem("churchledger-appname") || "ChurchLedger";
      const churchCnpj = (profile as any)?.church_cnpj || "";
      const receiptNumber = `REC-${donation.id.substring(0, 8).toUpperCase()}`;

      // Try to add logo
      const savedLogo = localStorage.getItem("churchledger-logo");
      let yPos = 15;
      if (savedLogo) {
        try {
          doc.addImage(savedLogo, "PNG", 14, yPos, 25, 25);
          doc.setFontSize(18);
          doc.setFont("helvetica", "bold");
          doc.text(churchName, 44, yPos + 10);
          if (churchCnpj) {
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(`CNPJ: ${churchCnpj}`, 44, yPos + 17);
          }
          yPos += 32;
        } catch {
          doc.setFontSize(18);
          doc.setFont("helvetica", "bold");
          doc.text(churchName, pageWidth / 2, yPos + 5, { align: "center" });
          if (churchCnpj) {
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(`CNPJ: ${churchCnpj}`, pageWidth / 2, yPos + 12, { align: "center" });
          }
          yPos += 20;
        }
      } else {
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text(churchName, pageWidth / 2, yPos + 5, { align: "center" });
        if (churchCnpj) {
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          doc.text(`CNPJ: ${churchCnpj}`, pageWidth / 2, yPos + 12, { align: "center" });
        }
        yPos += 20;
      }

      // Line separator
      doc.setDrawColor(200, 200, 200);
      doc.line(14, yPos, pageWidth - 14, yPos);
      yPos += 8;

      // Receipt title and number
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(language === "pt" ? "RECIBO DE DOAÇÃO" : "DONATION RECEIPT", pageWidth / 2, yPos, { align: "center" });
      yPos += 7;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Nº ${receiptNumber}`, pageWidth / 2, yPos, { align: "center" });
      yPos += 12;

      // Donor info
      const donorName = donation.donors?.name || (language === "pt" ? "Anônimo" : "Anonymous");
      const donorCpfCnpj = donation.donors?.cpf_cnpj || "";

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(language === "pt" ? "Doador:" : "Donor:", 14, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(donorName, 50, yPos);
      yPos += 7;

      if (donorCpfCnpj) {
        doc.setFont("helvetica", "bold");
        doc.text("CPF/CNPJ:", 14, yPos);
        doc.setFont("helvetica", "normal");
        doc.text(donorCpfCnpj, 50, yPos);
        yPos += 7;
      }

      // Transaction details
      doc.setFont("helvetica", "bold");
      doc.text(language === "pt" ? "Data:" : "Date:", 14, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(new Date(donation.donation_date + "T00:00:00").toLocaleDateString(language === "pt" ? "pt-BR" : "en-US"), 50, yPos);
      yPos += 7;

      doc.setFont("helvetica", "bold");
      doc.text(language === "pt" ? "Tipo:" : "Type:", 14, yPos);
      doc.setFont("helvetica", "normal");
      const typeKey = `donations.types.${donation.donation_type}` as const;
      doc.text(t(typeKey), 50, yPos);
      yPos += 7;

      if (donation.category) {
        doc.setFont("helvetica", "bold");
        doc.text(language === "pt" ? "Categoria:" : "Category:", 14, yPos);
        doc.setFont("helvetica", "normal");
        doc.text(donation.category, 50, yPos);
        yPos += 7;
      }

      if (donation.payment_method) {
        doc.setFont("helvetica", "bold");
        doc.text(language === "pt" ? "Pagamento:" : "Payment:", 14, yPos);
        doc.setFont("helvetica", "normal");
        doc.text(donation.payment_method, 50, yPos);
        yPos += 7;
      }

      yPos += 3;
      doc.setDrawColor(200, 200, 200);
      doc.line(14, yPos, pageWidth - 14, yPos);
      yPos += 10;

      // Amount
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(language === "pt" ? "Valor:" : "Amount:", 14, yPos);
      doc.text(formatCurrency(Number(donation.amount)), pageWidth - 14, yPos, { align: "right" });
      yPos += 10;

      doc.setDrawColor(200, 200, 200);
      doc.line(14, yPos, pageWidth - 14, yPos);
      yPos += 8;

      // Notes
      if (donation.notes) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(language === "pt" ? "Observações:" : "Notes:", 14, yPos);
        yPos += 6;
        doc.setFont("helvetica", "normal");
        const splitNotes = doc.splitTextToSize(donation.notes, pageWidth - 28);
        doc.text(splitNotes, 14, yPos);
        yPos += splitNotes.length * 5 + 5;
      }

      // Footer
      const footerY = doc.internal.pageSize.height - 20;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(150);
      const emissionDate = new Date().toLocaleDateString(language === "pt" ? "pt-BR" : "en-US");
      doc.text(
        `${language === "pt" ? "Emitido em" : "Issued on"}: ${emissionDate}`,
        pageWidth / 2, footerY, { align: "center" }
      );

      doc.save(`recibo-doacao-${receiptNumber}.pdf`);
      toast.success(t("donations.receiptSuccess"));
    } catch (error: any) {
      toast.error(t("donations.receiptError"), { description: error.message });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString + "T00:00:00").toLocaleDateString(language === "pt" ? "pt-BR" : "en-US");
  };

  const getDonationTypeLabel = (type: string) => {
    const typeKey = `donations.types.${type}` as const;
    return t(typeKey);
  };

  const exportToExcel = (dataSource: Donation[] = filteredDonations) => {
    const data = dataSource.map((d) => ({
      [t("donations.date")]: formatDate(d.donation_date),
      [t("donations.type")]: getDonationTypeLabel(d.donation_type),
      [t("donations.amount")]: Number(d.amount),
      [t("donations.donor")]: d.donors?.name || t("donations.anonymous"),
      [t("donations.category")]: d.category || "",
      [t("donations.paymentMethod")]: d.payment_method || "",
      [t("donations.notes")]: d.notes || "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t("nav.donations"));
    XLSX.writeFile(wb, `donations-${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success(t("donations.exportSuccess"));
  };

  const exportFilteredCSV = () => {
    const headers = [t("donations.date"), t("donations.type"), t("donations.amount"), t("donations.donor"), t("donations.category"), t("donations.paymentMethod"), t("donations.notes")];
    const rows = filteredDonations.map((d) => [
      formatDate(d.donation_date),
      getDonationTypeLabel(d.donation_type),
      Number(d.amount).toString(),
      d.donors?.name || t("donations.anonymous"),
      d.category || "",
      d.payment_method || "",
      d.notes || "",
    ]);
    const csvContent = [headers, ...rows].map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `donations-${new Date().toISOString().split("T")[0]}.csv`;
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
    doc.text(t("donations.title"), pageWidth / 2, 23, { align: "center" });

    const hasFilters = searchTerm || typeFilter !== "all" || dateFrom || dateTo;
    if (hasFilters) {
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`${t("filters.exportFiltered")} (${filteredDonations.length} ${t("import.records")})`, pageWidth / 2, 30, { align: "center" });
      doc.setTextColor(0);
    }

    autoTable(doc, {
      startY: hasFilters ? 35 : 30,
      head: [[t("donations.date"), t("donations.type"), t("donations.donor"), t("donations.amount")]],
      body: filteredDonations.map(d => [
        formatDate(d.donation_date),
        getDonationTypeLabel(d.donation_type),
        d.donors?.name || t("donations.anonymous"),
        formatCurrency(Number(d.amount)),
      ]),
      foot: [["", "", "Total:", formatCurrency(filteredTotal)]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`donations-${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success(t("filters.exportSuccess"));
  };

  const totalDonations = donations.reduce((sum, d) => sum + Number(d.amount), 0);

  const filteredDonations = useMemo(() => {
    return donations.filter((donation) => {
      const searchLower = searchTerm.toLowerCase();
      const typeLabel = getDonationTypeLabel(donation.donation_type).toLowerCase();
      const amountStr = Number(donation.amount).toString();
      const formattedAmount = formatCurrency(Number(donation.amount)).toLowerCase();
      const matchesSearch = !searchTerm || 
        donation.donation_type.toLowerCase().includes(searchLower) ||
        typeLabel.includes(searchLower) ||
        (donation.category?.toLowerCase().includes(searchLower)) ||
        (donation.notes?.toLowerCase().includes(searchLower)) ||
        (donation.donors?.name?.toLowerCase().includes(searchLower)) ||
        (donation.donors?.cpf_cnpj?.toLowerCase().includes(searchLower)) ||
        (donation.payment_method?.toLowerCase().includes(searchLower)) ||
        amountStr.includes(searchLower) ||
        formattedAmount.includes(searchLower);

      const matchesType = typeFilter === "all" || donation.donation_type === typeFilter;

      const donationDate = new Date(donation.donation_date);
      const matchesDateFrom = !dateFrom || donationDate >= new Date(dateFrom);
      const matchesDateTo = !dateTo || donationDate <= new Date(dateTo);

      return matchesSearch && matchesType && matchesDateFrom && matchesDateTo;
    });
  }, [donations, searchTerm, typeFilter, dateFrom, dateTo]);

  const filteredTotal = filteredDonations.reduce((sum, d) => sum + Number(d.amount), 0);

  const donationTypeOptions = [
    { value: "tithe", label: t("donations.types.tithe") },
    { value: "offering", label: t("donations.types.offering") },
    { value: "special_project", label: t("donations.types.special_project") },
    { value: "campaign", label: t("donations.types.campaign") },
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
      <Input
        type="file"
        accept=".jpg,.jpeg,.png,.pdf"
        onChange={handleAttachmentChange}
        disabled={isSubmitting}
        className="text-base"
      />
      {attachmentFile && (
        <p className="text-xs text-muted-foreground">{attachmentFile.name}</p>
      )}
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
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">{t("donations.title")}</h1>
            <p className="text-sm sm:text-base text-muted-foreground">{t("donations.subtitle")}</p>
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
                  {t("donations.new")}
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("donations.newTitle")}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="donor">{t("donations.donor")}</Label>
                  <Select value={selectedDonor} onValueChange={setSelectedDonor} disabled={isSubmitting}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("donations.selectDonor")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="anonymous">{t("donations.anonymous")}</SelectItem>
                      {donors.map((donor) => (
                        <SelectItem key={donor.id} value={donor.id}>
                          {donor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">{t("donations.amount")} {t("common.required")}</Label>
                    <Input id="amount" name="amount" type="number" step="0.01" min="0.01" placeholder="0.00" required disabled={isSubmitting} className="text-base" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="donation_date">{t("donations.date")} {t("common.required")}</Label>
                    <Input id="donation_date" name="donation_date" type="date" defaultValue={new Date().toISOString().split("T")[0]} required disabled={isSubmitting} className="text-base" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="donation_type">{t("donations.type")} {t("common.required")}</Label>
                    <Select name="donation_type" defaultValue="offering" required disabled={isSubmitting}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tithe">{t("donations.types.tithe")}</SelectItem>
                        <SelectItem value="offering">{t("donations.types.offering")}</SelectItem>
                        <SelectItem value="special_project">{t("donations.types.special_project")}</SelectItem>
                        <SelectItem value="campaign">{t("donations.types.campaign")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_method">{t("donations.paymentMethod")}</Label>
                    <Input id="payment_method" name="payment_method" type="text" placeholder={t("common.paymentMethodPlaceholder")} disabled={isSubmitting} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">{t("donations.category")}</Label>
                  <Input id="category" name="category" type="text" placeholder={t("donations.categoryPlaceholder")} disabled={isSubmitting} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">{t("donations.notes")}</Label>
                  <Input id="notes" name="notes" type="text" placeholder={t("donations.notesPlaceholder")} disabled={isSubmitting} />
                </div>

                <AttachmentField />

                <div className="flex items-center space-x-2">
                  <Checkbox id="recurring" checked={isRecurring} onCheckedChange={(checked) => setIsRecurring(checked as boolean)} disabled={isSubmitting} />
                  <Label htmlFor="recurring" className="text-sm font-normal cursor-pointer">{t("donations.recurring")}</Label>
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? t("donations.registering") : t("donations.register")}
                </Button>
              </form>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="bg-income-light border-income/20 shadow-md">
          <CardHeader>
            <CardTitle className="text-income">{t("donations.total")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-income">{formatCurrency(totalDonations)}</p>
          </CardContent>
        </Card>

        <FilterBar
          searchPlaceholder={t("filters.searchPlaceholder")}
          onSearchChange={setSearchTerm}
          onTypeFilterChange={setTypeFilter}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          typeOptions={donationTypeOptions}
          typeLabel={t("donations.type")}
        />

        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("donations.history")}</CardTitle>
            {(searchTerm || typeFilter !== "all" || dateFrom || dateTo) && (
              <span className="text-sm text-muted-foreground">
                {filteredDonations.length} {t("import.records")} • {formatCurrency(filteredTotal)}
              </span>
            )}
          </CardHeader>
          <CardContent>
            {filteredDonations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {donations.length === 0 ? t("donations.none") : t("filters.noResults")}
              </p>
            ) : (
              <div className="space-y-2 overflow-x-auto">
                {filteredDonations.map((donation) => (
                  <div
                    key={donation.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors gap-3 min-w-[280px]"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm sm:text-base">{getDonationTypeLabel(donation.donation_type)}</p>
                        {donation.attachment_url && (
                          <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                        <span>{formatDate(donation.donation_date)}</span>
                        {donation.category && <span>• {donation.category}</span>}
                        {donation.payment_method && <span className="hidden sm:inline">• {donation.payment_method}</span>}
                      </div>
                      {donation.notes && (
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">{donation.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                      <p className="text-lg sm:text-xl font-bold text-income whitespace-nowrap">
                        {formatCurrency(Number(donation.amount))}
                      </p>
                      <div className="flex items-center gap-2">
                        {donation.attachment_url && (
                          <Button variant="outline" size="icon" onClick={() => viewAttachment(donation.attachment_url!)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="outline" size="icon" onClick={() => generateReceipt(donation)}>
                          <FileDown className="h-4 w-4" />
                        </Button>
                        <Button variant="edit" size="icon" onClick={() => handleEdit(donation)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDeleteClick(donation.id)}
                          className="bg-button-secondary hover:bg-button-secondary-hover text-button-secondary-foreground border-button-secondary flex-shrink-0"
                        >
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

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="bg-background border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground text-lg font-semibold">{t("common.confirmDeleteTitle")}</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">{t("donations.deleteConfirm")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-0">
              <AlertDialogCancel className="bg-button-secondary hover:bg-button-secondary-hover text-button-secondary-foreground hover:text-button-secondary-foreground border-0">{t("common.no")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} className="bg-expense hover:bg-expense/90 text-expense-foreground border-0">{t("common.yes")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* View Attachment Dialog */}
        <Dialog open={isViewAttachmentOpen} onOpenChange={setIsViewAttachmentOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{t("attachments.view")}</DialogTitle>
            </DialogHeader>
            {viewAttachmentUrl && (
              viewAttachmentUrl.toLowerCase().endsWith('.pdf') ? (
                <iframe src={viewAttachmentUrl} className="w-full h-[70vh] rounded-lg" />
              ) : (
                <img src={viewAttachmentUrl} alt="Attachment" className="w-full max-h-[70vh] object-contain rounded-lg" />
              )
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Donation Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) setAttachmentFile(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("donations.editTitle")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-donor">{t("donations.donor")}</Label>
                  <Select value={selectedDonor} onValueChange={setSelectedDonor}>
                    <SelectTrigger id="edit-donor"><SelectValue placeholder={t("donations.selectDonor")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="anonymous">{t("donations.anonymous")}</SelectItem>
                      {donors.map((donor) => (
                        <SelectItem key={donor.id} value={donor.id}>{donor.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-amount">{t("donations.amount")}</Label>
                  <Input id="edit-amount" name="amount" type="number" step="0.01" defaultValue={editingDonation?.amount} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-donation_type">{t("donations.type")}</Label>
                  <Select name="donation_type" defaultValue={editingDonation?.donation_type}>
                    <SelectTrigger id="edit-donation_type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tithe">{t("donations.types.tithe")}</SelectItem>
                      <SelectItem value="offering">{t("donations.types.offering")}</SelectItem>
                      <SelectItem value="special_project">{t("donations.types.special_project")}</SelectItem>
                      <SelectItem value="campaign">{t("donations.types.campaign")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">{t("donations.category")}</Label>
                  <Input id="edit-category" name="category" defaultValue={editingDonation?.category || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-payment_method">{t("donations.paymentMethod")}</Label>
                  <Select value={editPaymentMethod} onValueChange={setEditPaymentMethod}>
                    <SelectTrigger id="edit-payment_method"><SelectValue placeholder={t("donations.paymentMethod")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{t("donations.paymentMethods.cash")}</SelectItem>
                      <SelectItem value="check">{t("donations.paymentMethods.check")}</SelectItem>
                      <SelectItem value="bank_transfer">{t("donations.paymentMethods.bank_transfer")}</SelectItem>
                      <SelectItem value="credit_card">{t("donations.paymentMethods.credit_card")}</SelectItem>
                      <SelectItem value="debit_card">{t("donations.paymentMethods.debit_card")}</SelectItem>
                      <SelectItem value="pix">{t("donations.paymentMethods.pix")}</SelectItem>
                      <SelectItem value="other">{t("donations.paymentMethods.other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-donation_date">{t("donations.date")}</Label>
                  <Input id="edit-donation_date" name="donation_date" type="date" defaultValue={editingDonation?.donation_date} required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-notes">{t("donations.notes")}</Label>
                <Input id="edit-notes" name="notes" defaultValue={editingDonation?.notes || ""} />
              </div>

              <AttachmentField />
              {editingDonation?.attachment_url && !attachmentFile && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Paperclip className="h-3 w-3" /> {t("attachments.existing")}
                </p>
              )}

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => { setIsEditDialogOpen(false); setEditingDonation(null); setSelectedDonor(""); setEditPaymentMethod(""); setAttachmentFile(null); }} disabled={isSubmitting}>
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

export default Donations;
