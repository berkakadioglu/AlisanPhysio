"use client";

import { Dumbbell, UserRound } from "lucide-react";
import NavDropdown from "./nav-dropdown";

/**
 * The "Me" dropdown in the admin nav — the staff member's own space: their
 * Personal Exercises (programs authored for themselves) and their own Profile
 * (name, height, password, measurements — the same self-service profile clients
 * use, RLS-scoped to the signed-in user).
 */
export default function MeNav() {
  return (
    <NavDropdown
      label="nav.me"
      items={[
        { href: "/dashboard", label: "nav.personalExercises", Icon: Dumbbell },
        { href: "/dashboard/profile", label: "profile.link", Icon: UserRound },
      ]}
    />
  );
}
