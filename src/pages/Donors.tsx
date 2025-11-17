import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import Navbar from "@/components/Navbar";
import { Plus, Trash2, User, FileText, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Donor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

const Donors = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingDonor, setEditingDonor] = useState<Donor | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchDonors();
    }
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
      toast.error(t("donors.loadError"), {
        description: error.message,
      });
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
    };

    try {
      const { error } = await supabase.from("donors").insert([donorData]);

      if (error) throw error;

      toast.success(t("donors.success"));
      setIsDialogOpen(false);
      fetchDonors();
      e.currentTarget.reset();
    } catch (error: any) {
      toast.error(t("donors.registerError"), {
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("donors.deleteConfirm"))) return;

    try {
      const { error } = await supabase.from("donors").delete().eq("id", id);

      if (error) throw error;

      toast.success(t("donors.deleteSuccess"));
      fetchDonors();
    } catch (error: any) {
      toast.error(t("donors.deleteError"), {
        description: error.message,
      });
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
    };

    try {
      const { error } = await supabase
        .from("donors")
        .update(donorData)
        .eq("id", editingDonor.id);

      if (error) throw error;

      toast.success(t("donors.updateSuccess"));
      setIsEditDialogOpen(false);
      setEditingDonor(null);
      fetchDonors();
    } catch (error: any) {
      toast.error(t("donors.updateError"), {
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateDonorReceipt = async (donorId: string) => {
    try {
      // Buscar doações do doador
      const { data: donations, error } = await supabase
        .from("donations")
        .select("*, donors(name)")
        .eq("donor_id", donorId)
        .order("donation_date", { ascending: false });

      if (error) throw error;

      const donor = donors.find((d) => d.id === donorId);
      if (!donor) return;

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;

      // Título
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Recibo de Doações", pageWidth / 2, 20, { align: "center" });

      // Info do doador
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Doador: ${donor.name}`, 14, 35);
      if (donor.email) doc.text(`Email: ${donor.email}`, 14, 42);
      if (donor.phone) doc.text(`Telefone: ${donor.phone}`, 14, 49);

      // Total
      const total = (donations || []).reduce((sum, d) => sum + Number(d.amount), 0);
      doc.setFontSize(11);
      doc.text(
        `Total Doado: ${new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(total)}`,
        14,
        60
      );

      // Tabela de doações
      autoTable(doc, {
        startY: 68,
        head: [["Data", "Tipo", "Valor", "Categoria"]],
        body: (donations || []).map((d) => [
          new Date(d.donation_date + "T00:00:00").toLocaleDateString("pt-BR"),
          d.donation_type === "tithe"
            ? "Dízimo"
            : d.donation_type === "offering"
            ? "Oferta"
            : d.donation_type === "special_project"
            ? "Projeto Especial"
            : "Campanha",
          new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(Number(d.amount)),
          d.category || "-",
        ]),
        theme: "grid",
        headStyles: { fillColor: [59, 130, 246] },
      });

      doc.save(`receipt-${donor.name.replace(/\s+/g, "-")}-${new Date().getTime()}.pdf`);
      toast.success(t("donors.receiptSuccess"));
    } catch (error: any) {
      toast.error(t("donors.receiptError"), {
        description: error.message,
      });
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
      <div className="container mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">{t("donors.title")}</h1>
            <p className="text-muted-foreground">{t("donors.subtitle")}</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                {t("donors.new")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t("donors.newTitle")}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("donors.name")} {t("common.required")}</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder={t("donors.name")}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">{t("donors.email")}</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder={t("donors.emailPlaceholder")}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t("donors.phone")}</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder={t("donors.phonePlaceholder")}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">{t("donors.address")}</Label>
                  <Input
                    id="address"
                    name="address"
                    type="text"
                    placeholder={t("donors.addressPlaceholder")}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">{t("donors.notes")}</Label>
                  <Input
                    id="notes"
                    name="notes"
                    type="text"
                    placeholder={t("donors.notesPlaceholder")}
                    disabled={isSubmitting}
                  />
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
              <div className="space-y-2">
                {donors.map((donor) => (
                  <div
                    key={donor.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5" style={{ color: '#e4e1d2' }} />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium">{donor.name}</p>
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          {donor.email && <span>{donor.email}</span>}
                          {donor.phone && <span>• {donor.phone}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                    <Button
                      variant="edit"
                      size="xs"
                      className="gap-1"
                      onClick={() => handleEdit(donor)}
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateDonorReceipt(donor.id)}
                        className="gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        {t("donors.receipt")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(donor.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive-light"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Donor Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("donors.editTitle")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">{t("donors.name")}</Label>
                  <Input
                    id="edit-name"
                    name="name"
                    defaultValue={editingDonor?.name}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-email">{t("donors.email")}</Label>
                  <Input
                    id="edit-email"
                    name="email"
                    type="email"
                    defaultValue={editingDonor?.email || ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-phone">{t("donors.phone")}</Label>
                  <Input
                    id="edit-phone"
                    name="phone"
                    defaultValue={editingDonor?.phone || ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-address">{t("donors.address")}</Label>
                  <Input
                    id="edit-address"
                    name="address"
                    defaultValue={editingDonor?.address || ""}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-notes">{t("donors.notes")}</Label>
                <Input
                  id="edit-notes"
                  name="notes"
                  defaultValue={editingDonor?.notes || ""}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingDonor(null);
                  }}
                  disabled={isSubmitting}
                >
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

export default Donors;
