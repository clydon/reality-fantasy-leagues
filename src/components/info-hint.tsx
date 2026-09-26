import { InfoIcon } from "@/components/icons";

// A small (i) badge that carries its explanation as a native title tooltip -- same pattern the app
// already uses for hover hints (owner badges, medal icons) rather than a new tooltip library. Used
// next to a setting whose short label doesn't have room to explain what the options mean.
export function InfoHint({ text }: { text: string }) {
  return (
    <span
      title={text}
      tabIndex={0}
      className="inline-flex h-3.5 w-3.5 shrink-0 cursor-help items-center justify-center rounded-full text-muted-foreground"
      aria-label={text}
    >
      <InfoIcon className="h-3.5 w-3.5" />
    </span>
  );
}
