import { useState, useRef } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

interface LogoUploaderProps {
  currentLogo: string;
  onLogoChange: (newLogo: string) => void;
}

export const LogoUploader = ({ currentLogo, onLogoChange }: LogoUploaderProps) => {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isHovered, setIsHovered] = useState(false);

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

    // Validar tamanho (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("common.error"), {
        description: "Imagem muito grande. Máximo 2MB.",
      });
      return;
    }

    // Ler e converter para base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      onLogoChange(result);
      localStorage.setItem("churchledger-logo", result);
      toast.success("Logo atualizada com sucesso!");
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <img
        src={currentLogo}
        alt="Church Logo"
        className="h-12 w-12 rounded-lg object-cover cursor-pointer transition-opacity"
        style={{ opacity: isHovered ? 0.7 : 1 }}
        onClick={() => fileInputRef.current?.click()}
      />
      {isHovered && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-5 w-5 text-white" />
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};
