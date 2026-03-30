import { useLanguage } from "@/contexts/LanguageContext";
import { CheckCircle2, Loader2, AlertCircle, Upload, FileSearch, Eye, GitBranch, Save } from "lucide-react";
import { cn } from "@/lib/utils";

export type ImportStep = "upload" | "processing" | "preview" | "mapping" | "confirm";

interface StepIndicatorProps {
  currentStep: ImportStep;
  hasErrors?: boolean;
}

const steps: { key: ImportStep; icon: React.ElementType; labelKey: string }[] = [
  { key: "upload", icon: Upload, labelKey: "import.stepUpload" },
  { key: "processing", icon: FileSearch, labelKey: "import.stepProcess" },
  { key: "preview", icon: Eye, labelKey: "import.stepPreview" },
  { key: "confirm", icon: Save, labelKey: "import.stepConfirm" },
];

const stepOrder: ImportStep[] = ["upload", "processing", "preview", "confirm"];

export default function StepIndicator({ currentStep, hasErrors }: StepIndicatorProps) {
  const { t } = useLanguage();
  const currentIdx = stepOrder.indexOf(currentStep);

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2">
      {steps.map((step, idx) => {
        const isActive = idx === currentIdx;
        const isCompleted = idx < currentIdx;
        const isError = isActive && hasErrors;
        const Icon = step.icon;

        return (
          <div key={step.key} className="flex items-center">
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm",
              isActive && !isError && "bg-accent text-foreground font-medium",
              isActive && isError && "bg-destructive-light text-destructive font-medium",
              isCompleted && "text-income",
              !isActive && !isCompleted && "text-muted-foreground"
            )}>
              {isCompleted ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : isActive && currentStep === "processing" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isError ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{t(step.labelKey) || step.key}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className={cn(
                "w-6 sm:w-10 h-px mx-1",
                idx < currentIdx ? "bg-income" : "bg-border"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
