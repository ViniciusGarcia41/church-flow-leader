import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
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
      toast.error("Erro ao carregar doações", {
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
      donor_id: selectedDonor || null,
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

      toast.success("Doação cadastrada com sucesso!");
      setIsDialogOpen(false);
      setSelectedDonor("");
      setIsRecurring(false);
      fetchDonations();
      e.currentTarget.reset();
    } catch (error: any) {
      toast.error("Erro ao cadastrar doação", {
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta doação?")) return;

    try {
      const { error } = await supabase.from("donations").delete().eq("id", id);

      if (error) throw error;

      toast.success("Doação excluída com sucesso!");
      fetchDonations();
    } catch (error: any) {
      toast.error("Erro ao excluir doação", {
        description: error.message,
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString + "T00:00:00").toLocaleDateString("pt-BR");
  };

  const getDonationTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      tithe: "Dízimo",
      offering: "Oferta",
      special_project: "Projeto Especial",
      campaign: "Campanha",
    };
    return labels[type] || type;
  };

  const exportToExcel = () => {
    const data = donations.map((d) => ({
      Data: formatDate(d.donation_date),
      Tipo: getDonationTypeLabel(d.donation_type),
      Valor: Number(d.amount),
      Doador: d.donors?.name || "Anônimo",
      Categoria: d.category || "",
      "Forma de Pagamento": d.payment_method || "",
      Observações: d.notes || "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Doações");
    XLSX.writeFile(wb, `doacoes-${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Excel exportado com sucesso!");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
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
            <h1 className="text-4xl font-bold">Doações</h1>
            <p className="text-muted-foreground">Gerencie todas as doações recebidas</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportToExcel} variant="outline" className="gap-2">
              <FileDown className="h-4 w-4" />
              Exportar Excel
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nova Doação
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Cadastrar Nova Doação</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="donor">Doador</Label>
                  <Select value={selectedDonor} onValueChange={setSelectedDonor} disabled={isSubmitting}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um doador (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="anonymous">Anônimo</SelectItem>
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
                    <Label htmlFor="amount">Valor *</Label>
                    <Input
                      id="amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0,00"
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="donation_date">Data *</Label>
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
                    <Label htmlFor="donation_type">Tipo *</Label>
                    <Select name="donation_type" defaultValue="offering" required disabled={isSubmitting}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tithe">Dízimo</SelectItem>
                        <SelectItem value="offering">Oferta</SelectItem>
                        <SelectItem value="special_project">Projeto Especial</SelectItem>
                        <SelectItem value="campaign">Campanha</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_method">Forma de Pagamento</Label>
                    <Input
                      id="payment_method"
                      name="payment_method"
                      type="text"
                      placeholder="Ex: Dinheiro, PIX, Cartão"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Categoria / Projeto</Label>
                  <Input
                    id="category"
                    name="category"
                    type="text"
                    placeholder="Ex: Construção, Missões"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Input
                    id="notes"
                    name="notes"
                    type="text"
                    placeholder="Informações adicionais"
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
                    Doação recorrente (mensal)
                  </Label>
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Cadastrando..." : "Cadastrar Doação"}
                </Button>
              </form>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="bg-success-light border-success/20 shadow-md">
          <CardHeader>
            <CardTitle className="text-success">Total de Doações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-success">{formatCurrency(totalDonations)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Histórico de Doações</CardTitle>
          </CardHeader>
          <CardContent>
            {donations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma doação cadastrada ainda
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
