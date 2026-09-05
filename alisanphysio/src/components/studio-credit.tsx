import { t, type Lang } from "@/lib/i18n";

const CONTACT_URL = "https://kurgu.studio/contact";

/** Server-rendered, ordinary anchors; passed into client shells as a slot. */
export default function StudioCredit({ lang, variant = "platform" }: {
  lang: Lang;
  variant?: "marketing" | "platform";
}) {
  return (
    <span className="studio-credit">
      {t(lang, variant === "marketing" ? "studio.createdBefore" : "studio.builtBefore")}
      <a href={CONTACT_URL} target="_blank" rel="noopener">Kurgu Studio</a>
      {t(lang, "studio.after")}
      {variant === "platform" && <>
        {" · "}{t(lang, "studio.invitation")}{" "}
        <a href={CONTACT_URL} target="_blank" rel="noopener">{t(lang, "studio.contact")}</a>
      </>}
    </span>
  );
}
