import { DollarSign } from "lucide-react";
import { useCurrency } from "@/hooks/useCurrency";
import { useLanguage } from "@/contexts/LanguageContext";

export const CurrencyIndicator = () => {
  const { exchangeRate, lastUpdate } = useCurrency();
  const { language } = useLanguage();

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat(language === "pt" ? "pt-BR" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div className="fixed bottom-4 right-4 bg-card border rounded-lg shadow-lg p-3 flex items-center gap-2 text-sm z-50">
      <DollarSign className="h-4 w-4 text-primary" />
      <div className="flex flex-col">
        <span className="font-semibold">
          {language === "pt" ? "💱 Cotação atual:" : "💱 Current rate:"}
        </span>
        <span className="text-muted-foreground">
          R$ {exchangeRate.toFixed(2)} = US$ 1.00
        </span>
        <span className="text-xs text-muted-foreground">
          {language === "pt" ? "Atualizado às" : "Updated at"} {formatDate(lastUpdate)}
        </span>
      </div>
    </div>
  );
};
