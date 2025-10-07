import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import Navbar from "@/components/Navbar";
import { Plus, Trash2, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import * as XLSX from "xlsx";

interface Donation {
  id: string;
  amount: number;
  donation_type: string;
  category: string | null;
  payment_method: string | null;
  notes: string | null;
  donation_date: string;
  donor_id: string | null;
  donors?: { name: string } | null;
}

interface Donor {
  id: string;
  name: string;
}

const Donations = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDonor, setSelectedDonor] = useState<string>("");

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
        .select("id, name")
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
          donors (name)
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const donationData = {
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
      const { error } = await supabase.from("donations").insert([donationData]);

      if (error) throw error;

      toast.success(t("donations.success"));
      setIsDialogOpen(false);
      setSelectedDonor("");
      setIsRecurring(false);
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

  const handleDelete = async (id: string) => {
    if (!confirm(t("donations.deleteConfirm"))) return;

    try {
      const { error } = await supabase.from("donations").delete().eq("id", id);

      if (error) throw error;

      toast.success(t("donations.deleteSuccess"));
      fetchDonations();
    } catch (error: any) {
      toast.error(t("donations.deleteError"), {
        description: error.message,
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(language === "pt" ? "pt-BR" : "en-US", {
      style: "currency",
      currency: language === "pt" ? "BRL" : "USD",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString + "T00:00:00").toLocaleDateString(language === "pt" ? "pt-BR" : "en-US");
  };

  const getDonationTypeLabel = (type: string) => {
    const typeKey = `donations.types.${type}` as const;
    return t(typeKey);
  };

  const exportToExcel = () => {
    const data = donations.map((d) => ({
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

  const totalDonations = donations.reduce((sum, d) => sum + Number(d.amount), 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">{t("donations.title")}</h1>
            <p className="text-muted-foreground">{t("donations.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportToExcel} variant="outline" className="gap-2">
              <FileDown className="h-4 w-4" />
              {t("donations.exportExcel")}
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t("donations.new")}
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl">
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">{t("donations.amount")} {t("common.required")}</Label>
                    <Input
                      id="amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="donation_date">{t("donations.date")} {t("common.required")}</Label>
                    <Input
                      id="donation_date"
                      name="donation_date"
                      type="date"
                      defaultValue={new Date().toISOString().split("T")[0]}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="donation_type">{t("donations.type")} {t("common.required")}</Label>
                    <Select name="donation_type" defaultValue="offering" required disabled={isSubmitting}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
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
                    <Input
                      id="payment_method"
                      name="payment_method"
                      type="text"
                      placeholder={t("common.paymentMethodPlaceholder")}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">{t("donations.category")}</Label>
                  <Input
                    id="category"
                    name="category"
                    type="text"
                    placeholder={t("donations.categoryPlaceholder")}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">{t("donations.notes")}</Label>
                  <Input
                    id="notes"
                    name="notes"
                    type="text"
                    placeholder={t("donations.notesPlaceholder")}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="recurring"
                    checked={isRecurring}
                    onCheckedChange={(checked) => setIsRecurring(checked as boolean)}
                    disabled={isSubmitting}
                  />
                  <Label htmlFor="recurring" className="text-sm font-normal cursor-pointer">
                    {t("donations.recurring")}
                  </Label>
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? t("donations.registering") : t("donations.register")}
                </Button>
              </form>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="bg-success-light border-success/20 shadow-md">
          <CardHeader>
            <CardTitle className="text-success">{t("donations.total")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-success">{formatCurrency(totalDonations)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>{t("donations.history")}</CardTitle>
          </CardHeader>
          <CardContent>
            {donations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {t("donations.none")}
              </p>
            ) : (
              <div className="space-y-2">
                {donations.map((donation) => (
                  <div
                    key={donation.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{getDonationTypeLabel(donation.donation_type)}</p>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>{formatDate(donation.donation_date)}</span>
                        {donation.category && <span>• {donation.category}</span>}
                        {donation.payment_method && <span>• {donation.payment_method}</span>}
                      </div>
                      {donation.notes && (
                        <p className="text-sm text-muted-foreground">{donation.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-xl font-bold text-success">
                        {formatCurrency(Number(donation.amount))}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(donation.id)}
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
      </div>
    </div>
  );
};

export default Donations;
