import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  accent?: "default" | "positive" | "negative";
}

export function StatCard({ label, value, icon: Icon, hint, accent = "default" }: StatCardProps) {
  return (
    <Card className="border-border/60 bg-card/50 hover:bg-card transition-colors">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p
              className={cn(
                "mt-2 text-2xl font-semibold tabular-nums tracking-tight",
                accent === "positive" && "text-[--color-chart-2]",
                accent === "negative" && "text-destructive"
              )}
            >
              {value}
            </p>
            {hint && <p className="mt-1 text-xs text-muted-foreground/70">{hint}</p>}
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4.5 w-4.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
