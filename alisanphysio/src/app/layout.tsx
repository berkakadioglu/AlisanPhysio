import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/constants";
import { getLang } from "@/lib/i18n-server";
import { getTheme } from "@/lib/theme-server";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { I18nProvider } from "./i18n-provider";
import { ToastProvider } from "./toast";

const MARKETING_INIT_SCRIPT = `(() => {
  if (
    location.pathname !== "/" &&
    location.pathname !== "/pricing" &&
    location.pathname !== "/assessment"
  ) return;
  const root = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    root.classList.add("marketing-veil-skip");
    return;
  }

  root.classList.add("marketing-motion-enabled");
  setTimeout(() => {
    if (!document.querySelector(".marketing-motion-ready")) {
      root.classList.add("marketing-motion-fallback");
    }
  }, 5000);
  const key = "twa-marketing-veil-seen";
  let show = true;
  try {
    show = !sessionStorage.getItem(key);
    if (show) sessionStorage.setItem(key, "1");
  } catch {}

  if (!show) {
    root.classList.add("marketing-veil-skip");
    return;
  }

  root.dataset.marketingVeilStart = String(performance.now());
  root.classList.add("marketing-veil-show");
  let finished = false;
  const leave = () => {
    if (finished) return;
    finished = true;
    root.classList.add("marketing-veil-leave");
    setTimeout(() => {
      root.classList.remove("marketing-veil-show", "marketing-veil-leave");
    }, 180);
  };

  setTimeout(leave, 500);
  if (document.readyState === "complete") leave();
  else addEventListener("load", leave, { once: true });
})();`;

// Body / UI type.
const inter = localFont({
  src: [
    {
      path: "../lib/pdf/fonts/Inter-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../lib/pdf/fonts/Inter-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../lib/pdf/fonts/Inter-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-inter",
  display: "swap",
});

// Display headings — the same bundled files used by the PDF generator.
const archivo = localFont({
  src: [
    {
      path: "../lib/pdf/fonts/Archivo-Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../lib/pdf/fonts/Archivo-ExtraBold.ttf",
      weight: "800",
      style: "normal",
    },
  ],
  variable: "--font-archivo",
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
      <head>
        <script
          id="marketing-init"
          dangerouslySetInnerHTML={{ __html: MARKETING_INIT_SCRIPT }}
        />
      </head>
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
