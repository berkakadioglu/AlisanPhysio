import { BRAND } from "@/lib/brand";

/** Backwards-compatible aliases; BRAND remains the single source of truth. */
export const BRAND_NAME = BRAND.name;
export const BRAND_TAGLINE = BRAND.tagline.en;

/** Author shown on exported PDF documents (cover + footer). */
export const PDF_AUTHOR = "Alişan";

/** Where users land after a successful login. */
export const AFTER_LOGIN_PATH = "/dashboard";
/** Public routes that do not require authentication. */
export const PUBLIC_PATHS = [
  "/",
  "/pricing",
  "/demo",
  "/assessment",
  "/login",
  "/membership-inactive",
] as const;
