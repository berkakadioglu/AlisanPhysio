import { t, type Lang } from "@/lib/i18n";

export default function DayChips({ titles, lang }: { titles: string[]; lang: Lang }) {
  if (!titles.length) return null;
  return <ul className="flex min-w-0 flex-wrap gap-1.5">
    {titles.map((title, index) => <li key={index} className="max-w-full rounded-full bg-pill px-2.5 py-1 text-xs font-medium text-muted-foreground [overflow-wrap:anywhere]">
      {title.trim() || t(lang, "prog.day", { n: index + 1 })}
    </li>)}
  </ul>;
}
