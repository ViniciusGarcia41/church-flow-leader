import React, { useCallback, useState } from "react";
import { Upload, FileSpreadsheet, X, FileText, FileCode, File as FileIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { ACCEPT_STRING, isFileSupported, getFileExtension, getFileTypeLabel } from "@/utils/parsers";
import { Button } from "@/components/ui/button";

interface FileUploadZoneProps {
  file: File | null;
  onFileSelect: (file: File) => void;
  onFileClear: () => void;
  maxSizeMB?: number;
}

const fileIcons: Record<string, React.ElementType> = {
  csv: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  xls: FileSpreadsheet,
  pdf: FileText,
  txt: FileText,
  json: FileCode,
  xml: FileCode,
};

export default function FileUploadZone({ file, onFileSelect, onFileClear, maxSizeMB = 10 }: FileUploadZoneProps) {
  const { t } = useLanguage();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateAndSet = useCallback((f: File) => {
    setError(null);
    if (!isFileSupported(f)) {
      setError(t("import.unsupportedFormat") || "Formato não suportado");
      return;
    }
    if (f.size > maxSizeMB * 1024 * 1024) {
      setError(`${t("import.fileTooLarge") || "Arquivo muito grande"}. Max: ${maxSizeMB}MB`);
      return;
    }
    onFileSelect(f);
  }, [maxSizeMB, onFileSelect, t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) validateAndSet(f);
  }, [validateAndSet]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) validateAndSet(f);
  }, [validateAndSet]);

  const ext = file ? getFileExtension(file) : "";
  const IconComponent = file ? (fileIcons[ext] || FileIcon) : Upload;

  if (file) {
    return (
      <div className="rounded-xl border-2 border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-accent flex items-center justify-center">
              <IconComponent className="h-6 w-6 text-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{file.name}</p>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>{getFileTypeLabel(ext)}</span>
                <span>•</span>
                <span>{(file.size / 1024).toFixed(1)} KB</span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onFileClear} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer",
          "flex flex-col items-center justify-center py-12 px-6 text-center",
          isDragging
            ? "border-ring bg-accent/30 scale-[1.01]"
            : "border-border hover:border-ring/50 hover:bg-accent/10",
          error && "border-destructive/50"
        )}
      >
        <input
          type="file"
          accept={ACCEPT_STRING}
          onChange={handleInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className={cn(
          "h-14 w-14 rounded-full flex items-center justify-center mb-4 transition-colors",
          isDragging ? "bg-ring/20" : "bg-accent"
        )}>
          <Upload className={cn("h-6 w-6", isDragging ? "text-ring" : "text-muted-foreground")} />
        </div>
        <p className="font-medium text-foreground mb-1">
          {isDragging ? (t("import.dropHere") || "Solte o arquivo aqui") : (t("import.dragOrClick") || "Arraste um arquivo ou clique para selecionar")}
        </p>
        <p className="text-sm text-muted-foreground">
          CSV, Excel, PDF, TXT, JSON, XML • Max {maxSizeMB}MB
        </p>
      </div>
      {error && (
        <p className="text-sm text-destructive font-medium flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
          {error}
        </p>
      )}
    </div>
  );
}
