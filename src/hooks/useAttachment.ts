import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

const BUCKET = "transaction-attachments";
const MAX_SIZE = 10 * 1024 * 1024;
const VALID_TYPES = ["image/jpeg", "image/png", "application/pdf"];

export function useAttachment(userId: string | undefined) {
  const { t } = useLanguage();
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!VALID_TYPES.includes(file.type)) {
      toast.error(t("common.error"), { description: t("attachments.invalidType") });
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error(t("common.error"), { description: t("attachments.tooLarge") });
      return;
    }
    setAttachmentFile(file);
  };

  const uploadAttachment = async (file: File, transactionId: string): Promise<string | null> => {
    const fileExt = file.name.split(".").pop();
    const filePath = `${userId}/${transactionId}.${fileExt}`;
    const { error } = await supabase.storage.from(BUCKET).upload(filePath, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    return data.publicUrl;
  };

  const deleteAttachment = async (attachmentUrl: string) => {
    try {
      const url = new URL(attachmentUrl);
      const pathParts = url.pathname.split(`/${BUCKET}/`);
      if (pathParts.length > 1) {
        await supabase.storage.from(BUCKET).remove([pathParts[1]]);
      }
    } catch (e) {
      console.error("Error deleting attachment:", e);
    }
  };

  const clearFile = () => setAttachmentFile(null);

  return { attachmentFile, handleAttachmentChange, uploadAttachment, deleteAttachment, clearFile };
}
