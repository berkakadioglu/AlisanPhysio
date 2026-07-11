import WhatsAppButton from "./whatsapp-button";

/**
 * Wraps all client-facing pages (/dashboard/*) and adds the floating WhatsApp
 * button. Admin and login pages are outside this layout, so they don't get it.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <WhatsAppButton />
    </>
  );
}
