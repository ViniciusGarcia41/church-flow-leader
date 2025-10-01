import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import { DollarSign, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { toast } from "sonner";

interface FinancialSummary {
  totalDonations: number;
  totalExpenses: number;
  balance: number;
  donationsThisMonth: number;
  expensesThisMonth: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<FinancialSummary>({
    totalDonations: 0,
    totalExpenses: 0,
    balance: 0,
    donationsThisMonth: 0,
    expensesThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchFinancialSummary();
    }
  }, [user]);

  const fetchFinancialSummary = async () => {
    try {
      // Get current month start date
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

      // Fetch donations
      const { data: donations, error: donationsError } = await supabase
        .from("donations")
        .select("amount, donation_date")
        .eq("user_id", user?.id);

      if (donationsError) throw donationsError;

      // Fetch expenses
      const { data: expenses, error: expensesError } = await supabase
        .from("expenses")
        .select("amount, expense_date")
        .eq("user_id", user?.id);

      if (expensesError) throw expensesError;

      const totalDonations = donations?.reduce((sum, d) => sum + Number(d.amount), 0) || 0;
      const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
      
      const donationsThisMonth = donations
        ?.filter((d) => d.donation_date >= monthStart)
        .reduce((sum, d) => sum + Number(d.amount), 0) || 0;
      
      const expensesThisMonth = expenses
        ?.filter((e) => e.expense_date >= monthStart)
        .reduce((sum, e) => sum + Number(e.amount), 0) || 0;

      setSummary({
        totalDonations,
        totalExpenses,
        balance: totalDonations - totalExpenses,
        donationsThisMonth,
        expensesThisMonth,
      });
    } catch (error: any) {
      toast.error("Erro ao carregar dados", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
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
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">Dashboard Financeiro</h1>
          <p className="text-muted-foreground">Visão geral das finanças da sua igreja</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-card shadow-lg border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
              <Wallet className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.balance)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Receitas - Despesas
              </p>
            </CardContent>
          </Card>

          <Card className="bg-success-light border-success/20 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Doações (Total)</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{formatCurrency(summary.totalDonations)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Acumulado geral
              </p>
            </CardContent>
          </Card>

          <Card className="bg-destructive-light border-destructive/20 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Despesas (Total)</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{formatCurrency(summary.totalExpenses)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Acumulado geral
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-primary text-primary-foreground shadow-lg border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo do Mês</CardTitle>
              <DollarSign className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.donationsThisMonth - summary.expensesThisMonth)}
              </div>
              <p className="text-xs opacity-80 mt-1">
                {formatCurrency(summary.donationsThisMonth)} - {formatCurrency(summary.expensesThisMonth)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Resumo Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-success-light">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Doações este mês</p>
                  <p className="text-xs text-muted-foreground">Receitas do mês atual</p>
                </div>
                <p className="text-xl font-bold text-success">
                  {formatCurrency(summary.donationsThisMonth)}
                </p>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-destructive-light">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Despesas este mês</p>
                  <p className="text-xs text-muted-foreground">Gastos do mês atual</p>
                </div>
                <p className="text-xl font-bold text-destructive">
                  {formatCurrency(summary.expensesThisMonth)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
