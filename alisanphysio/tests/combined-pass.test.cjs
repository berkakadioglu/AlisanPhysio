/* eslint-disable @typescript-eslint/no-require-imports -- Runs with the existing dependency-free CommonJS test loader. */
require("./load-ts.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { generateFmsSlots, validFmsSettings, validFmsSubmission, fmsCalendar } = require("../src/lib/fms.ts");
const { zonedDateTimeParts } = require("../src/lib/scheduling.ts");
const { validateAssessmentInput } = require("../src/lib/assessment-validation.ts");
const { loadNutritionPlan, nutritionPlanSummary } = require("../src/lib/nutrition.ts");
const { sortCategories } = require("../src/lib/categories.ts");
const { categoryLabel } = require("../src/lib/i18n.ts");
const { routeRedirect } = require("../src/lib/route-access.ts");
const { PUBLIC_PATHS } = require("../src/lib/constants.ts");
const settings = { timezone: "Europe/Istanbul", fms_enabled: true, fms_days: [1,2,3,4,5], fms_window_start: "15:00", fms_window_end: "18:00", fms_slot_min: 30, fms_min_notice_hours: 12, fms_horizon_days: 14 };

test("FMS: same UTC slot renders Toronto 08:00 and Istanbul 15:00", () => {
  const slots = generateFmsSlots(settings, [], new Date("2026-09-07T00:00:00Z"));
  assert.equal(slots[0].startsAt, "2026-09-07T12:00:00.000Z");
  assert.equal(zonedDateTimeParts(slots[0].startsAt, "America/Toronto").time, "08:00");
  assert.equal(zonedDateTimeParts(slots[0].startsAt, "Europe/Istanbul").time, "15:00");
});
test("FMS: notice, allowed days, horizon, disabled flag and booked overlap", () => {
  const now = new Date("2026-09-07T00:01:00Z");
  const slots = generateFmsSlots({ ...settings, fms_horizon_days: 1 }, [{ starts_at: "2026-09-07T12:30:00Z", duration_min: 45 }], now);
  assert.equal(slots[0].startsAt, "2026-09-07T13:30:00.000Z");
  assert.equal(slots.length, 3);
  assert.equal(generateFmsSlots({ ...settings, fms_enabled: false }, [], now).length, 0);
  assert.equal(generateFmsSlots({ ...settings, fms_horizon_days: 1 }, [], new Date("2026-09-06T00:00:00Z")).length, 0);
});
test("FMS: coach local 15–18 stays fixed across spring and autumn DST", () => {
  for (const [now, first, second] of [["2026-03-07T10:00Z", "20:00", "19:00"], ["2026-10-31T10:00Z", "19:00", "20:00"]]) {
    const slots = generateFmsSlots({ ...settings, timezone: "America/Toronto", fms_days: [1,2,3,4,5,6,7], fms_horizon_days: 2, fms_min_notice_hours: 0 }, [], new Date(now));
    assert.equal(slots.length, 12);
    assert.equal(slots[0].startsAt.slice(11,16), first); assert.equal(slots[6].startsAt.slice(11,16), second);
    for (const i of [0,6]) assert.equal(zonedDateTimeParts(slots[i].startsAt, "America/Toronto").time, "15:00");
    for (const i of [5,11]) assert.equal(zonedDateTimeParts(slots[i].startsAt, "America/Toronto").time, "17:30");
  }
});
test("FMS: duration settings validated and used in slots and ICS", () => {
  for (const bad of [{fms_days:[]},{fms_days:[1,1]},{fms_window_end:"14:00"},{fms_slot_min:35},{fms_horizon_days:0},{fms_min_notice_hours:-1}]) assert.equal(validFmsSettings({...settings,...bad}),false);
  const slots=generateFmsSlots({...settings,fms_slot_min:45,fms_horizon_days:1},[],new Date("2026-09-07T00:00Z"));
  assert.equal(slots.length,4);assert.equal(slots[0].durationMin,45);
  for(const lang of ["en","tr"]){
    const ics=fmsCalendar({id:"test",starts_at:slots[0].startsAt,duration_min:45,visitor_timezone:"America/Toronto"},lang,new Date("2026-09-01T00:00Z"));
    assert.match(ics,/DTSTART:20260907T120000Z\r\nDTEND:20260907T124500Z/);
    assert.match(ics,/UID:test@trainwithalisan/);
    for(const line of ics.split("\r\n")) assert.ok(Buffer.byteLength(line)<=75);
  }
});
test("FMS: consent, honeypot, 2.5 second delay and anonymous route allowlist", () => {
  const now=Date.now();const input={full_name:"Visitor",email:"visitor@example.com",visitor_timezone:"America/Toronto",starts_at:"2026-09-07T12:00Z",consent:true,website:"",started_at:now-2500};
  assert.ok(validFmsSubmission(input,now));
  for(const bad of [{consent:false},{website:"spam"},{started_at:now},{email:"bad"},{visitor_timezone:"made/up"},{full_name:" "}]) assert.equal(validFmsSubmission({...input,...bad},now),false);
  assert.equal(routeRedirect({pathname:"/fms",authenticated:false,role:null,membershipIsActive:false,publicPaths:PUBLIC_PATHS}),null);
});
test("Assessment requires expectation, caps length, stores trimmed value", () => {
  const input=Object.fromEntries(["phone","country","city","birth_year","sex","height_cm","weight_kg","training_experience","days_per_week","equipment_access","injury_history","medical_notes","selected_plan","message"].map(k=>[k,""]));
  Object.assign(input,{full_name:"Visitor",email:"visitor@example.com",primary_goal:"Move well",biggest_expectation:"  Clear guidance  ",preferred_language:"tr",consent:true,website:"",started_at:Date.now()-5000});
  const good=validateAssessmentInput(input);assert.ok(good.ok);assert.equal(good.data.biggest_expectation,"Clear guidance");
  for(const value of [undefined,"","  ","x".repeat(1501)]){const bad=validateAssessmentInput({...input,biggest_expectation:value});assert.equal(bad.ok,false);assert.equal(bad.errors.biggest_expectation,"requiredExpectation");}
});
test("Disabled nutrition loaders never query plans or children", async () => {
  const calls=[];const db={from(table){calls.push(table);assert.equal(table,"profiles");return {select(){return this},eq(){return this},async maybeSingle(){return {data:{nutrition_enabled:false}}}}},auth:{async getUser(){return {data:{user:null}}}}};
  assert.equal(await loadNutritionPlan(db,"client"),null);
  assert.deepEqual(await nutritionPlanSummary(db,"client"),{hasPlan:false,mealCount:0});
  assert.equal(await loadNutritionPlan(db,"client",true),null);
  assert.deepEqual(calls,["profiles","profiles"]);
});
test("Categories ignore historical default flags and display stored names", () => {
  const cats=[{name:"Plyometrics - Upper Body",is_default:false},{name:"Alisan Signature",is_default:false},{name:"Chest",is_default:true}];
  assert.equal(sortCategories(cats)[0].name,"Alisan Signature");assert.equal(categoryLabel("tr",cats[2]),"Chest");
});
test("Unapplied migration: profile guard, backfill, category preservation, FMS uniqueness and RLS", () => {
  const sql=fs.readFileSync(path.join(__dirname,"../supabase/migrations/0019_nutrition_assessment_fms.sql"),"utf8");
  assert.match(sql,/delete from public.exercise_categories c where not exists/);
  assert.match(sql,/nutrition_enabled is distinct from old.nutrition_enabled\)[\s\S]*?and not public.is_staff\(\)/);
  assert.match(sql,/if not exists[\s\S]*?column_name = 'nutrition_enabled'[\s\S]*?update public.profiles/);
  assert.match(sql,/unique index[\s\S]*?on public.fms_bookings\(starts_at\) where status = 'booked'/);
  assert.match(sql,/enable row level security/);assert.match(sql,/revoke all on public.fms_bookings from public, anon, authenticated/);
  assert.doesNotMatch(sql,/create policy[^;]*to anon/i);
  assert.doesNotMatch(sql,/\b(?:insert into|update|delete from|alter table) public\.(appointments|availability_slots|client_proposals)\b/i);
});

