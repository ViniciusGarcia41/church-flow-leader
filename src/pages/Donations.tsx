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
import { Plus, Trash2, FileDown, Pencil } from "lucide-react";
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

  const handleEdit = (donation: Donation) => {
    setEditingDonation(donation);
    setSelectedDonor(donation.donor_id || "anonymous");
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingDonation) return;
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const donationData = {
      donor_id: selectedDonor === "anonymous" || !selectedDonor ? null : selectedDonor,
      amount: parseFloat(formData.get("amount") as string),
      donation_type: formData.get("donation_type") as "tithe" | "offering" | "special_project" | "campaign",
      category: formData.get("category") as string || null,
      payment_method: formData.get("payment_method") as string || null,
      notes: formData.get("notes") as string || null,
      donation_date: formData.get("donation_date") as string,
    };

    try {
      const { error } = await supabase
        .from("donations")
        .update(donationData)
        .eq("id", editingDonation.id);

      if (error) throw error;

      toast.success(t("donations.updateSuccess"));
      setIsEditDialogOpen(false);
      setEditingDonation(null);
      setSelectedDonor("");
      fetchDonations();
    } catch (error: any) {
      toast.error(t("donations.updateError"), {
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
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

  const totalDonations = donations.reduce((sum, d) => sum + Number(d.amount), 0);

  // Filter donations - must be before any conditional returns
  const filteredDonations = useMemo(() => {
    return donations.filter((donation) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        donation.donation_type.toLowerCase().includes(searchLower) ||
        (donation.category?.toLowerCase().includes(searchLower)) ||
        (donation.notes?.toLowerCase().includes(searchLower)) ||
        (donation.donors?.name?.toLowerCase().includes(searchLower)) ||
        (donation.payment_method?.toLowerCase().includes(searchLower));

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
            <Button onClick={exportToExcel} variant="outline" className="gap-2 w-full sm:w-auto">
              <FileDown className="h-4 w-4" />
              <span className="sm:inline">{t("donations.exportExcel")}</span>
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                    <Input
                      id="amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      required
                      disabled={isSubmitting}
                      className="text-base"
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
                      className="text-base"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        {/* Filter Bar */}
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
                      <p className="font-medium text-sm sm:text-base">{getDonationTypeLabel(donation.donation_type)}</p>
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
                      <p className="text-lg sm:text-xl font-bold text-success whitespace-nowrap">
                        {formatCurrency(Number(donation.amount))}
                      </p>
                      <div className="flex items-center gap-2">
                      <Button
                        variant="edit"
                        size="xs"
                        className="gap-1"
                        onClick={() => handleEdit(donation)}
                      >
                        <Pencil className="h-3 w-3" />
                        {t("common.edit")}
                      </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(donation.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive-light flex-shrink-0"
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

        {/* Edit Donation Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("donations.editTitle")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-donor">{t("donations.donor")}</Label>
                  <Select value={selectedDonor} onValueChange={setSelectedDonor}>
                    <SelectTrigger id="edit-donor">
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

                <div className="space-y-2">
                  <Label htmlFor="edit-amount">{t("donations.amount")}</Label>
                  <Input
                    id="edit-amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    defaultValue={editingDonation?.amount}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-donation_type">{t("donations.type")}</Label>
                  <Select name="donation_type" defaultValue={editingDonation?.donation_type}>
                    <SelectTrigger id="edit-donation_type">
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
                  <Label htmlFor="edit-category">{t("donations.category")}</Label>
                  <Input
                    id="edit-category"
                    name="category"
                    defaultValue={editingDonation?.category || ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-payment_method">{t("donations.paymentMethod")}</Label>
                  <Select name="payment_method" defaultValue={editingDonation?.payment_method || ""}>
                    <SelectTrigger id="edit-payment_method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{t("donations.paymentMethods.cash")}</SelectItem>
                      <SelectItem value="check">{t("donations.paymentMethods.check")}</SelectItem>
                      <SelectItem value="bank_transfer">{t("donations.paymentMethods.bank_transfer")}</SelectItem>
                      <SelectItem value="credit_card">{t("donations.paymentMethods.credit_card")}</SelectItem>
                      <SelectItem value="pix">{t("donations.paymentMethods.pix")}</SelectItem>
                      <SelectItem value="other">{t("donations.paymentMethods.other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-donation_date">{t("donations.date")}</Label>
                  <Input
                    id="edit-donation_date"
                    name="donation_date"
                    type="date"
                    defaultValue={editingDonation?.donation_date}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-notes">{t("donations.notes")}</Label>
                <Input
                  id="edit-notes"
                  name="notes"
                  defaultValue={editingDonation?.notes || ""}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingDonation(null);
                    setSelectedDonor("");
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

export default Donations;
