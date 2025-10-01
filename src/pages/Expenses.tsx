import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  payment_method: string | null;
  vendor: string | null;
  notes: string | null;
  expense_date: string;
}

const Expenses = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchExpenses();
    }
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
      toast.error("Erro ao carregar despesas", {
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
    const expenseData = {
      user_id: user?.id,
      description: formData.get("description") as string,
      amount: parseFloat(formData.get("amount") as string),
      category: formData.get("category") as "salaries" | "utilities" | "maintenance" | "missions" | "events" | "supplies" | "other",
      payment_method: formData.get("payment_method") as string || null,
      vendor: formData.get("vendor") as string || null,
      notes: formData.get("notes") as string || null,
      expense_date: formData.get("expense_date") as string,
    };

    try {
      const { error } = await supabase.from("expenses").insert([expenseData]);

      if (error) throw error;

      toast.success("Despesa cadastrada com sucesso!");
      setIsDialogOpen(false);
      fetchExpenses();
      e.currentTarget.reset();
    } catch (error: any) {
      toast.error("Erro ao cadastrar despesa", {
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta despesa?")) return;

    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);

      if (error) throw error;

      toast.success("Despesa excluída com sucesso!");
      fetchExpenses();
    } catch (error: any) {
      toast.error("Erro ao excluir despesa", {
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

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      salaries: "Salários",
      utilities: "Utilidades",
      maintenance: "Manutenção",
      missions: "Missões",
      events: "Eventos",
      supplies: "Materiais",
      other: "Outros",
    };
    return labels[category] || category;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">Despesas</h1>
            <p className="text-muted-foreground">Gerencie todas as despesas da igreja</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Despesa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Cadastrar Nova Despesa</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                    <Label htmlFor="expense_date">Data *</Label>
                    <Input
                      id="expense_date"
                      name="expense_date"
                      type="date"
                      defaultValue={new Date().toISOString().split("T")[0]}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição *</Label>
                  <Input
                    id="description"
                    name="description"
                    type="text"
                    placeholder="Ex: Conta de luz"
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria *</Label>
                    <Select name="category" defaultValue="other" required disabled={isSubmitting}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="salaries">Salários</SelectItem>
                        <SelectItem value="utilities">Utilidades</SelectItem>
                        <SelectItem value="maintenance">Manutenção</SelectItem>
                        <SelectItem value="missions">Missões</SelectItem>
                        <SelectItem value="events">Eventos</SelectItem>
                        <SelectItem value="supplies">Materiais</SelectItem>
                        <SelectItem value="other">Outros</SelectItem>
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
                  <Label htmlFor="vendor">Fornecedor</Label>
                  <Input
                    id="vendor"
                    name="vendor"
                    type="text"
                    placeholder="Nome do fornecedor"
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
                  {isSubmitting ? "Cadastrando..." : "Cadastrar Despesa"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="bg-destructive-light border-destructive/20 shadow-md">
          <CardHeader>
            <CardTitle className="text-destructive">Total de Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-destructive">{formatCurrency(totalExpenses)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Histórico de Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma despesa cadastrada ainda
              </p>
            ) : (
              <div className="space-y-2">
                {expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{expense.description}</p>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>{formatDate(expense.expense_date)}</span>
                        <span>• {getCategoryLabel(expense.category)}</span>
                        {expense.vendor && <span>• {expense.vendor}</span>}
                        {expense.payment_method && <span>• {expense.payment_method}</span>}
                      </div>
                      {expense.notes && (
                        <p className="text-sm text-muted-foreground">{expense.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-xl font-bold text-destructive">
                        {formatCurrency(Number(expense.amount))}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(expense.id)}
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

export default Expenses;