test("New assessments ignore retired or malformed plans while admin history stays readable", () => {
  const { normalizeAssessmentPlan, assessmentPlanLabel } = require("../src/lib/assessment.ts");
  const input = Object.fromEntries(["phone", "country", "city", "birth_year", "sex", "height_cm", "weight_kg", "training_experience", "days_per_week", "equipment_access", "injury_history", "medical_notes", "message"].map(key => [key, ""]));
  Object.assign(input, { full_name: "Visitor", email: "visitor@example.com", primary_goal: "Move well", biggest_expectation: "Clear guidance", preferred_language: "en", consent: true, website: "", started_at: Date.now() - 5000 });
  for (const value of ["monthly", "quarterly", "unknown", "x".repeat(2000), ["monthly", "quarterly"], null, undefined]) {
    const expected = value === "monthly" ? "monthly" : null;
    assert.equal(normalizeAssessmentPlan(value), expected);
    const result = validateAssessmentInput({ ...input, selected_plan: value });
    assert.equal(result.ok, true);
    assert.equal(result.data.selected_plan, expected);
  }
  assert.equal(assessmentPlanLabel("en", "quarterly"), "Quarterly");
  assert.equal(assessmentPlanLabel("tr", "quarterly"), "Üç Aylık");
});

test("Public booking action handles concurrent unique conflicts without exposing database errors (mocked DB)", async () => {
  const Module = require("node:module");
  const original = Module._load;
  const slot = { startsAt: "2026-10-05T12:00:00.000Z", durationMin: 45 };
  const inserted = new Set();
  let availabilityReads = 0;
  Module._load = function(request, parent, main) {
    if (request === "@/lib/i18n-server") return { getLang: async () => "en" };
    if (request === "@/lib/fms-data") return { loadFmsAvailability: async () => { availabilityReads++; return { slots: [slot] }; } };
    if (request === "@/lib/supabase/admin") return { createAdminClient: () => ({ from(table) {
      assert.equal(table,"fms_bookings");
      return { insert(row) { return { select() { return { async single() {
        if(inserted.has(row.starts_at)) return {data:null,error:{code:"23505",message:"PRIVATE DATABASE ERROR"}};
        inserted.add(row.starts_at);
        assert.equal(row.duration_min,45);assert.equal(row.preferred_language,"en");
        return {data:{id:"booking",starts_at:row.starts_at,duration_min:row.duration_min,visitor_timezone:row.visitor_timezone},error:null};
      } }; } }; } };
    } }) };
    return original.call(this,request,parent,main);
  };
  let bookFms;
  try { ({ bookFms } = require("../src/app/(marketing)/fms/actions.ts")); }
  finally { Module._load = original; }
  const input={full_name:"Visitor",email:"visitor@example.com",visitor_timezone:"America/Toronto",starts_at:slot.startsAt,consent:true,website:"",started_at:Date.now()-5000};
  const outcomes=await Promise.all([bookFms(input),bookFms(input)]);
  assert.equal(outcomes.filter(o=>o.ok).length,1);
  const loser=outcomes.find(o=>!o.ok);assert.equal(loser.taken,true);assert.match(loser.error,/just taken/);assert.doesNotMatch(loser.error,/PRIVATE/);
  assert.equal(availabilityReads,2);
  const invalid=await bookFms({...input,consent:false});assert.equal(invalid.ok,false);assert.equal(availabilityReads,2);
});
