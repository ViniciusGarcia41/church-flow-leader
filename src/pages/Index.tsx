import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { DollarSign, Heart, TrendingUp, Shield, BarChart3, CreditCard } from "lucide-react";
import heroImage from "@/assets/hero-dashboard.jpg";

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-primary/5 to-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-success/10" />
        <div className="container relative mx-auto px-4 py-20">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-8 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
                <DollarSign className="h-4 w-4" />
                Gestão Financeira Profissional
              </div>
              <h1 className="text-5xl font-bold leading-tight lg:text-6xl">
                <span className="bg-gradient-primary bg-clip-text text-transparent">
                  ChurchLedger
                </span>
                <br />
                Simplifique a gestão financeira da sua igreja
              </h1>
              <p className="text-lg text-muted-foreground">
                Sistema completo para controlar dízimos, ofertas, projetos especiais e despesas de forma profissional, 
                com transparência total e automação inteligente.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" onClick={() => navigate("/auth")} className="gap-2">
                  Começar Agora
                  <TrendingUp className="h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
                  Ver Demonstração
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-primary blur-3xl opacity-20 rounded-full" />
              <img
                src={heroImage}
                alt="Dashboard ChurchLedger"
                className="relative rounded-2xl shadow-2xl border border-border"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl font-bold lg:text-4xl">Recursos Poderosos</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Tudo que você precisa para uma gestão financeira completa e transparente
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-lg transition-all hover:shadow-xl hover:scale-105">
            <div className="absolute inset-0 bg-gradient-success opacity-0 group-hover:opacity-5 transition-opacity" />
            <div className="relative space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                <Heart className="h-6 w-6 text-success" />
              </div>
              <h3 className="text-xl font-bold">Gestão de Doações</h3>
              <p className="text-muted-foreground">
                Controle completo de dízimos, ofertas e campanhas especiais com histórico detalhado
              </p>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-lg transition-all hover:shadow-xl hover:scale-105">
            <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-5 transition-opacity" />
            <div className="relative space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Controle de Despesas</h3>
              <p className="text-muted-foreground">
                Registre e categorize todas as despesas com anexos e relatórios automáticos
              </p>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-lg transition-all hover:shadow-xl hover:scale-105">
            <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-5 transition-opacity" />
            <div className="relative space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
                <BarChart3 className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-xl font-bold">Dashboard Inteligente</h3>
              <p className="text-muted-foreground">
                Visualize o estado financeiro em tempo real com gráficos e indicadores
              </p>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-lg transition-all hover:shadow-xl hover:scale-105">
            <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-5 transition-opacity" />
            <div className="relative space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Segurança Total</h3>
              <p className="text-muted-foreground">
                Seus dados protegidos com criptografia e backups automáticos
              </p>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-lg transition-all hover:shadow-xl hover:scale-105">
            <div className="absolute inset-0 bg-gradient-success opacity-0 group-hover:opacity-5 transition-opacity" />
            <div className="relative space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
              <h3 className="text-xl font-bold">Relatórios Detalhados</h3>
              <p className="text-muted-foreground">
                Exporte relatórios completos em Excel, PDF ou CSV para análise
              </p>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-lg transition-all hover:shadow-xl hover:scale-105">
            <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-5 transition-opacity" />
            <div className="relative space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
                <DollarSign className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-xl font-bold">Orçamento Inteligente</h3>
              <p className="text-muted-foreground">
                Planeje e acompanhe orçamentos por categoria e projetos especiais
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-primary p-12 text-center shadow-2xl">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40" />
          <div className="relative space-y-6">
            <h2 className="text-3xl font-bold text-primary-foreground lg:text-4xl">
              Pronto para transformar a gestão financeira?
            </h2>
            <p className="text-lg text-primary-foreground/90 max-w-2xl mx-auto">
              Comece agora mesmo e tenha controle total das finanças da sua igreja
            </p>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate("/auth")}
              className="gap-2 shadow-lg"
            >
              Criar Conta Gratuita
              <TrendingUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary">
                <DollarSign className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-bold">ChurchLedger</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 ChurchLedger. Gestão financeira profissional para igrejas.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
