"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  LockKeyhole,
} from "lucide-react";
import type {
  AssessmentField,
  AssessmentFormValues,
  AssessmentPlan,
} from "@/lib/assessment";
import type { Lang } from "@/lib/i18n";
import {
  MARKETING,
  marketingTemplate,
  marketingText,
} from "@/lib/marketing-content";
import { submitAssessmentRequest } from "./actions";

type FieldErrors = Partial<Record<AssessmentField, string>>;

const EMPTY_VALUES: AssessmentFormValues = {
  full_name: "",
  email: "",
  phone: "",
  country: "",
  city: "",
  birth_year: "",
  sex: "",
  height_cm: "",
  weight_kg: "",
  primary_goal: "",
  training_experience: "",
  days_per_week: "",
  equipment_access: "",
  injury_history: "",
  medical_notes: "",
  selected_plan: "",
  message: "",
};

const FIELD_ORDER: AssessmentField[] = [
  "full_name",
  "email",
  "phone",
  "country",
  "city",
  "birth_year",
  "sex",
  "height_cm",
  "weight_kg",
  "primary_goal",
  "training_experience",
  "days_per_week",
  "equipment_access",
  "injury_history",
  "medical_notes",
  "selected_plan",
  "message",
  "consent",
];

const FIELD_STEP: Record<AssessmentField, number> = {
  full_name: 0,
  email: 0,
  phone: 0,
  country: 0,
  city: 0,
  birth_year: 1,
  sex: 1,
  height_cm: 1,
  weight_kg: 1,
  primary_goal: 1,
  training_experience: 2,
  days_per_week: 2,
  equipment_access: 2,
  injury_history: 3,
  medical_notes: 3,
  selected_plan: 4,
  message: 4,
  consent: 4,
  preferred_language: 0,
};

function fieldId(field: AssessmentField) {
  return `assessment-${field}`;
}

function optionalNumberValid(
  value: string,
  min: number,
  max: number,
  integer = false,
) {
  if (!value.trim()) return true;
  const parsed = Number(value);
  return (
    Number.isFinite(parsed) &&
    parsed >= min &&
    parsed <= max &&
    (!integer || Number.isInteger(parsed))
  );
}

