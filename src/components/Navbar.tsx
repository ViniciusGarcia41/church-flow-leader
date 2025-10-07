import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { DollarSign, LogOut, LayoutDashboard, Heart, CreditCard, Users, FileText, Upload, Languages } from "lucide-react";

const Navbar = () => {
  const { user, signOut } = useAuth();
  const { t, toggleLanguage } = useLanguage();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (!user) return null;

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary">
            <DollarSign className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">ChurchLedger</span>
        </Link>

        <div className="flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              {t("nav.dashboard")}
            </Button>
          </Link>
          <Link to="/donations">
            <Button variant="ghost" size="sm" className="gap-2">
              <Heart className="h-4 w-4" />
              {t("nav.donations")}
            </Button>
          </Link>
          <Link to="/donors">
            <Button variant="ghost" size="sm" className="gap-2">
              <Users className="h-4 w-4" />
              {t("nav.donors")}
            </Button>
          </Link>
          <Link to="/expenses">
            <Button variant="ghost" size="sm" className="gap-2">
              <CreditCard className="h-4 w-4" />
              {t("nav.expenses")}
            </Button>
          </Link>
          <Link to="/reports">
            <Button variant="ghost" size="sm" className="gap-2">
              <FileText className="h-4 w-4" />
              {t("nav.reports")}
            </Button>
          </Link>
          <Link to="/import">
            <Button variant="ghost" size="sm" className="gap-2">
              <Upload className="h-4 w-4" />
              {t("nav.import")}
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={toggleLanguage} className="gap-2">
            <Languages className="h-4 w-4" />
            {t("nav.language")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleSignOut} className="gap-2">
            <LogOut className="h-4 w-4" />
            {t("nav.signout")}
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
