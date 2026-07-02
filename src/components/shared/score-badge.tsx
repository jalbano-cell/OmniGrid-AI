import { cn } from "@/lib/utils";

export function ScoreBadge({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const tone =
    score >= 80
      ? "bg-[oklch(0.62_0.14_165_/_0.15)] text-[oklch(0.75_0.15_165)]"
      : score >= 60
        ? "bg-[oklch(0.66_0.15_75_/_0.15)] text-[oklch(0.78_0.15_75)]"
        : score >= 40
          ? "bg-[oklch(0.62_0.19_50_/_0.15)] text-[oklch(0.75_0.17_50)]"
          : "bg-destructive/15 text-destructive";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md font-semibold tabular-nums",
        tone,
        size === "sm" && "h-6 min-w-6 px-1.5 text-xs",
        size === "md" && "h-8 min-w-8 px-2 text-sm",
        size === "lg" && "h-11 min-w-11 px-2.5 text-lg"
      )}
    >
      {score}
    </span>
  );
}
