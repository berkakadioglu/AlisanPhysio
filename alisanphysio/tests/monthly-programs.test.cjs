/* eslint-disable @typescript-eslint/no-require-imports -- Node runs these regression tests through the CommonJS loader. */
require("./load-ts.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const month = require("../src/lib/month.ts");
const { editorDays } = require("../src/lib/program-editor-data.ts");
const { formatMonth, t } = require("../src/lib/i18n.ts");
const { DEMO_DATA } = require("../src/lib/demo-data.ts");

test("calendar month boundary follows Toronto, not the coach or UTC", () => {
  const now = new Date("2026-10-01T01:00:00Z");
  assert.equal(month.bucketForMonthStart("2026-09-01", now, "America/Toronto"), "current");
  assert.equal(month.bucketForMonthStart("2026-09-01", now, "Europe/Istanbul"), "past");
  assert.equal(month.bucketForMonthStart("2026-10-01", now, "America/Toronto"), "upcoming");
  assert.equal(month.bucketForMonthStart("2026-08-01", now, "America/Toronto"), "past");
});
test("review window: exact last seven dates for 28/29/30/31-day months", () => {
  for (const [key, first, last] of [["2026-02-01",22,28],["2028-02-01",23,29],["2026-09-01",24,30],["2026-12-01",25,31]]) {
    const at = (day) => new Date(`${key.slice(0,8)}${String(day).padStart(2,"0")}T12:00:00Z`);
    assert.equal(month.isReviewDue(key, at(first-1), "UTC"), false);
    assert.equal(month.isReviewDue(key, at(first), "UTC"), true);
    assert.equal(month.isReviewDue(key, at(last), "UTC"), true);
    assert.equal(month.isReviewDue(key, new Date(month.nextMonthISO(key)+"T00:00:00Z"), "UTC"), false);
  }
  assert.equal(month.isReviewDue("2026-09-01", new Date("2026-10-01T03:59:59Z"), "America/Toronto"), true);
  assert.equal(month.isReviewDue("2026-09-01", new Date("2026-10-01T04:00:00Z"), "America/Toronto"), false);
});
test("month selection rolls across years, skips used months and rejects malformed keys", () => {
  assert.equal(month.nextMonthISO("2026-12-01"),"2027-01-01");
  assert.equal(month.defaultNewMonth(["2026-12-01","2027-01-01"],new Date("2026-12-01T12:00:00Z"),"UTC"),"2027-02-01");
  for (const bad of ["2026-09-02","2026-13-01","",null]) assert.equal(month.isMonthStart(bad),false);
  assert.equal(formatMonth("2026-09-01","en"),"September 2026");
  assert.equal(formatMonth("2026-09-01","tr"),"Eylül 2026");
});
test("copy is independent and ungrouped exercises survive serialization and reload", () => {
  const source = [{id:"a",title:"Chest day",order_index:0}];
  const exercises = [{name:"Press",day_id:"a",order_index:0,sets:3},{name:"Carry",day_id:null,order_index:1,sets:2},{name:"Row",day_id:"missing",order_index:2,sets:4}];
  const copy = editorDays(source,exercises,"Additional training");
  source[0].title = "Changed"; exercises[0].sets = 99;
  assert.equal(copy[0].title,"Chest day");assert.equal(copy[0].exercises[0].sets,3);
  const payload = JSON.parse(JSON.stringify(copy));
  const days = payload.map((d,i)=>({id:`new-${i}`,title:d.title,order_index:i}));
  const rows = payload.flatMap((d,i)=>d.exercises.map((e,j)=>({...e,day_id:days[i].id,order_index:j})));
  assert.deepEqual(editorDays(days,rows,"Additional training").flatMap(d=>d.exercises.map(e=>e.name)),["Press","Carry","Row"]);
});
test("demo uses named monthly sessions and monthly review copy in both languages", () => {
  assert.deepEqual(DEMO_DATA.programme.months.map(m => m.range.en), ["July 1–31", "August 1–31", "September 1–30"]);
  for (const lang of ["en","tr"]) {
    for (const m of DEMO_DATA.programme.months) for (const d of m.days) assert.doesNotMatch(d.title[lang],/Day \d|\d\. Gün/);
    assert.doesNotMatch(DEMO_DATA.overview.reviewTitle[lang],/Sunday|pazar/i);
    assert.match(DEMO_DATA.overview.reviewEyebrow[lang],/Monthly|Aylık/);
  }
});
test("new translated labels exist in both languages", () => {
  for (const lang of ["en","tr"]) for (const key of ["catalog.create","catalog.assign","editor.dayName","err.programMonthTaken","review.notDue","err.reviewAlreadySubmitted","pdf.notesFrom"]) {
    assert.notEqual(t(lang,key),key);
  }
});
test("migration contract (static only; migration is deliberately NOT executed)", () => {
  const sql=fs.readFileSync(path.join(__dirname,"../supabase/migrations/0018_monthly_programs.sql"),"utf8");
  assert.match(sql,/unique index if not exists programs_client_month_uidx[\s\S]*?where kind = 'client'/);
  assert.match(sql,/foreign key \(program_id, client_id\) references public.programs\(id, client_id\) on delete cascade/);
  assert.match(sql,/unique\(client_id, program_id\)/);
  assert.match(sql,/using \(kind = 'client' and client_id = auth.uid\(\)\)/);
  const rpc=sql.slice(sql.indexOf("create or replace function public.save_program"));
  assert.match(rpc,/security invoker/);assert.match(rpc,/for update/);assert.doesNotMatch(rpc,/exception\s+when/i);
  assert.match(rpc,/staff_access_required/);
  assert.doesNotMatch(sql,/delete from public\.(exercise_library|exercise_categories|day_templates|day_template_exercises)/);
});
