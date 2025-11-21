import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Save, Crop } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import Cropper from "react-easy-crop";
import { Point, Area } from "react-easy-crop";
import defaultChurchLogo from "@/assets/church-logo.jpeg";

const Profile = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [churchName, setChurchName] = useState("");
  const [churchLogo, setChurchLogo] = useState(defaultChurchLogo);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Crop states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewLogo, setPreviewLogo] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  useEffect(() => {
    if (user) {
      loadProfile();
      const savedLogo = localStorage.getItem("churchledger-logo");
      if (savedLogo) {
        setChurchLogo(savedLogo);
      }
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, church_name")
        .eq("id", user?.id)
        .single();

      if (error) throw error;

      if (data) {
        setFullName(data.full_name || "");
        setChurchName(data.church_name || "");
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  };

  const updateProfile = async () => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          church_name: churchName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user?.id);

      if (error) throw error;
      toast.success(t("profile.updateSuccess"));
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error(t("profile.updateError"));
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error(t("common.error"), {
        description: "Formato inválido. Use PNG, JPG, JPEG, SVG ou WEBP.",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("common.error"), {
        description: "Imagem muito grande. Máximo 5MB.",
      });
      return;
    }

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
        setChurchLogo(`${croppedImage}?v=${timestamp}`);
        localStorage.setItem("churchledger-logo", croppedImage);
        toast.success("Logo atualizada com sucesso!");
        setIsModalOpen(false);
        setPreviewLogo(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        window.dispatchEvent(new Event("storage"));
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">{t("profile.title")}</h1>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{t("profile.churchLogo")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-6">
                <img
                  src={churchLogo}
                  alt="Church Logo"
                  className="h-32 w-32 rounded-lg object-contain border-2 border-border"
                />
                <div>
                  <Button onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    {t("profile.uploadLogo")}
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">
                    PNG, JPG, SVG ou WEBP (máx. 5MB)
                  </p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("profile.accountInfo")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="email">{t("profile.email")}</Label>
                <Input id="email" type="email" value={user?.email || ""} disabled />
              </div>
              <div>
                <Label htmlFor="fullName">{t("profile.fullName")}</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t("profile.fullNamePlaceholder")}
                />
              </div>
              <div>
                <Label htmlFor="churchName">{t("profile.churchName")}</Label>
                <Input
                  id="churchName"
                  type="text"
                  value={churchName}
                  onChange={(e) => setChurchName(e.target.value)}
                  placeholder={t("profile.churchNamePlaceholder")}
                />
              </div>
              <Button onClick={updateProfile} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                {loading ? t("common.saving") : t("common.save")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

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
              Cancelar
            </Button>
            <Button onClick={handleSaveLogo} disabled={isCropping}>
              <Crop className="h-4 w-4 mr-2" />
              {isCropping ? "Processando..." : "Salvar Logo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
