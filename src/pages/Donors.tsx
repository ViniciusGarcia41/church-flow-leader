import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/hooks/useCurrency";
import Navbar from "@/components/Navbar";
import { Plus, Trash2, User, FileText, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Donor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  cpf_cnpj: string | null;
  created_at: string;
}

const Donors = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { formatCurrency } = useCurrency();
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingDonor, setEditingDonor] = useState<Donor | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [donorToDelete, setDonorToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchDonors();
  }, [user]);

  const fetchDonors = async () => {
    try {
      const { data, error } = await supabase
        .from("donors")
        .select("*")
        .eq("user_id", user?.id)
        .order("name", { ascending: true });
      if (error) throw error;
      setDonors(data || []);
    } catch (error: any) {
      toast.error(t("donors.loadError"), { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const donorData = {
      user_id: user?.id,
      name: formData.get("name") as string,
      email: formData.get("email") as string || null,
      phone: formData.get("phone") as string || null,
      address: formData.get("address") as string || null,
      notes: formData.get("notes") as string || null,
      cpf_cnpj: formData.get("cpf_cnpj") as string || null,
    };

    try {
      const { error } = await supabase.from("donors").insert([donorData]);
      if (error) throw error;
      toast.success(t("donors.success"));
      setIsDialogOpen(false);
      fetchDonors();
      e.currentTarget.reset();
    } catch (error: any) {
      toast.error(t("donors.registerError"), { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setDonorToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!donorToDelete) return;
    try {
      const { error } = await supabase.from("donors").delete().eq("id", donorToDelete);
      if (error) throw error;
      toast.success(t("donors.deleteSuccess"));
      fetchDonors();
    } catch (error: any) {
      toast.error(t("donors.deleteError"), { description: error.message });
    } finally {
      setDeleteDialogOpen(false);
      setDonorToDelete(null);
    }
  };

  const handleEdit = (donor: Donor) => {
    setEditingDonor(donor);
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingDonor) return;
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const donorData = {
      name: formData.get("name") as string,
      email: formData.get("email") as string || null,
      phone: formData.get("phone") as string || null,
      address: formData.get("address") as string || null,
      notes: formData.get("notes") as string || null,
      cpf_cnpj: formData.get("cpf_cnpj") as string || null,
    };

    try {
      const { error } = await supabase.from("donors").update(donorData).eq("id", editingDonor.id);
      if (error) throw error;
      toast.success(t("donors.updateSuccess"));
      setIsEditDialogOpen(false);
      setEditingDonor(null);
      fetchDonors();
    } catch (error: any) {
      toast.error(t("donors.updateError"), { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateDonorReceipt = async (donorId: string) => {
    try {
      const donor = donors.find(d => d.id === donorId);
      if (!donor) return;

      const { data: donations, error } = await supabase
        .from("donations")
        .select("*")
        .eq("donor_id", donorId)
        .order("donation_date", { ascending: false });
      if (error) throw error;

      const { data: profile } = await supabase.from("profiles").select("church_name, church_cnpj").eq("id", user?.id).single();

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const churchName = profile?.church_name || localStorage.getItem("churchledger-appname") || "ChurchLedger";
      const churchCnpj = (profile as any)?.church_cnpj || "";

      const savedLogo = localStorage.getItem("churchledger-logo");
      let yPos = 15;
      if (savedLogo) {
        try {
          doc.addImage(savedLogo, "PNG", 14, yPos, 25, 25);
          doc.setFontSize(18); doc.setFont("helvetica", "bold");
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
      doc.text(language === "pt" ? "RECIBO DE DOAÇÕES" : "DONATIONS RECEIPT", pageWidth / 2, yPos, { align: "center" }); yPos += 12;

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold"); doc.text(language === "pt" ? "Doador:" : "Donor:", 14, yPos);
      doc.setFont("helvetica", "normal"); doc.text(donor.name, 50, yPos); yPos += 7;

      if (donor.cpf_cnpj) {
        doc.setFont("helvetica", "bold"); doc.text("CPF/CNPJ:", 14, yPos);
        doc.setFont("helvetica", "normal"); doc.text(donor.cpf_cnpj, 50, yPos); yPos += 7;
      }
      if (donor.email) {
        doc.setFont("helvetica", "bold"); doc.text("Email:", 14, yPos);
        doc.setFont("helvetica", "normal"); doc.text(donor.email, 50, yPos); yPos += 7;
      }
      if (donor.phone) {
        doc.setFont("helvetica", "bold"); doc.text(language === "pt" ? "Telefone:" : "Phone:", 14, yPos);
        doc.setFont("helvetica", "normal"); doc.text(donor.phone, 50, yPos); yPos += 7;
      }

      const total = (donations || []).reduce((sum, d) => sum + Number(d.amount), 0);
      yPos += 3;
      doc.setFont("helvetica", "bold");
      doc.text(`Total: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total)}`, 14, yPos);
      yPos += 5;

      autoTable(doc, {
        startY: yPos + 3,
        head: [[
          language === "pt" ? "Data" : "Date",
          language === "pt" ? "Tipo" : "Type",
          language === "pt" ? "Valor" : "Amount",
          language === "pt" ? "Categoria" : "Category",
          language === "pt" ? "Pagamento" : "Payment",
        ]],
        body: (donations || []).map((d) => [
          new Date(d.donation_date + "T00:00:00").toLocaleDateString(language === "pt" ? "pt-BR" : "en-US"),
          d.donation_type === "tithe" ? (language === "pt" ? "Dízimo" : "Tithe")
            : d.donation_type === "offering" ? (language === "pt" ? "Oferta" : "Offering")
            : d.donation_type === "special_project" ? (language === "pt" ? "Projeto Especial" : "Special Project")
            : (language === "pt" ? "Campanha" : "Campaign"),
          new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(d.amount)),
          d.category || "-",
          d.payment_method || "-",
        ]),
        theme: "grid",
        headStyles: { fillColor: [46, 63, 79] },
      });

      const footerY = doc.internal.pageSize.height - 20;
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(150);
      doc.text(`${language === "pt" ? "Emitido em" : "Issued on"}: ${new Date().toLocaleDateString(language === "pt" ? "pt-BR" : "en-US")}`, pageWidth / 2, footerY, { align: "center" });

      doc.save(`receipt-${donor.name.replace(/\s+/g, "-")}-${new Date().getTime()}.pdf`);
      toast.success(t("donors.receiptSuccess"));
    } catch (error: any) {
      toast.error(t("donors.receiptError"), { description: error.message });
    }
  };

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
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">{t("donors.title")}</h1>
            <p className="text-sm sm:text-base text-muted-foreground">{t("donors.subtitle")}</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                {t("donors.new")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("donors.newTitle")}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("donors.name")} {t("common.required")}</Label>
                  <Input id="name" name="name" type="text" placeholder={t("donors.name")} required disabled={isSubmitting} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cpf_cnpj">{t("donors.cpfCnpj")}</Label>
                  <Input id="cpf_cnpj" name="cpf_cnpj" type="text" placeholder={t("donors.cpfCnpjPlaceholder")} disabled={isSubmitting} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">{t("donors.email")}</Label>
                    <Input id="email" name="email" type="email" placeholder={t("donors.emailPlaceholder")} disabled={isSubmitting} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t("donors.phone")}</Label>
                    <Input id="phone" name="phone" type="tel" placeholder={t("donors.phonePlaceholder")} disabled={isSubmitting} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">{t("donors.address")}</Label>
                  <Input id="address" name="address" type="text" placeholder={t("donors.addressPlaceholder")} disabled={isSubmitting} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">{t("donors.notes")}</Label>
                  <Input id="notes" name="notes" type="text" placeholder={t("donors.notesPlaceholder")} disabled={isSubmitting} />
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? t("donors.registering") : t("donors.register")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>{t("donors.list")}</CardTitle>
          </CardHeader>
          <CardContent>
            {donors.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">{t("donors.none")}</p>
            ) : (
              <div className="space-y-3">
                {donors.map((donor) => (
                  <div key={donor.id} className="flex flex-col gap-4 p-4 sm:p-5 rounded-lg border border-border hover:bg-muted/50 transition-colors w-full">
                    <div className="flex items-start gap-3 sm:gap-4 w-full">
                      <div className="h-12 w-12 flex-shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <p className="font-semibold text-base sm:text-lg">{donor.name}</p>
                        <div className="space-y-1">
                          {donor.cpf_cnpj && <p className="text-sm text-muted-foreground">CPF/CNPJ: {donor.cpf_cnpj}</p>}
                          {donor.email && <p className="text-sm text-muted-foreground break-all">{donor.email}</p>}
                          {donor.phone && <p className="text-sm text-muted-foreground">{donor.phone}</p>}
                          {donor.address && <p className="text-sm text-muted-foreground">{donor.address}</p>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                      <Button variant="edit" size="icon" onClick={() => handleEdit(donor)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => generateDonorReceipt(donor.id)}>
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => handleDeleteClick(donor.id)} className="bg-button-secondary hover:bg-button-secondary-hover text-button-secondary-foreground border-button-secondary">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="bg-card">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">{t("common.confirmDelete")}</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">{t("donors.deleteConfirm")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-button-secondary hover:bg-button-secondary-hover text-button-secondary-foreground hover:text-button-secondary-foreground border-0">{t("common.no")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} className="bg-expense hover:bg-expense/90 text-expense-foreground">{t("common.yes")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{t("donors.editTitle")}</DialogTitle></DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">{t("donors.name")}</Label>
                  <Input id="edit-name" name="name" defaultValue={editingDonor?.name} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-cpf_cnpj">{t("donors.cpfCnpj")}</Label>
                  <Input id="edit-cpf_cnpj" name="cpf_cnpj" defaultValue={editingDonor?.cpf_cnpj || ""} placeholder={t("donors.cpfCnpjPlaceholder")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">{t("donors.email")}</Label>
                  <Input id="edit-email" name="email" type="email" defaultValue={editingDonor?.email || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">{t("donors.phone")}</Label>
                  <Input id="edit-phone" name="phone" defaultValue={editingDonor?.phone || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-address">{t("donors.address")}</Label>
                  <Input id="edit-address" name="address" defaultValue={editingDonor?.address || ""} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-notes">{t("donors.notes")}</Label>
                <Input id="edit-notes" name="notes" defaultValue={editingDonor?.notes || ""} />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => { setIsEditDialogOpen(false); setEditingDonor(null); }} disabled={isSubmitting}>{t("common.cancel")}</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? t("common.saving") : t("common.save")}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Donors;
