import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface ExchangeRate {
  rate: number;
  lastUpdate: Date;
}

const FALLBACK_RATE = 6.05; // Updated fallback rate (Dec 2025)
const CACHE_DURATION = 900000; // 15 minutes in milliseconds for fresher rates

export const useCurrency = () => {
  const { language } = useLanguage();
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate>({
    rate: FALLBACK_RATE,
    lastUpdate: new Date(),
  });

  const fetchExchangeRate = useCallback(async (forceRefresh = false) => {
    try {
      // Check cache first (unless forcing refresh)
      if (!forceRefresh) {
        const cached = localStorage.getItem("exchange-rate-v2");
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
      }

      // Try primary API - ExchangeRate-API (free, reliable)
      let rate: number | null = null;
      
      try {
        const response = await fetch(
          "https://api.exchangerate-api.com/v4/latest/USD"
        );
        
        if (response.ok) {
          const data = await response.json();
          // Get how many BRL = 1 USD
          rate = data.rates.BRL;
        }
      } catch (primaryError) {
        console.warn("Primary API failed, trying fallback...", primaryError);
      }

      // Fallback to secondary API if primary fails
      if (!rate) {
        try {
          const fallbackResponse = await fetch(
            "https://open.er-api.com/v6/latest/USD"
          );
          
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            rate = fallbackData.rates.BRL;
          }
        } catch (fallbackError) {
          console.warn("Fallback API also failed", fallbackError);
        }
      }

      if (rate) {
        const newRate = {
          rate: parseFloat(rate.toFixed(4)), // More precision for accuracy
          lastUpdate: new Date(),
        };
        
        setExchangeRate(newRate);
        localStorage.setItem("exchange-rate-v2", JSON.stringify(newRate));
      } else {
        throw new Error("All APIs failed");
      }
    } catch (error) {
      console.error("Error fetching exchange rate:", error);
      // Use cached rate if available, otherwise fallback
      const cached = localStorage.getItem("exchange-rate-v2");
      if (cached) {
        const parsed = JSON.parse(cached);
        setExchangeRate({
          rate: parsed.rate,
          lastUpdate: new Date(parsed.lastUpdate),
        });
      } else {
        setExchangeRate({
          rate: FALLBACK_RATE,
          lastUpdate: new Date(),
        });
      }
    }
  }, []);

  useEffect(() => {
    fetchExchangeRate();
    
    // Refresh rate every 15 minutes while app is open
    const interval = setInterval(() => {
      fetchExchangeRate(true);
    }, CACHE_DURATION);

    return () => clearInterval(interval);
  }, [fetchExchangeRate]);

  const formatCurrency = (value: number): string => {
    if (language === "pt") {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value);
    } else {
      // Convert BRL to USD: divide by rate (rate = how many BRL per 1 USD)
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

  const refreshRate = () => {
    fetchExchangeRate(true);
  };

  return {
    formatCurrency,
    exchangeRate: exchangeRate.rate,
    lastUpdate: exchangeRate.lastUpdate,
    convertToUSD,
    convertToBRL,
    refreshRate,
  };
};
