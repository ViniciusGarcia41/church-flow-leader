import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  LogOut, LayoutDashboard, Heart, CreditCard, Users,
  FileText, Upload, Languages, Menu, UserCircle,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState, useEffect, useCallback } from "react";
import defaultChurchLogo from "@/assets/church-logo.jpeg";
import { ThemeToggle } from "@/components/ThemeToggle";

const LS_LOGO = "churchledger-logo";
const LS_NAME = "churchledger-appname";

const readFromStorage = () => ({
  logo: localStorage.getItem(LS_LOGO) ?? null,
  name: localStorage.getItem(LS_NAME) ?? null,
});

const Navbar = () => {
  const { user, signOut } = useAuth();
  const { t, toggleLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [churchLogo, setChurchLogo] = useState(() => {
    const saved = localStorage.getItem(LS_LOGO);
    return saved ?? defaultChurchLogo;
  });
  const [appName, setAppName] = useState(() => {
    return localStorage.getItem(LS_NAME) ?? "ChurchLedger";
  });

  const syncFromStorage = useCallback(() => {
    const { logo, name } = readFromStorage();
    setChurchLogo(logo ?? defaultChurchLogo);
    setAppName(name ?? "ChurchLedger");
  }, []);

  useEffect(() => {
    // cross-tab updates
    window.addEventListener("storage", syncFromStorage);
    // same-tab updates dispatched from Profile page
    window.addEventListener("churchledger-profile-updated", syncFromStorage);
    return () => {
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener("churchledger-profile-updated", syncFromStorage);
    };
  }, [syncFromStorage]);

  if (!user) return null;

  const close = () => setIsOpen(false);

  const NavLinks = () => (
    <>
      <Link to="/dashboard" onClick={close}>
        <Button variant="ghost" size="sm" className="gap-2 w-full justify-start">
          <LayoutDashboard className="h-4 w-4" />
          {t("nav.dashboard")}
        </Button>
      </Link>
      <Link to="/donations" onClick={close}>
        <Button variant="ghost" size="sm" className="gap-2 w-full justify-start">
          <Heart className="h-4 w-4" />
          {t("nav.donations")}
        </Button>
      </Link>
      <Link to="/donors" onClick={close}>
        <Button variant="ghost" size="sm" className="gap-2 w-full justify-start">
          <Users className="h-4 w-4" />
          {t("nav.donors")}
        </Button>
      </Link>
      <Link to="/expenses" onClick={close}>
        <Button variant="ghost" size="sm" className="gap-2 w-full justify-start">
          <CreditCard className="h-4 w-4" />
          {t("nav.expenses")}
        </Button>
      </Link>
      <Link to="/reports" onClick={close}>
        <Button variant="ghost" size="sm" className="gap-2 w-full justify-start">
          <FileText className="h-4 w-4" />
          {t("nav.reports")}
        </Button>
      </Link>
      <Link to="/import" onClick={close}>
        <Button variant="ghost" size="sm" className="gap-2 w-full justify-start">
          <Upload className="h-4 w-4" />
          {t("nav.import")}
        </Button>
      </Link>
      <Link to="/profile" onClick={close}>
        <Button variant="ghost" size="sm" className="gap-2 w-full justify-start">
          <UserCircle className="h-4 w-4" />
          {t("nav.profile")}
        </Button>
      </Link>
      <Button variant="ghost" size="sm" onClick={toggleLanguage} className="gap-2 w-full justify-start">
        <Languages className="h-4 w-4" />
        {t("nav.language")}
      </Button>
      <div className="w-full">
        <ThemeToggle />
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => { signOut(); close(); }}
        className="gap-2 w-full justify-start"
      >
        <LogOut className="h-4 w-4" />
        {t("nav.signout")}
      </Button>
    </>
  );

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container mx-auto flex h-16 items-center px-4 gap-3">
        <Link to="/profile" className="flex items-center gap-3 min-w-0 shrink-0 hover:opacity-80 transition-opacity">
          <img
            src={churchLogo}
            alt="Church Logo"
            className="h-12 w-12 min-w-[40px] min-h-[40px] rounded-lg object-contain"
          />
          <span className="text-xl font-bold hidden md:inline truncate">{appName}</span>
        </Link>

        <div className="hidden lg:flex items-center gap-2 ml-auto">
          <NavLinks />
        </div>

        <div className="flex items-center gap-2 lg:hidden ml-auto">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[350px]">
              <div className="flex flex-col gap-2 mt-8">
                <NavLinks />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
