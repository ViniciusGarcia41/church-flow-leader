import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Filter, X, Calendar } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterBarProps {
  searchPlaceholder?: string;
  onSearchChange: (value: string) => void;
  onTypeFilterChange?: (value: string) => void;
  onDateFromChange?: (value: string) => void;
  onDateToChange?: (value: string) => void;
  typeOptions?: FilterOption[];
  typeLabel?: string;
  showDateFilter?: boolean;
}

const FilterBar = ({
  searchPlaceholder,
  onSearchChange,
  onTypeFilterChange,
  onDateFromChange,
  onDateToChange,
  typeOptions,
  typeLabel,
  showDateFilter = true,
}: FilterBarProps) => {
  const { t } = useLanguage();
  const [searchValue, setSearchValue] = useState("");
  const [typeValue, setTypeValue] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    onSearchChange(value);
  };

  const handleTypeChange = (value: string) => {
    setTypeValue(value);
    onTypeFilterChange?.(value);
  };

  const handleDateFromChange = (value: string) => {
    setDateFrom(value);
    onDateFromChange?.(value);
  };

  const handleDateToChange = (value: string) => {
    setDateTo(value);
    onDateToChange?.(value);
  };

  const clearFilters = () => {
    setSearchValue("");
    setTypeValue("all");
    setDateFrom("");
    setDateTo("");
    onSearchChange("");
    onTypeFilterChange?.("all");
    onDateFromChange?.("");
    onDateToChange?.("");
  };

  const hasActiveFilters = searchValue || typeValue !== "all" || dateFrom || dateTo;

  return (
    <div className="space-y-3">
      {/* Main search bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder || t("filters.searchPlaceholder")}
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 h-10 bg-input-bg"
          />
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={isExpanded ? "secondary" : "outline"}
            size="default"
            onClick={() => setIsExpanded(!isExpanded)}
            className="gap-2 h-10"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">{t("filters.filters")}</span>
          </Button>
          
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="default"
              onClick={clearFilters}
              className="gap-2 h-10 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">{t("filters.clear")}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Expanded filters */}
      {isExpanded && (
        <div className="flex flex-col sm:flex-row gap-3 p-4 rounded-lg border border-border bg-input-bg animate-in slide-in-from-top-2 duration-200">
          {typeOptions && typeOptions.length > 0 && (
            <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
              <label className="text-xs font-medium text-muted-foreground">
                {typeLabel || t("filters.type")}
              </label>
              <Select value={typeValue} onValueChange={handleTypeChange}>
                <SelectTrigger className="h-9 bg-input-bg">
                  <SelectValue placeholder={t("filters.all")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.all")}</SelectItem>
                  {typeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showDateFilter && (
            <>
              <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {t("filters.from")}
                </label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => handleDateFromChange(e.target.value)}
                  className="h-9 bg-input-bg"
                />
              </div>
              <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {t("filters.to")}
                </label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => handleDateToChange(e.target.value)}
                  className="h-9 bg-input-bg"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterBar;
