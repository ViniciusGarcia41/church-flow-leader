import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { DollarSign, LogOut, LayoutDashboard, Heart, CreditCard, Users, FileText, Upload, Languages, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

const Navbar = () => {
  const { user, signOut } = useAuth();
  const { t, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (!user) return null;

  const NavLinks = () => (
    <>
      <Link to="/dashboard" onClick={() => setIsOpen(false)}>
        <Button variant="ghost" size="sm" className="gap-2 w-full justify-start">
          <LayoutDashboard className="h-4 w-4" />
          {t("nav.dashboard")}
        </Button>
      </Link>
      <Link to="/donations" onClick={() => setIsOpen(false)}>
        <Button variant="ghost" size="sm" className="gap-2 w-full justify-start">
          <Heart className="h-4 w-4" />
          {t("nav.donations")}
        </Button>
      </Link>
      <Link to="/donors" onClick={() => setIsOpen(false)}>
        <Button variant="ghost" size="sm" className="gap-2 w-full justify-start">
          <Users className="h-4 w-4" />
          {t("nav.donors")}
        </Button>
      </Link>
      <Link to="/expenses" onClick={() => setIsOpen(false)}>
        <Button variant="ghost" size="sm" className="gap-2 w-full justify-start">
          <CreditCard className="h-4 w-4" />
          {t("nav.expenses")}
        </Button>
      </Link>
      <Link to="/reports" onClick={() => setIsOpen(false)}>
        <Button variant="ghost" size="sm" className="gap-2 w-full justify-start">
          <FileText className="h-4 w-4" />
          {t("nav.reports")}
        </Button>
      </Link>
      <Link to="/import" onClick={() => setIsOpen(false)}>
        <Button variant="ghost" size="sm" className="gap-2 w-full justify-start">
          <Upload className="h-4 w-4" />
          {t("nav.import")}
        </Button>
      </Link>
      <Button variant="ghost" size="sm" onClick={toggleLanguage} className="gap-2 w-full justify-start">
        <Languages className="h-4 w-4" />
        {t("nav.language")}
      </Button>
      <Button variant="outline" size="sm" onClick={() => { handleSignOut(); setIsOpen(false); }} className="gap-2 w-full justify-start">
        <LogOut className="h-4 w-4" />
        {t("nav.signout")}
      </Button>
    </>
  );

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary">
            <DollarSign className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">ChurchLedger</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-2">
          <NavLinks />
        </div>

        {/* Mobile Navigation */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[280px] sm:w-[350px]">
            <div className="flex flex-col gap-2 mt-8">
              <NavLinks />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
};

export default Navbar;
