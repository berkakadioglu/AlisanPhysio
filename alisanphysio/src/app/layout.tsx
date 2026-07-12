import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/constants";
import { getLang } from "@/lib/i18n-server";
import { getTheme } from "@/lib/theme-server";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { I18nProvider } from "./i18n-provider";
import { ToastProvider } from "./toast";

// Body / UI type.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Display headings — bold, modern, confident. Variable font covers 700–800.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: BRAND_NAME,
    template: `%s`,
  },
  description: BRAND_TAGLINE,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = await getLang();
  const theme = await getTheme();
  return (
    <html
      lang={lang}
      className={`${inter.variable} ${archivo.variable} h-full antialiased${
        theme === "dark" ? " dark" : ""
      }`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        {/* Set the theme class before first paint (no FOUC). beforeInteractive
            inline scripts are hoisted into <head> and run before hydration —
            the Next 16 App Router way, without the "script in React tree" warning. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <I18nProvider lang={lang}>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
