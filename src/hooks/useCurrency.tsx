import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface ExchangeRate {
  rate: number;
  lastUpdate: Date;
}

const FALLBACK_RATE = 5.31;
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

export const useCurrency = () => {
  const { language } = useLanguage();
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate>({
    rate: FALLBACK_RATE,
    lastUpdate: new Date(),
  });

  useEffect(() => {
    const fetchExchangeRate = async () => {
      try {
        // Check cache first
        const cached = localStorage.getItem("exchange-rate");
        if (cached) {
          const parsed = JSON.parse(cached);
          const cacheAge = Date.now() - new Date(parsed.lastUpdate).getTime();
          
          if (cacheAge < CACHE_DURATION) {
            setExchangeRate({
              rate: parsed.rate,
              lastUpdate: new Date(parsed.lastUpdate),
            });
            return;
          }
        }

        // Fetch new rate from API
        const response = await fetch(
          "https://api.exchangerate-api.com/v4/latest/BRL"
        );
        
        if (!response.ok) throw new Error("API error");
        
        const data = await response.json();
        const rate = 1 / data.rates.USD; // BRL to USD rate
        
        const newRate = {
          rate: parseFloat(rate.toFixed(2)),
          lastUpdate: new Date(),
        };
        
        setExchangeRate(newRate);
        localStorage.setItem("exchange-rate", JSON.stringify(newRate));
      } catch (error) {
        console.error("Error fetching exchange rate:", error);
        // Use fallback rate
        const fallbackData = {
          rate: FALLBACK_RATE,
          lastUpdate: new Date(),
        };
        setExchangeRate(fallbackData);
        localStorage.setItem("exchange-rate", JSON.stringify(fallbackData));
      }
    };

    fetchExchangeRate();
  }, []);

  const formatCurrency = (value: number): string => {
    if (language === "pt") {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value);
    } else {
      const usdValue = value / exchangeRate.rate;
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(usdValue);
    }
  };

  const convertToUSD = (brlValue: number): number => {
    return brlValue / exchangeRate.rate;
  };

  const convertToBRL = (usdValue: number): number => {
    return usdValue * exchangeRate.rate;
  };

  return {
    formatCurrency,
    exchangeRate: exchangeRate.rate,
    lastUpdate: exchangeRate.lastUpdate,
    convertToUSD,
    convertToBRL,
  };
};
