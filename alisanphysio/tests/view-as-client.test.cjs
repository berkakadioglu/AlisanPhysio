/* eslint-disable @typescript-eslint/no-require-imports -- Uses the existing dependency-free Node test loader. */
require("./load-ts.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { activeTabFor } = require("../src/components/client-dashboard-shell.tsx");
const {
  DASHBOARD_BASE,
  clientViewBase,
  loadClientAppointmentsForStaff,
  nextUpcomingAppointment,
  toClientVisibleAppointment,
} = require("../src/lib/client-view.ts");

const CLIENT = "4f1c2b3a-1111-4222-8333-444455556666";
const COACH = "0a0b0c0d-2222-4333-8444-555566667777";
const PROGRAM = "9a8b7c6d-aaaa-4bbb-8ccc-ddddeeeeffff";
const BASE = `/admin/clients/${CLIENT}/view`;
const SRC = path.join(__dirname, "../src");

function appointment(overrides) {
  return {
    id: "appt-1",
    created_at: "2026-10-01T08:00:00.000Z",
    client_id: CLIENT,
    coach_id: COACH,
    slot_id: null,
    starts_at: "2026-10-12T09:00:00.000Z",
    duration_min: 60,
    status: "confirmed",
    meeting_url: null,
    agenda: null,
    coach_note: null,
    cancelled_by: null,
    cancelled_reason: null,
    cancelled_at: null,
    ...overrides,
  };
}

test("activeTabFor resolves the client dashboard and the staff view onto the same tabs", () => {
  assert.equal(DASHBOARD_BASE, "/dashboard");
  assert.equal(clientViewBase(CLIENT), BASE);

  assert.equal(activeTabFor("/dashboard"), "overview");
  assert.equal(activeTabFor("/dashboard/programme"), "programme");
  assert.equal(activeTabFor(`/dashboard/${PROGRAM}`), "programme");
  assert.equal(activeTabFor("/dashboard/profile"), null);
  assert.equal(activeTabFor("/dashboard/review"), null);
  assert.equal(activeTabFor("/dashboard/availability"), "schedule");

  assert.equal(activeTabFor(BASE, BASE), "overview");
  assert.equal(activeTabFor(`${BASE}/programme`, BASE), "programme");
  assert.equal(activeTabFor(`${BASE}/${PROGRAM}`, BASE), "programme");
  assert.equal(activeTabFor(`${BASE}/profile`, BASE), null);
  assert.equal(activeTabFor(`${BASE}/review`, BASE), null);
  assert.equal(activeTabFor(`${BASE}/availability`, BASE), "schedule");
  assert.equal(activeTabFor(`${BASE}/nutrition`, BASE), "nutrition");
  assert.equal(activeTabFor(`${BASE}/progress`, BASE), "progress");

  // Paths outside the mirrored base, including look-alike prefixes, have no tab.
  assert.equal(activeTabFor(`/admin/clients/${CLIENT}`, BASE), null);
  assert.equal(activeTabFor(`/admin/clients/${CLIENT}/viewer`, BASE), null);
  assert.equal(activeTabFor("/dashboard/programme", BASE), null);
});

test("toClientVisibleAppointment drops the coach note, hides the meeting link and leaves the input alone", () => {
  const source = appointment({
    id: "a1",
    meeting_url: "https://meet.example/private-room",
    coach_note: "Private coaching note",
    agenda: "Hips and mobility",
  });
  const snapshot = JSON.parse(JSON.stringify(source));

  const visible = toClientVisibleAppointment(source);

  assert.deepEqual(source, snapshot);
  assert.notEqual(visible, source);
  assert.equal("coach_note" in visible, false);
  assert.equal(visible.meeting_url, null);
  assert.equal(visible.agenda, "Hips and mobility");
  assert.equal(visible.id, "a1");
  assert.deepEqual(
    Object.keys(visible).sort(),
    Object.keys(snapshot).filter((key) => key !== "coach_note").sort(),
  );
});

test("nextUpcomingAppointment picks the earliest active appointment that has not ended", () => {
  const NOW = Date.parse("2026-10-12T10:00:00.000Z");
  const ended = appointment({ id: "ended", starts_at: "2026-10-12T08:00:00.000Z", duration_min: 60 });
  const justEnded = appointment({ id: "just-ended", starts_at: "2026-10-12T09:00:00.000Z", duration_min: 60 });
  const cancelled = appointment({ id: "cancelled", starts_at: "2026-10-12T10:15:00.000Z", status: "cancelled" });
  const completed = appointment({ id: "completed", starts_at: "2026-10-12T10:20:00.000Z", status: "completed" });
  const later = appointment({ id: "later", starts_at: "2026-10-13T09:00:00.000Z", status: "pending" });
  const underway = appointment({ id: "underway", starts_at: "2026-10-12T09:30:00.000Z", duration_min: 60 });
  const list = [later, cancelled, ended, completed, underway];

  assert.equal(nextUpcomingAppointment(list, NOW).id, "underway");
  assert.equal(nextUpcomingAppointment([later, ended, cancelled, completed], NOW).id, "later");
  assert.equal(nextUpcomingAppointment([ended, justEnded, cancelled, completed], NOW), null);
  assert.equal(nextUpcomingAppointment([], NOW), null);
  assert.deepEqual(list.map((row) => row.id), ["later", "cancelled", "ended", "completed", "underway"]);
});

test("loadClientAppointmentsForStaff scopes the RPC to one client and returns client-safe rows newest first", async () => {
  const calls = [];
  const rows = [
    appointment({ id: "earlier", starts_at: "2026-10-05T09:00:00.000Z", coach_note: "private", meeting_url: "https://meet.example/x" }),
    appointment({ id: "later", starts_at: "2026-10-20T09:00:00.000Z", coach_note: "private" }),
  ];
  const supabase = {
    rpc(name, args) {
      calls.push({ name, args });
      return { returns: async () => ({ data: rows, error: null }) };
    },
  };

  const result = await loadClientAppointmentsForStaff(supabase, CLIENT, "2026-10-11T00:00:00.000Z");

  assert.deepEqual(calls, [{
    name: "get_staff_appointments",
    args: { p_from: "2026-10-11T00:00:00.000Z", p_to: null, p_client_id: CLIENT, p_appointment_id: null },
  }]);
  assert.deepEqual(result.map((row) => row.id), ["later", "earlier"]);
  for (const row of result) {
    assert.equal("coach_note" in row, false);
    assert.equal(row.meeting_url, null);
  }

  const failing = { rpc: () => ({ returns: async () => ({ data: null, error: { message: "denied" } }) }) };
  await assert.rejects(
    loadClientAppointmentsForStaff(failing, CLIENT, null),
    { message: "Could not load appointments" },
  );
});

function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

const read = (file) => fs.readFileSync(file, "utf8");
const VIEW_FILES = filesUnder(path.join(SRC, "app/admin/clients/[id]/view")).filter((file) => /\.tsx?$/.test(file));
const CONTENT_FILES = [
  "app/dashboard/overview-content.tsx",
  "app/dashboard/programme-content.tsx",
  "app/dashboard/[programId]/programme-detail-content.tsx",
  "app/dashboard/nutrition/nutrition-content.tsx",
].map((rel) => path.join(SRC, rel));

test("staff view routes are read-only: no dashboard links, actions, forms or client-only chrome", () => {
  assert.ok(VIEW_FILES.length >= 8, "expected the staff view route files");
  for (const file of [...VIEW_FILES, ...CONTENT_FILES]) {
    const src = read(file);
    const name = path.relative(SRC, file);
    assert.doesNotMatch(src, /href=\{?\s*["'`]\/dashboard/, `${name} links to /dashboard`);
    assert.doesNotMatch(src, /from\s+["'][^"']*actions["']/, `${name} imports an actions module`);
    assert.doesNotMatch(src, /["']use server["']/, `${name} declares server actions`);
    for (const forbidden of ["<form", "NotificationBell", "WhatsAppButton", "generateSystemNotifications", "AppHeader"]) {
      assert.equal(src.includes(forbidden), false, `${name} contains ${forbidden}`);
    }
  }
});

test("every ReviewAction in the shared dashboard content sits behind readOnly", () => {
  const expectedUses = {
    "overview-content.tsx": 1,
    "programme-detail-content.tsx": 1,
    "programme-content.tsx": 0,
    "nutrition-content.tsx": 0,
  };
  for (const file of CONTENT_FILES) {
    const src = read(file);
    const name = path.basename(file);
    const uses = [...src.matchAll(/<ReviewAction\b/g)];
    assert.equal(uses.length, expectedUses[name], `${name} ReviewAction count`);
    for (const use of uses) {
      const before = src.slice(Math.max(0, use.index - 400), use.index);
      assert.match(before, /!readOnly|readOnly\s*\?/, `${name} renders ReviewAction without a readOnly guard`);
    }
  }
  assert.match(read(CONTENT_FILES[1]), /review=\{readOnly \? undefined : group\.review\}/);
  assert.match(read(path.join(SRC, "app/dashboard/program-list.tsx")), /review && !readOnly/);
});

test("the staff nutrition view checks the client's nutrition flag before loading the plan", () => {
  const src = read(path.join(SRC, "app/admin/clients/[id]/view/nutrition/page.tsx"));
  const gate = src.search(/if\s*\(\s*!\s*\(\s*await\s+nutritionEnabled\(/);
  const load = src.search(/await\s+loadNutritionPlan\(/);
  assert.ok(gate >= 0, "nutrition view has no nutritionEnabled gate");
  assert.ok(load >= 0, "nutrition view never loads the plan");
  assert.ok(gate < load, "nutritionEnabled must run before loadNutritionPlan");
  assert.match(src.slice(gate, load), /notFound\(\)/, "a disabled nutrition flag must 404 before the plan loads");
});
