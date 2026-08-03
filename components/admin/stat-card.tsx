import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Tarjeta de métrica del dashboard con tooltip explicativo. */
export function StatCard({
  title,
  value,
  hint,
  subtitle,
  tone,
}: {
  title: string;
  value: string;
  hint?: string;
  subtitle?: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {title}
          {hint && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger aria-label={`Ayuda: ${title}`}>
                  <HelpCircle className="h-3.5 w-3.5" />
                </TooltipTrigger>
                <TooltipContent>{hint}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <p
          className={cn(
            "mt-1 text-xl font-semibold tabular-nums",
            tone === "positive" && "text-emerald-700",
            tone === "negative" && "text-destructive"
          )}
        >
          {value}
        </p>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
