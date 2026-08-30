"use client";

import { useSyncExternalStore } from "react";
import {
  detectBrowserTimeZone,
  formatZonedDateTime,
  isValidTimeZone,
} from "@/lib/scheduling";

const subscribeBrowserTimeZone = () => () => {};

/**
 * Render in the saved viewer zone, or in the browser zone on first load before
 * the profile suggestion has been accepted. The server snapshot deliberately
 * renders a neutral label instead of flashing an incorrect UTC time.
 */
export default function AppointmentLocalTime({
  startsAt,
  storedTimeZone,
  locale,
  unavailableLabel,
}: {
  startsAt: string;
  storedTimeZone: string | null;
  locale: string;
  unavailableLabel: string;
}) {
  const validStoredTimeZone =
    storedTimeZone && isValidTimeZone(storedTimeZone)
      ? storedTimeZone
      : null;
  const browserTimeZone = useSyncExternalStore(
    subscribeBrowserTimeZone,
    detectBrowserTimeZone,
    () => validStoredTimeZone,
  );
  const timeZone =
    validStoredTimeZone
      ? validStoredTimeZone
      : browserTimeZone && isValidTimeZone(browserTimeZone)
        ? browserTimeZone
        : null;

  if (!timeZone) {
    return (
      <p className="break-words text-sm font-medium text-muted-foreground">
        {unavailableLabel}
      </p>
    );
  }

  return (
    <p className="break-words text-base font-bold text-foreground">
      {formatZonedDateTime(startsAt, timeZone, locale).label}
    </p>
  );
}