function ErrorText({ field, error }: { field: AssessmentField; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${fieldId(field)}-error`} role="alert" className="marketing-assessment-field-error">
      {error}
    </p>
  );
}

function FieldLabel({
  htmlFor,
  label,
  required,
  optional,
}: {
  htmlFor: string;
  label: string;
  required?: boolean;
  optional?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="marketing-assessment-label">
      <span>{label}</span>
      {required ? (
        <span className="marketing-assessment-required" aria-hidden>
          *
        </span>
      ) : optional ? (
        <span className="marketing-assessment-optional">{optional}</span>
      ) : null}
    </label>
  );
}

function ReviewGroup({
  title,
  rows,
  editLabel,
  editAriaLabel,
  onEdit,
}: {
  title: string;
  rows: Array<{ label: string; value: string }>;
  editLabel: string;
  editAriaLabel: string;
  onEdit: () => void;
}) {
  return (
    <section className="marketing-assessment-review-group">
      <div className="marketing-assessment-review-group__heading">
        <h3>{title}</h3>
        <button type="button" onClick={onEdit} aria-label={editAriaLabel}>
          {editLabel}
        </button>
      </div>
      <dl>
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function AssessmentForm({
  lang,
  initialPlan,
}: {
  lang: Lang;
  initialPlan: AssessmentPlan | null;
}) {
  const copy = MARKETING.assessment;
  const formStart = useRef(0);
  const formShell = useRef<HTMLDivElement>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const formErrorAlert = useRef<HTMLParagraphElement>(null);
  const previousStep = useRef(0);
  const previousLang = useRef(lang);
  const pendingFieldFocus = useRef<AssessmentField | null>(null);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<AssessmentFormValues>({
    ...EMPTY_VALUES,
    selected_plan: initialPlan ?? "",
  });
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [planEditing, setPlanEditing] = useState(!initialPlan);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);

  const text = <T extends Readonly<Record<Lang, unknown>>>(value: T) =>
    marketingText(lang, value);
  const optional = text(copy.optional);
  const invalidValue = text(copy.validation.invalidValue);

  useEffect(() => {
    if (formStart.current === 0) formStart.current = Date.now();
  }, []);

  useEffect(() => {
    if (previousStep.current !== step) {
      previousStep.current = step;
      const field = pendingFieldFocus.current;
      pendingFieldFocus.current = null;
      requestAnimationFrame(() => {
        if (field) {
          document.getElementById(fieldId(field))?.focus();
        } else {
          stepHeading.current?.focus();
        }
      });
    }
  }, [step]);

  useEffect(() => {
    if (previousLang.current === lang) return;
    previousLang.current = lang;
    setErrors({});
    setFormError(null);
  }, [lang]);

  function update<K extends keyof AssessmentFormValues>(
    field: K,
    value: AssessmentFormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  function validateStep(index: number): FieldErrors {
    const next: FieldErrors = {};

    if (index === 0) {
      if (!values.full_name.trim() || values.full_name.trim().length > 120) {
        next.full_name = text(copy.validation.requiredName);
      }
      if (
        values.email.trim().length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim())
      ) {
        next.email = text(copy.validation.invalidEmail);
      }
      if (values.phone.length > 40) next.phone = invalidValue;
      if (values.country.length > 80) next.country = invalidValue;
      if (values.city.length > 80) next.city = invalidValue;
    }

    if (index === 1) {
      const currentYear = new Date().getUTCFullYear();
      if (!optionalNumberValid(values.birth_year, 1900, currentYear, true)) {
        next.birth_year = invalidValue;
      }
      if (!optionalNumberValid(values.height_cm, 50, 260)) {
        next.height_cm = invalidValue;
      }
      if (!optionalNumberValid(values.weight_kg, 20, 500)) {
        next.weight_kg = invalidValue;
      }
      if (!values.primary_goal.trim()) {
        next.primary_goal = text(copy.validation.requiredGoal);
      }
    }

    if (index === 2) {
      if (!optionalNumberValid(values.days_per_week, 1, 7, true)) {
        next.days_per_week = invalidValue;
      }
    }

    if (index === 3) {
      if (values.injury_history.length > 3_000) {
        next.injury_history = invalidValue;
      }
      if (values.medical_notes.length > 3_000) {
        next.medical_notes = invalidValue;
      }
    }

    if (index === 4) {
      if (values.message.length > 3_000) next.message = invalidValue;
      if (!consent) next.consent = text(copy.validation.requiredConsent);
    }

    return next;
  }

  function moveToFirstInvalid(nextErrors: FieldErrors) {
    const first = FIELD_ORDER.find((field) => nextErrors[field]);
    if (!first) return;
    const targetStep = FIELD_STEP[first];
    if (targetStep === step) {
      requestAnimationFrame(() =>
        document.getElementById(fieldId(first))?.focus(),
      );
      return;
    }
    pendingFieldFocus.current = first;
    setStep(targetStep);
  }

  function goNext() {
    const nextErrors = validateStep(step);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      moveToFirstInvalid(nextErrors);
      return;
    }
    setStep((current) => Math.min(current + 1, copy.steps.length - 1));
  }

  function goBack() {
    setErrors({});
    setFormError(null);
    setStep((current) => Math.max(current - 1, 0));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < copy.steps.length - 1) {
      goNext();
      return;
    }
    const allErrors = copy.steps.reduce<FieldErrors>(
      (result, _item, index) => ({ ...result, ...validateStep(index) }),
      {},
    );

    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      moveToFirstInvalid(allErrors);
      return;
    }

    setPending(true);
    setFormError(null);
    try {
      const result = await submitAssessmentRequest({
        ...values,
        preferred_language: lang,
        consent,
        website,
        started_at: formStart.current,
      });

      if (!result.ok) {
        setFormError(result.error);
        if (result.fieldErrors) {
          setErrors(result.fieldErrors);
          moveToFirstInvalid(result.fieldErrors);
        } else {
          requestAnimationFrame(() => formErrorAlert.current?.focus());
        }
        return;
      }

      setSuccess(true);
      requestAnimationFrame(() => {
        formShell.current?.focus();
        const reduceMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        formShell.current?.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "start",
        });
      });
    } catch {
      setFormError(text(copy.validation.generic));
      requestAnimationFrame(() => formErrorAlert.current?.focus());
    } finally {
      setPending(false);
    }
  }

  const plan = MARKETING.pricing.plans.find(
    (item) => item.id === values.selected_plan,
  );
  const planLabel = plan
    ? text(plan.name)
    : text(copy.plan.noneShort);
  const choiceLabel = (
    options: ReadonlyArray<{ value: string; label: Readonly<Record<Lang, string>> }>,
    value: string,
  ) =>
    options.find((option) => option.value === value)?.label
      ? text(options.find((option) => option.value === value)!.label)
      : text(copy.review.notProvided);
  const provided = (value: string) =>
    value.trim() || text(copy.review.notProvided);
  const editAria = (section: string) =>
    marketingTemplate(text(copy.actions.editSection), { section });

  const commonInput = (field: AssessmentField) => ({
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby": errors[field] ? `${fieldId(field)}-error` : undefined,
  });

  if (success) {
    return (
      <div
        ref={formShell}
        tabIndex={-1}
        className="marketing-assessment-success"
        role="status"
        aria-labelledby="assessment-success-heading"
      >
        <span className="marketing-assessment-success__icon">
          <CheckCircle2 aria-hidden />
        </span>
        <p className="marketing-eyebrow">{text(copy.success.eyebrow)}</p>
        <h2 id="assessment-success-heading">{text(copy.success.title)}</h2>
        <p>{text(copy.success.body)}</p>
        <div className="marketing-assessment-success__next">
          <h3>{text(copy.success.nextTitle)}</h3>
          <ol>
            {copy.success.nextSteps.map((item, index) => (
              <li key={item.en}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {text(item)}
              </li>
            ))}
          </ol>
        </div>
        <Link href="/" className="marketing-button marketing-button--primary">
          {text(copy.success.homeLink)}
          <ArrowRight aria-hidden />
        </Link>
      </div>
    );
  }

  const currentStep = copy.steps[step];

  return (
    <div ref={formShell} tabIndex={-1} className="marketing-assessment-form-shell">
      <div className="marketing-assessment-progress">
        <div className="marketing-assessment-progress__meta">
          <p aria-live="polite">
            {marketingTemplate(text(copy.progressTemplate), {
              current: step + 1,
              total: copy.steps.length,
            })}
          </p>
          <span>{text(copy.requiredNote)}</span>
        </div>
        <ol aria-label={text(copy.progressLabel)}>
          {copy.steps.map((item, index) => (
            <li
              key={item.short.en}
              className={index < step ? "is-complete" : index === step ? "is-current" : ""}
              aria-current={index === step ? "step" : undefined}
              aria-label={`${index + 1}. ${text(item.short)}`}
            >
              <span>{index < step ? <Check aria-hidden /> : index + 1}</span>
              <small>{text(item.short)}</small>
            </li>
          ))}
        </ol>
      </div>

      <div className="marketing-assessment-plan-panel">
        <div>
          <span>
            {text(values.selected_plan ? copy.plan.confirmed : copy.plan.choose)}
          </span>
          <strong>{planLabel}</strong>
        </div>
        <button
          id={fieldId("selected_plan")}
          type="button"
          onClick={() => setPlanEditing((current) => !current)}
          aria-expanded={planEditing}
          aria-controls="assessment-plan-options"
        >
          {text(planEditing ? copy.plan.done : copy.plan.change)}
        </button>
        {planEditing && (
          <fieldset
            id="assessment-plan-options"
            className="marketing-assessment-plan-options"
          >
            <legend className="sr-only">{text(copy.plan.choose)}</legend>
            {MARKETING.pricing.plans.map((item) => (
              <label key={item.id}>
                <input
                  type="radio"
                  name="assessment-plan"
                  value={item.id}
                  checked={values.selected_plan === item.id}
                  onChange={() => {
                    update("selected_plan", item.id);
                    setPlanEditing(false);
                    requestAnimationFrame(() =>
                      document.getElementById(fieldId("selected_plan"))?.focus(),
                    );
                  }}
                />
                <span>{text(item.name)}</span>
              </label>
            ))}
            <label>
              <input
                type="radio"
                name="assessment-plan"
                value=""
                checked={!values.selected_plan}
                onChange={() => {
                  update("selected_plan", "");
                  setPlanEditing(false);
                  requestAnimationFrame(() =>
                    document.getElementById(fieldId("selected_plan"))?.focus(),
                  );
                }}
              />
              <span>{text(copy.plan.none)}</span>
            </label>
          </fieldset>
        )}
      </div>

      <form onSubmit={submit} noValidate>
        <div className="marketing-assessment-step" key={step}>
          <header>
            <p className="marketing-eyebrow">{text(currentStep.short)}</p>
            <h2 ref={stepHeading} tabIndex={-1}>{text(currentStep.title)}</h2>
            <p>{text(currentStep.intro)}</p>
          </header>

          {step === 0 && (
            <div className="marketing-assessment-fields">
              <div className="marketing-assessment-field marketing-assessment-field--wide">
                <FieldLabel htmlFor={fieldId("full_name")} label={text(copy.fields.fullName.label)} required />
                <input id={fieldId("full_name")} required aria-required="true" maxLength={120} value={values.full_name} onChange={(event) => update("full_name", event.target.value)} placeholder={text(copy.fields.fullName.placeholder)} autoComplete="name" {...commonInput("full_name")} />
                <ErrorText field="full_name" error={errors.full_name} />
              </div>
              <div className="marketing-assessment-field">
                <FieldLabel htmlFor={fieldId("email")} label={text(copy.fields.email.label)} required />
                <input id={fieldId("email")} type="email" required aria-required="true" maxLength={254} value={values.email} onChange={(event) => update("email", event.target.value)} placeholder={text(copy.fields.email.placeholder)} autoComplete="email" {...commonInput("email")} />
                <ErrorText field="email" error={errors.email} />
              </div>
              <div className="marketing-assessment-field">
                <FieldLabel htmlFor={fieldId("phone")} label={text(copy.fields.phone.label)} optional={optional} />
                <input id={fieldId("phone")} type="tel" maxLength={40} value={values.phone} onChange={(event) => update("phone", event.target.value)} placeholder={text(copy.fields.phone.placeholder)} autoComplete="tel" {...commonInput("phone")} />
                <ErrorText field="phone" error={errors.phone} />
              </div>
              <div className="marketing-assessment-field">
                <FieldLabel htmlFor={fieldId("country")} label={text(copy.fields.country.label)} optional={optional} />
                <input id={fieldId("country")} maxLength={80} value={values.country} onChange={(event) => update("country", event.target.value)} placeholder={text(copy.fields.country.placeholder)} autoComplete="country-name" {...commonInput("country")} />
                <ErrorText field="country" error={errors.country} />
              </div>
              <div className="marketing-assessment-field">
                <FieldLabel htmlFor={fieldId("city")} label={text(copy.fields.city.label)} optional={optional} />
                <input id={fieldId("city")} maxLength={80} value={values.city} onChange={(event) => update("city", event.target.value)} placeholder={text(copy.fields.city.placeholder)} autoComplete="address-level2" {...commonInput("city")} />
                <ErrorText field="city" error={errors.city} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="marketing-assessment-fields">
              <div className="marketing-assessment-field">
                <FieldLabel htmlFor={fieldId("birth_year")} label={text(copy.fields.birthYear.label)} optional={optional} />
                <input id={fieldId("birth_year")} type="number" inputMode="numeric" min="1900" max={new Date().getUTCFullYear()} value={values.birth_year} onChange={(event) => update("birth_year", event.target.value)} placeholder={text(copy.fields.birthYear.placeholder)} autoComplete="bday-year" {...commonInput("birth_year")} />
                <ErrorText field="birth_year" error={errors.birth_year} />
              </div>
              <div className="marketing-assessment-field">
                <FieldLabel htmlFor={fieldId("sex")} label={text(copy.fields.sex.label)} optional={optional} />
                <select id={fieldId("sex")} value={values.sex} onChange={(event) => update("sex", event.target.value)} {...commonInput("sex")}>
                  <option value="">{text(copy.options.choose)}</option>
                  {copy.options.sex.map((option) => <option key={option.value} value={option.value}>{text(option.label)}</option>)}
                </select>
                <ErrorText field="sex" error={errors.sex} />
              </div>
              <div className="marketing-assessment-field">
                <FieldLabel htmlFor={fieldId("height_cm")} label={text(copy.fields.height.label)} optional={optional} />
                <input id={fieldId("height_cm")} type="number" inputMode="decimal" min="50" max="260" step="0.1" value={values.height_cm} onChange={(event) => update("height_cm", event.target.value)} placeholder={text(copy.fields.height.placeholder)} {...commonInput("height_cm")} />
                <ErrorText field="height_cm" error={errors.height_cm} />
              </div>
              <div className="marketing-assessment-field">
                <FieldLabel htmlFor={fieldId("weight_kg")} label={text(copy.fields.weight.label)} optional={optional} />
                <input id={fieldId("weight_kg")} type="number" inputMode="decimal" min="20" max="500" step="0.1" value={values.weight_kg} onChange={(event) => update("weight_kg", event.target.value)} placeholder={text(copy.fields.weight.placeholder)} {...commonInput("weight_kg")} />
                <ErrorText field="weight_kg" error={errors.weight_kg} />
              </div>
              <div className="marketing-assessment-field marketing-assessment-field--wide">
                <FieldLabel htmlFor={fieldId("primary_goal")} label={text(copy.fields.primaryGoal.label)} required />
                <textarea id={fieldId("primary_goal")} required aria-required="true" rows={5} maxLength={1500} value={values.primary_goal} onChange={(event) => update("primary_goal", event.target.value)} placeholder={text(copy.fields.primaryGoal.placeholder)} {...commonInput("primary_goal")} />
                <ErrorText field="primary_goal" error={errors.primary_goal} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="marketing-assessment-fields">
              <div className="marketing-assessment-field marketing-assessment-field--wide">
                <FieldLabel htmlFor={fieldId("training_experience")} label={text(copy.fields.experience.label)} optional={optional} />
                <select id={fieldId("training_experience")} value={values.training_experience} onChange={(event) => update("training_experience", event.target.value)} {...commonInput("training_experience")}>
                  <option value="">{text(copy.options.choose)}</option>
                  {copy.options.experience.map((option) => <option key={option.value} value={option.value}>{text(option.label)}</option>)}
                </select>
                <ErrorText field="training_experience" error={errors.training_experience} />
              </div>
              <div className="marketing-assessment-field">
                <FieldLabel htmlFor={fieldId("days_per_week")} label={text(copy.fields.days.label)} optional={optional} />
                <select id={fieldId("days_per_week")} value={values.days_per_week} onChange={(event) => update("days_per_week", event.target.value)} {...commonInput("days_per_week")}>
                  <option value="">{text(copy.fields.days.placeholder)}</option>
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => <option key={day} value={day}>{day}</option>)}
                </select>
                <ErrorText field="days_per_week" error={errors.days_per_week} />
              </div>
              <div className="marketing-assessment-field">
                <FieldLabel htmlFor={fieldId("equipment_access")} label={text(copy.fields.equipment.label)} optional={optional} />
                <select id={fieldId("equipment_access")} value={values.equipment_access} onChange={(event) => update("equipment_access", event.target.value)} {...commonInput("equipment_access")}>
                  <option value="">{text(copy.options.choose)}</option>
                  {copy.options.equipment.map((option) => <option key={option.value} value={option.value}>{text(option.label)}</option>)}
                </select>
                <ErrorText field="equipment_access" error={errors.equipment_access} />
              </div>
            </div>
          )}

          {step === 3 && (
            <>
              <div className="marketing-assessment-privacy-note">
                <LockKeyhole aria-hidden />
                <p>{text(copy.healthPrivacy)}</p>
              </div>
              <div className="marketing-assessment-fields">
                <div className="marketing-assessment-field marketing-assessment-field--wide">
                  <FieldLabel htmlFor={fieldId("injury_history")} label={text(copy.fields.injury.label)} optional={optional} />
                  <textarea id={fieldId("injury_history")} rows={6} maxLength={3000} value={values.injury_history} onChange={(event) => update("injury_history", event.target.value)} placeholder={text(copy.fields.injury.placeholder)} {...commonInput("injury_history")} />
                  <ErrorText field="injury_history" error={errors.injury_history} />
                </div>
                <div className="marketing-assessment-field marketing-assessment-field--wide">
                  <FieldLabel htmlFor={fieldId("medical_notes")} label={text(copy.fields.medical.label)} optional={optional} />
                  <textarea id={fieldId("medical_notes")} rows={6} maxLength={3000} value={values.medical_notes} onChange={(event) => update("medical_notes", event.target.value)} placeholder={text(copy.fields.medical.placeholder)} {...commonInput("medical_notes")} />
                  <ErrorText field="medical_notes" error={errors.medical_notes} />
                </div>
              </div>
            </>
          )}

          {step === 4 && (
            <div className="marketing-assessment-review">
              <div className="marketing-assessment-review-grid">
                <ReviewGroup title={text(copy.review.contact)} editLabel={text(copy.actions.edit)} editAriaLabel={editAria(text(copy.review.contact))} onEdit={() => setStep(0)} rows={[
                  { label: text(copy.fields.fullName.label), value: provided(values.full_name) },
                  { label: text(copy.fields.email.label), value: provided(values.email) },
                  { label: text(copy.fields.phone.label), value: provided(values.phone) },
                  { label: text(copy.fields.country.label), value: provided(values.country) },
                  { label: text(copy.fields.city.label), value: provided(values.city) },
                ]} />
                <ReviewGroup title={text(copy.review.profile)} editLabel={text(copy.actions.edit)} editAriaLabel={editAria(text(copy.review.profile))} onEdit={() => setStep(1)} rows={[
                  { label: text(copy.fields.birthYear.label), value: provided(values.birth_year) },
                  { label: text(copy.fields.sex.label), value: choiceLabel(copy.options.sex, values.sex) },
                  { label: text(copy.fields.height.label), value: provided(values.height_cm) },
                  { label: text(copy.fields.weight.label), value: provided(values.weight_kg) },
                  { label: text(copy.fields.primaryGoal.label), value: provided(values.primary_goal) },
                ]} />
                <ReviewGroup title={text(copy.review.training)} editLabel={text(copy.actions.edit)} editAriaLabel={editAria(text(copy.review.training))} onEdit={() => setStep(2)} rows={[
                  { label: text(copy.fields.experience.label), value: choiceLabel(copy.options.experience, values.training_experience) },
                  { label: text(copy.fields.days.label), value: provided(values.days_per_week) },
                  { label: text(copy.fields.equipment.label), value: choiceLabel(copy.options.equipment, values.equipment_access) },
                ]} />
                <ReviewGroup title={text(copy.review.health)} editLabel={text(copy.actions.edit)} editAriaLabel={editAria(text(copy.review.health))} onEdit={() => setStep(3)} rows={[
                  { label: text(copy.fields.injury.label), value: provided(values.injury_history) },
                  { label: text(copy.fields.medical.label), value: provided(values.medical_notes) },
                ]} />
                <ReviewGroup title={text(copy.review.plan)} editLabel={text(copy.actions.edit)} editAriaLabel={editAria(text(copy.review.plan))} onEdit={() => {
                  setPlanEditing(true);
                  requestAnimationFrame(() => document.getElementById(fieldId("selected_plan"))?.focus());
                }} rows={[
                  {
                    label: text(
                      values.selected_plan
                        ? copy.plan.confirmed
                        : copy.plan.choose,
                    ),
                    value: planLabel,
                  },
                ]} />
              </div>

              <div className="marketing-assessment-field">
                <FieldLabel htmlFor={fieldId("message")} label={text(copy.fields.message.label)} optional={optional} />
                <textarea id={fieldId("message")} rows={5} maxLength={3000} value={values.message} onChange={(event) => update("message", event.target.value)} placeholder={text(copy.fields.message.placeholder)} {...commonInput("message")} />
                <ErrorText field="message" error={errors.message} />
              </div>

              <label className="marketing-assessment-consent" htmlFor={fieldId("consent")}>
                <input id={fieldId("consent")} type="checkbox" required aria-required="true" checked={consent} onChange={(event) => { setConsent(event.target.checked); setErrors((current) => ({ ...current, consent: undefined })); }} aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? `${fieldId("consent")}-error` : undefined} />
                <span>{text(copy.consent)}</span>
              </label>
              <ErrorText field="consent" error={errors.consent} />
            </div>
          )}

          <div className="marketing-assessment-honeypot" aria-hidden inert>
            <label htmlFor="assessment-website">{text(copy.honeypotLabel)}</label>
            <input id="assessment-website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
          </div>

          {formError && (
            <p ref={formErrorAlert} tabIndex={-1} className="marketing-assessment-form-error" role="alert">
              {formError}
            </p>
          )}

          <div className="marketing-assessment-actions">
            {step > 0 ? (
              <button type="button" className="marketing-assessment-back" onClick={goBack} disabled={pending}>
                <ArrowLeft aria-hidden />
                {text(copy.actions.back)}
              </button>
            ) : <span />}
            {step < copy.steps.length - 1 ? (
              <button type="button" className="marketing-button marketing-button--primary" onClick={goNext}>
                {text(copy.actions.next)}
                <ArrowRight aria-hidden />
              </button>
            ) : (
              <button type="submit" className="marketing-button marketing-button--primary" disabled={pending}>
                {text(pending ? copy.actions.submitting : copy.actions.submit)}
                {!pending && <ArrowRight aria-hidden />}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
