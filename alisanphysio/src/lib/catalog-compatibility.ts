export type CatalogDatabaseError = { code?: string; message?: string };

export function missingCatalogColumn(error: CatalogDatabaseError | null, column: string): boolean {
  return !!error && ["42703", "PGRST204"].includes(error.code ?? "") && !!error.message?.includes(column);
}

export function missingCatalogCopy(error: CatalogDatabaseError | null): boolean {
  return !!error && (error.code === "PGRST202" || error.code === "42883")
    && /(?:public\.)?copy_catalog_program\(/.test((error.message ?? "").replace(/\s+\(/g, "("));
}
