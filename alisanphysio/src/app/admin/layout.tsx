import StudioCredit from "@/components/studio-credit";
import { getLang } from "@/lib/i18n-server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <div className="admin-shell">
      {children}
      <footer className="studio-shell-footer mx-auto w-full max-w-6xl px-5 sm:px-8">
        <StudioCredit lang={lang} />
      </footer>
    </div>
  );
}
