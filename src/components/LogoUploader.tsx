import { useState, useRef, useCallback } from "react";
import { Upload, X, Crop } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Cropper from "react-easy-crop";
import { Point, Area } from "react-easy-crop";

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
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isCropping, setIsCropping] = useState(false);

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

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", (error) => reject(error));
      image.src = url;
    });

  const getCroppedImg = async (imageSrc: string, pixelCrop: Area): Promise<string> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("No 2d context");
    }

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return canvas.toDataURL("image/png");
  };

  const handleSaveLogo = async () => {
    if (previewLogo && croppedAreaPixels) {
      try {
        setIsCropping(true);
        const croppedImage = await getCroppedImg(previewLogo, croppedAreaPixels);
        const timestamp = Date.now();
        onLogoChange(`${croppedImage}?v=${timestamp}`);
        localStorage.setItem("churchledger-logo", croppedImage);
        toast.success("Logo atualizada com sucesso!");
        setIsModalOpen(false);
        setPreviewLogo(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
      } catch (error) {
        console.error("Erro ao cortar imagem:", error);
        toast.error("Erro ao processar imagem");
      } finally {
        setIsCropping(false);
      }
    }
  };

  const handleCancelUpload = () => {
    setIsModalOpen(false);
    setPreviewLogo(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ajustar e Cortar Logo</DialogTitle>
          </DialogHeader>
          <div className="relative w-full h-[400px] bg-muted/20 rounded-lg overflow-hidden">
            {previewLogo && (
              <Cropper
                image={previewLogo}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Zoom</label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancelUpload} disabled={isCropping}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSaveLogo} disabled={isCropping}>
              <Crop className="h-4 w-4 mr-2" />
              {isCropping ? "Processando..." : "Salvar Logo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
