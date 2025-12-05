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
import { Plus, Trash2, Pencil } from "lucide-react";
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
  const { t, language } = useLanguage();
  const { formatCurrency } = useCurrency();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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
      toast.error(t("expenses.loadError"), {
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

      toast.success(t("expenses.success"));
      setIsDialogOpen(false);
      fetchExpenses();
      e.currentTarget.reset();
    } catch (error: any) {
      toast.error(t("expenses.registerError"), {
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("expenses.deleteConfirm"))) return;

    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);

      if (error) throw error;

      toast.success(t("expenses.deleteSuccess"));
      fetchExpenses();
    } catch (error: any) {
      toast.error(t("expenses.deleteError"), {
        description: error.message,
      });
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingExpense) return;
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const expenseData = {
      description: formData.get("description") as string,
      amount: parseFloat(formData.get("amount") as string),
      category: formData.get("category") as "salaries" | "utilities" | "maintenance" | "missions" | "events" | "supplies" | "other",
      payment_method: formData.get("payment_method") as string || null,
      vendor: formData.get("vendor") as string || null,
      notes: formData.get("notes") as string || null,
      expense_date: formData.get("expense_date") as string,
    };

    try {
      const { error } = await supabase
        .from("expenses")
        .update(expenseData)
        .eq("id", editingExpense.id);

      if (error) throw error;

      toast.success(t("expenses.updateSuccess"));
      setIsEditDialogOpen(false);
      setEditingExpense(null);
      fetchExpenses();
    } catch (error: any) {
      toast.error(t("expenses.updateError"), {
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString + "T00:00:00").toLocaleDateString(language === "pt" ? "pt-BR" : "en-US");
  };

  const getCategoryLabel = (category: string) => {
    const categoryKey = `expenses.categories.${category}` as const;
    return t(categoryKey);
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  // Filter expenses - must be before any conditional returns
  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        expense.description.toLowerCase().includes(searchLower) ||
        expense.category.toLowerCase().includes(searchLower) ||
        (expense.vendor?.toLowerCase().includes(searchLower)) ||
        (expense.notes?.toLowerCase().includes(searchLower)) ||
        (expense.payment_method?.toLowerCase().includes(searchLower));

      const matchesCategory = categoryFilter === "all" || expense.category === categoryFilter;

      const expenseDate = new Date(expense.expense_date);
      const matchesDateFrom = !dateFrom || expenseDate >= new Date(dateFrom);
      const matchesDateTo = !dateTo || expenseDate <= new Date(dateTo);

      return matchesSearch && matchesCategory && matchesDateFrom && matchesDateTo;
    });
  }, [expenses, searchTerm, categoryFilter, dateFrom, dateTo]);

  const filteredTotal = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const categoryOptions = [
    { value: "salaries", label: t("expenses.categories.salaries") },
    { value: "utilities", label: t("expenses.categories.utilities") },
    { value: "maintenance", label: t("expenses.categories.maintenance") },
    { value: "missions", label: t("expenses.categories.missions") },
    { value: "events", label: t("expenses.categories.events") },
    { value: "supplies", label: t("expenses.categories.supplies") },
    { value: "other", label: t("expenses.categories.other") },
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
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">{t("expenses.title")}</h1>
            <p className="text-sm sm:text-base text-muted-foreground">{t("expenses.subtitle")}</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                {t("expenses.new")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("expenses.newTitle")}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">{t("expenses.amount")} {t("common.required")}</Label>
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
                    <Label htmlFor="expense_date">{t("expenses.date")} {t("common.required")}</Label>
                    <Input
                      id="expense_date"
                      name="expense_date"
                      type="date"
                      defaultValue={new Date().toISOString().split("T")[0]}
                      required
                      disabled={isSubmitting}
                      className="text-base"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">{t("expenses.description")} {t("common.required")}</Label>
                  <Input
                    id="description"
                    name="description"
                    type="text"
                    placeholder={t("expenses.descriptionPlaceholder")}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">{t("expenses.category")} {t("common.required")}</Label>
                    <Select name="category" defaultValue="other" required disabled={isSubmitting}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="salaries">{t("expenses.categories.salaries")}</SelectItem>
                        <SelectItem value="utilities">{t("expenses.categories.utilities")}</SelectItem>
                        <SelectItem value="maintenance">{t("expenses.categories.maintenance")}</SelectItem>
                        <SelectItem value="missions">{t("expenses.categories.missions")}</SelectItem>
                        <SelectItem value="events">{t("expenses.categories.events")}</SelectItem>
                        <SelectItem value="supplies">{t("expenses.categories.supplies")}</SelectItem>
                        <SelectItem value="other">{t("expenses.categories.other")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_method">{t("expenses.paymentMethod")}</Label>
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
                  <Label htmlFor="vendor">{t("expenses.vendor")}</Label>
                  <Input
                    id="vendor"
                    name="vendor"
                    type="text"
                    placeholder={t("expenses.vendorPlaceholder")}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">{t("expenses.notes")}</Label>
                  <Input
                    id="notes"
                    name="notes"
                    type="text"
                    placeholder={t("expenses.notesPlaceholder")}
                    disabled={isSubmitting}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? t("expenses.registering") : t("expenses.register")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="bg-destructive-light border-destructive/20 shadow-md">
          <CardHeader>
            <CardTitle className="text-destructive">{t("expenses.total")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-destructive">{formatCurrency(totalExpenses)}</p>
          </CardContent>
        </Card>

        {/* Filter Bar */}
        <FilterBar
          searchPlaceholder={t("filters.searchPlaceholder")}
          onSearchChange={setSearchTerm}
          onTypeFilterChange={setCategoryFilter}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          typeOptions={categoryOptions}
          typeLabel={t("expenses.category")}
        />

        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("expenses.history")}</CardTitle>
            {(searchTerm || categoryFilter !== "all" || dateFrom || dateTo) && (
              <span className="text-sm text-muted-foreground">
                {filteredExpenses.length} {t("import.records")} • {formatCurrency(filteredTotal)}
              </span>
            )}
          </CardHeader>
          <CardContent>
            {filteredExpenses.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {expenses.length === 0 ? t("expenses.none") : t("filters.noResults")}
              </p>
            ) : (
              <div className="space-y-2 overflow-x-auto">
                {filteredExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors gap-3 min-w-[280px]"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="font-medium text-sm sm:text-base">{expense.description}</p>
                      <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                        <span>{formatDate(expense.expense_date)}</span>
                        <span>• {getCategoryLabel(expense.category)}</span>
                        {expense.vendor && <span className="hidden sm:inline">• {expense.vendor}</span>}
                        {expense.payment_method && <span className="hidden sm:inline">• {expense.payment_method}</span>}
                      </div>
                      {expense.notes && (
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">{expense.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                      <p className="text-lg sm:text-xl font-bold text-destructive whitespace-nowrap">
                        {formatCurrency(Number(expense.amount))}
                      </p>
                      <div className="flex items-center gap-2">
                      <Button
                        variant="edit"
                        size="xs"
                        className="gap-1"
                        onClick={() => handleEdit(expense)}
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(expense.id)}
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

        {/* Edit Expense Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("expenses.editTitle")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-description">{t("expenses.description")}</Label>
                  <Input
                    id="edit-description"
                    name="description"
                    defaultValue={editingExpense?.description}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-amount">{t("expenses.amount")}</Label>
                  <Input
                    id="edit-amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    defaultValue={editingExpense?.amount}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-category">{t("expenses.category")}</Label>
                  <Select name="category" defaultValue={editingExpense?.category}>
                    <SelectTrigger id="edit-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="salaries">{t("expenses.categories.salaries")}</SelectItem>
                      <SelectItem value="utilities">{t("expenses.categories.utilities")}</SelectItem>
                      <SelectItem value="maintenance">{t("expenses.categories.maintenance")}</SelectItem>
                      <SelectItem value="missions">{t("expenses.categories.missions")}</SelectItem>
                      <SelectItem value="events">{t("expenses.categories.events")}</SelectItem>
                      <SelectItem value="supplies">{t("expenses.categories.supplies")}</SelectItem>
                      <SelectItem value="other">{t("expenses.categories.other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-payment_method">{t("expenses.paymentMethod")}</Label>
                  <Select name="payment_method" defaultValue={editingExpense?.payment_method || ""}>
                    <SelectTrigger id="edit-payment_method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{t("expenses.paymentMethods.cash")}</SelectItem>
                      <SelectItem value="check">{t("expenses.paymentMethods.check")}</SelectItem>
                      <SelectItem value="bank_transfer">{t("expenses.paymentMethods.bank_transfer")}</SelectItem>
                      <SelectItem value="credit_card">{t("expenses.paymentMethods.credit_card")}</SelectItem>
                      <SelectItem value="pix">{t("expenses.paymentMethods.pix")}</SelectItem>
                      <SelectItem value="other">{t("expenses.paymentMethods.other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-vendor">{t("expenses.vendor")}</Label>
                  <Input
                    id="edit-vendor"
                    name="vendor"
                    defaultValue={editingExpense?.vendor || ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-expense_date">{t("expenses.date")}</Label>
                  <Input
                    id="edit-expense_date"
                    name="expense_date"
                    type="date"
                    defaultValue={editingExpense?.expense_date}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-notes">{t("expenses.notes")}</Label>
                <Input
                  id="edit-notes"
                  name="notes"
                  defaultValue={editingExpense?.notes || ""}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingExpense(null);
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

export default Expenses;
