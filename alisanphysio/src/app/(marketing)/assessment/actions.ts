"use server";

import type {
  AssessmentField,
  AssessmentSubmissionInput,
} from "@/lib/assessment";
import {
  validateAssessmentInput,
  type AssessmentValidationCode,
} from "@/lib/assessment-validation";
import { getLang } from "@/lib/i18n-server";
import { MARKETING, marketingText } from "@/lib/marketing-content";
import { createAdminClient } from "@/lib/supabase/admin";

export type AssessmentSubmitResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      fieldErrors?: Partial<Record<AssessmentField, string>>;
    };

function validationMessage(
  lang: "en" | "tr",
  code: AssessmentValidationCode,
) {
  return marketingText(lang, MARKETING.assessment.validation[code]);
}

export async function submitAssessmentRequest(
  input: AssessmentSubmissionInput,
): Promise<AssessmentSubmitResult> {
  const lang = await getLang();
  const genericError = marketingText(
    lang,
    MARKETING.assessment.validation.generic,
  );

  // The language stored with a request comes from the same server-side
  // resolver that rendered the page. Never trust a browser-supplied language.
  const validated = validateAssessmentInput({
    ...input,
    preferred_language: lang,
  });

  if (!validated.ok) {
    if (validated.abuse) return { ok: false, error: genericError };

    const fieldErrors = Object.fromEntries(
      Object.entries(validated.errors).map(([field, code]) => [
        field,
        validationMessage(lang, code),
      ]),
    ) as Partial<Record<AssessmentField, string>>;

    return { ok: false, error: genericError, fieldErrors };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("assessment_requests")
      .insert(validated.data);

    if (error) return { ok: false, error: genericError };
  } catch {
    return { ok: false, error: genericError };
  }

  return { ok: true };
}
