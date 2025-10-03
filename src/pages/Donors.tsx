import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import { Plus, Trash2, User, FileText } from "lucide-react";
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
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      toast.error("Erro ao carregar doadores", {
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

      toast.success("Doador cadastrado com sucesso!");
      setIsDialogOpen(false);
      fetchDonors();
      e.currentTarget.reset();
    } catch (error: any) {
      toast.error("Erro ao cadastrar doador", {
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este doador?")) return;

    try {
      const { error } = await supabase.from("donors").delete().eq("id", id);

      if (error) throw error;

      toast.success("Doador excluído com sucesso!");
      fetchDonors();
    } catch (error: any) {
      toast.error("Erro ao excluir doador", {
        description: error.message,
      });
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

      doc.save(`recibo-${donor.name.replace(/\s+/g, "-")}-${new Date().getTime()}.pdf`);
      toast.success("Recibo gerado com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao gerar recibo", {
        description: error.message,
      });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">Doadores</h1>
            <p className="text-muted-foreground">Gerencie o cadastro de doadores e membros</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Doador
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Doador</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo *</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="Nome do doador"
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="email@exemplo.com"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="(00) 00000-0000"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    id="address"
                    name="address"
                    type="text"
                    placeholder="Endereço completo"
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

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Cadastrando..." : "Cadastrar Doador"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Lista de Doadores</CardTitle>
          </CardHeader>
          <CardContent>
            {donors.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum doador cadastrado ainda</p>
            ) : (
              <div className="space-y-2">
                {donors.map((donor) => (
                  <div
                    key={donor.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
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
                        variant="outline"
                        size="sm"
                        onClick={() => generateDonorReceipt(donor.id)}
                        className="gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        Recibo
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
      </div>
    </div>
  );
};

export default Donors;
