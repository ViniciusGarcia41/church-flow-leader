import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/hooks/useCurrency";
import Navbar from "@/components/Navbar";
import { DollarSign, TrendingUp, TrendingDown, Wallet, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PeriodType = "total" | "year" | "month" | "custom";

interface RawDonation {
  amount: number;
  donation_date: string;
}

interface RawExpense {
  amount: number;
  expense_date: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();
  const [donations, setDonations] = useState<RawDonation[]>([]);
  const [expenses, setExpenses] = useState<RawExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>("total");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [chartYear, setChartYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const [donRes, expRes] = await Promise.all([
        supabase.from("donations").select("amount, donation_date").eq("user_id", user?.id),
        supabase.from("expenses").select("amount, expense_date").eq("user_id", user?.id),
      ]);
      if (donRes.error) throw donRes.error;
      if (expRes.error) throw expRes.error;
      setDonations(donRes.data || []);
      setExpenses(expRes.data || []);
    } catch (error: any) {
      toast.error(t("dashboard.loadError"), { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Filter helper
  const getDateRange = (): { from: string | null; to: string | null } => {
    const now = new Date();
    if (period === "total") return { from: null, to: null };
    if (period === "year") {
      return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` };
    }
    if (period === "month") {
      const ms = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const me = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      return { from: ms, to: me };
    }
    // custom
    return { from: customFrom || null, to: customTo || null };
  };

  const filteredSummary = useMemo(() => {
    const { from, to } = getDateRange();
    const fDon = donations.filter((d) => {
      if (from && d.donation_date < from) return false;
      if (to && d.donation_date > to) return false;
      return true;
    });
    const fExp = expenses.filter((e) => {
      if (from && e.expense_date < from) return false;
      if (to && e.expense_date > to) return false;
      return true;
    });
    const totalDonations = fDon.reduce((s, d) => s + Number(d.amount), 0);
    const totalExpenses = fExp.reduce((s, e) => s + Number(e.amount), 0);

    // Monthly values (current month)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const donationsThisMonth = fDon.filter((d) => d.donation_date >= monthStart).reduce((s, d) => s + Number(d.amount), 0);
    const expensesThisMonth = fExp.filter((e) => e.expense_date >= monthStart).reduce((s, e) => s + Number(e.amount), 0);

    return { totalDonations, totalExpenses, balance: totalDonations - totalExpenses, donationsThisMonth, expensesThisMonth };
  }, [donations, expenses, period, customFrom, customTo]);

  // Chart data - month by month for selected year
  const chartData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const monthStr = String(i + 1).padStart(2, "0");
      const prefix = `${chartYear}-${monthStr}`;
      const rev = donations.filter((d) => d.donation_date.startsWith(prefix)).reduce((s, d) => s + Number(d.amount), 0);
      const exp = expenses.filter((e) => e.expense_date.startsWith(prefix)).reduce((s, e) => s + Number(e.amount), 0);
      return {
        month: new Date(chartYear, i).toLocaleString("default", { month: "short" }),
        revenue: rev,
        expenses: exp,
        balance: rev - exp,
      };
    });
    return months;
  }, [donations, expenses, chartYear]);

  const chartConfig = {
    revenue: { label: t("dashboard.chartRevenue"), color: "hsl(var(--income))" },
    expenses: { label: t("dashboard.chartExpenses"), color: "hsl(var(--expense))" },
    balance: { label: t("dashboard.chartBalance"), color: "hsl(var(--info))" },
  };

  // Available years from data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    donations.forEach((d) => years.add(new Date(d.donation_date).getFullYear()));
    expenses.forEach((e) => years.add(new Date(e.expense_date).getFullYear()));
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [donations, expenses]);

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
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">{t("dashboard.title")}</h1>
            <p className="text-sm sm:text-base text-muted-foreground">{t("dashboard.subtitle")}</p>
          </div>

          {/* Period selector */}
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("dashboard.period")}</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
                <SelectTrigger className="w-[160px] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total">{t("dashboard.periodTotal")}</SelectItem>
                  <SelectItem value="year">{t("dashboard.periodYear")}</SelectItem>
                  <SelectItem value="month">{t("dashboard.periodMonth")}</SelectItem>
                  <SelectItem value="custom">{t("dashboard.periodCustom")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {period === "custom" && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("filters.from")}</Label>
                  <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 w-[140px] text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("filters.to")}</Label>
                  <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9 w-[140px] text-sm" />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Cards */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-card shadow-lg border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">{t("dashboard.totalBalance")}</CardTitle>
              <Wallet className="h-4 w-4 text-primary flex-shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{formatCurrency(filteredSummary.balance)}</div>
              <p className="text-xs text-muted-foreground mt-1">{t("dashboard.totalBalanceDesc")}</p>
            </CardContent>
          </Card>

          <Card className="bg-income-light border-income/20 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">{t("dashboard.donationsTotal")}</CardTitle>
              <TrendingUp className="h-4 w-4 text-income flex-shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-income">{formatCurrency(filteredSummary.totalDonations)}</div>
              <p className="text-xs text-muted-foreground mt-1">{t("dashboard.accumulatedTotal")}</p>
            </CardContent>
          </Card>

          <Card className="bg-expense-light border-expense/20 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">{t("dashboard.expensesTotal")}</CardTitle>
              <TrendingDown className="h-4 w-4 text-expense flex-shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-expense">{formatCurrency(filteredSummary.totalExpenses)}</div>
              <p className="text-xs text-muted-foreground mt-1">{t("dashboard.accumulatedTotal")}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-primary text-primary-foreground shadow-lg border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">{t("dashboard.monthBalance")}</CardTitle>
              <DollarSign className="h-4 w-4 flex-shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">
                {formatCurrency(filteredSummary.donationsThisMonth - filteredSummary.expensesThisMonth)}
              </div>
              <p className="text-xs opacity-80 mt-1 break-words">
                {formatCurrency(filteredSummary.donationsThisMonth)} - {formatCurrency(filteredSummary.expensesThisMonth)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Annual Chart */}
        <Card className="shadow-lg">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
              {t("dashboard.annualChart")}
            </CardTitle>
            <Select value={String(chartYear)} onValueChange={(v) => setChartYear(Number(v))}>
              <SelectTrigger className="w-[100px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="month" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--income))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="expenses" stroke="hsl(var(--expense))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="balance" stroke="hsl(var(--info))" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ChartContainer>
            <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-income" />
                <span className="text-muted-foreground">{t("dashboard.chartRevenue")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-expense" />
                <span className="text-muted-foreground">{t("dashboard.chartExpenses")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-info" />
                <span className="text-muted-foreground">{t("dashboard.chartBalance")}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Summary */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>{t("dashboard.monthlySummary")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-income-light border border-income/20">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{t("dashboard.donationsThisMonth")}</p>
                  <p className="text-xs text-muted-foreground">{t("dashboard.monthRevenue")}</p>
                </div>
                <p className="text-xl font-bold text-income">{formatCurrency(filteredSummary.donationsThisMonth)}</p>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-expense-light border border-expense/20">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{t("dashboard.expensesThisMonth")}</p>
                  <p className="text-xs text-muted-foreground">{t("dashboard.monthExpenses")}</p>
                </div>
                <p className="text-xl font-bold text-expense">{formatCurrency(filteredSummary.expensesThisMonth)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
