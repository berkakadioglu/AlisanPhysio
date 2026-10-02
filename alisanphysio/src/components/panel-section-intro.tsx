export default function PanelSectionIntro({
  eyebrow,
  title,
  body,
  action,
  headingLevel = 2,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  action?: React.ReactNode;
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";

  return (
    <header className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">
          {eyebrow}
        </p>
        <Heading className="mt-2 text-balance font-display text-2xl font-extrabold leading-tight tracking-tight text-foreground sm:text-3xl">
          {title}
        </Heading>
        {body && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {body}
        </p>}
      </div>
      {action}
    </header>
  );
}
