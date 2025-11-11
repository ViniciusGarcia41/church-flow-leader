import { useState, useRef } from "react";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface LogoUploaderProps {
  currentLogo: string;
  onLogoChange: (newLogo: string) => void;
}

export const LogoUploader = ({ currentLogo, onLogoChange }: LogoUploaderProps) => {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewLogo, setPreviewLogo] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error(t("common.error"), {
        description: "Formato inválido. Use PNG, JPG, JPEG, SVG ou WEBP.",
      });
      return;
    }

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("common.error"), {
        description: "Imagem muito grande. Máximo 5MB.",
      });
      return;
    }

    // Ler e mostrar preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreviewLogo(result);
      setIsModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveLogo = () => {
    if (previewLogo) {
      const timestamp = Date.now();
      onLogoChange(`${previewLogo}?v=${timestamp}`);
      localStorage.setItem("churchledger-logo", previewLogo);
      toast.success("Logo atualizada com sucesso!");
      setIsModalOpen(false);
      setPreviewLogo(null);
    }
  };

  const handleCancelUpload = () => {
    setIsModalOpen(false);
    setPreviewLogo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <button
        type="button"
        className="relative group cursor-pointer border-0 bg-transparent p-0 rounded-lg"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
      >
        <img
          src={currentLogo}
          alt="Church Logo"
          className="h-12 w-12 min-w-[40px] min-h-[40px] rounded-lg object-contain transition-opacity"
          style={{ opacity: isHovered ? 0.7 : 1 }}
        />
        {isHovered && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 z-10">
            <Upload className="h-5 w-5 text-white" />
          </div>
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
        className="hidden"
        onChange={handleFileChange}
        key={currentLogo}
      />

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Preview da Nova Logo</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-6 bg-muted/20 rounded-lg">
            {previewLogo && (
              <img
                src={previewLogo}
                alt="Preview"
                className="max-h-48 max-w-full rounded-lg object-contain"
              />
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancelUpload}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSaveLogo}>
              <Upload className="h-4 w-4 mr-2" />
              Salvar Logo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
