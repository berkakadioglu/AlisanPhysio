/* eslint-disable @typescript-eslint/no-require-imports -- Uses the existing dependency-free Node test loader. */
require("./load-ts.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const { trainingDays, exerciseEffort, titleIsMonth } = require("../src/lib/program-detail.ts");
const { formatMonth, t } = require("../src/lib/i18n.ts");
const { loadCatalogPrograms } = require("../src/lib/catalog-programs.ts");
const { missingCatalogCopy } = require("../src/lib/catalog-compatibility.ts");
const { generateRecurringOccurrences } = require("../src/lib/scheduling.ts");

test("Day navigation preserves ordering, empty days and ungrouped exercises", () => {
  const days=[{id:"b",title:"Mobility",order_index:1},{id:"a",title:"Chest Day",order_index:0},{id:"c",title:null,order_index:2}];
  const exercises=[{id:"second",day_id:"a",order_index:1},{id:"first",day_id:"a",order_index:0},{id:"loose",day_id:null,order_index:1},{id:"invalid-day",day_id:"missing",order_index:0}];
  for (const lang of ["en","tr"]) {
    const result=trainingDays(days,exercises,lang);
    assert.deepEqual(result.map(day=>day.id),["a","b","c","ungrouped"]);
    assert.deepEqual(result.map(day=>day.exercises.map(ex=>ex.id)),[["first","second"],[],[],["invalid-day","loose"]]);
    assert.equal(result[2].title,t(lang,"prog.day",{n:3}));
    assert.equal(result.flatMap(day=>day.exercises).length,exercises.length);
  }
  assert.deepEqual(days.map(day=>day.id),["b","a","c"]);
  assert.equal(trainingDays([],exercises,"en").length,1);
});

test("Month-only titles are recognised in both languages without hiding custom titles", () => {
  for (const lang of ["en","tr"]) for (let m=1;m<=12;m++) {
    const month=`2026-${String(m).padStart(2,"0")}-01`, title=formatMonth(month,lang);
    assert.equal(titleIsMonth(title,month),true);
    assert.equal(titleIsMonth(` ${title.toLocaleUpperCase(lang)} `,month),true);
    assert.equal(titleIsMonth(`${title} — Mobility`,month),false);
  }
});

test("Compact effort handles sets, ranges, timed holds and absent values", () => {
  for (const lang of ["en","tr"]) {
    assert.equal(exerciseEffort({sets:3,reps:" 10–12 "},lang),"3 × 10–12");
    assert.equal(exerciseEffort({sets:null,reps:"30 sec hold"},lang),"30 sec hold");
    assert.equal(exerciseEffort({sets:2,reps:" "},lang),t(lang,"effort.sets",{sets:2}));
    assert.equal(exerciseEffort({sets:null,reps:null},lang),null);
  }
});

test("Catalogue loads without optional columns and reports unknown metadata honestly", async () => {
  const calls=[];
  const db={from(){let fields;return {select(value){fields=value;return this;},eq(){return this;},not(){return this;},order(){return this;},range(){return this;},async returns(){
    calls.push(fields);
    if(fields.includes("updated_at"))return {data:null,error:{code:"42703",message:"column programs.updated_at does not exist"}};
    if(fields.includes("source_program_id"))return {data:null,error:{code:"42703",message:"column programs.source_program_id does not exist"}};
    return {data:[{id:"a",title:"Mobility",program_days:[{count:2}],exercises:[{count:8}]}],error:null};
  }};}};
  const rows=await loadCatalogPrograms(db);
  assert.equal(calls.length,3);
  assert.deepEqual(rows,[{id:"a",title:"Mobility",updated_at:null,dayCount:2,exerciseCount:8,clientCount:null,assignmentCount:null}]);
});

test("Catalogue preserves the database cause for unrelated failures", async () => {
  const cause={code:"42501",message:"permission denied for table programs"};
  const db={from(){return {select(){return this;},eq(){return this;},not(){return this;},order(){return this;},range(){return this;},returns:async()=>({data:null,error:cause})};}};
  await assert.rejects(loadCatalogPrograms(db),error=>error.cause===cause);
  assert.equal(missingCatalogCopy({code:"PGRST202",message:"Could not find the function public.copy_catalog_program(p_client_id, p_month_start_date) in the schema cache"}),true);
  assert.equal(missingCatalogCopy({code:"42883",message:"function public.other_function(uuid) does not exist"}),false);
  assert.equal(missingCatalogCopy({code:"42501",message:"permission denied for copy_catalog_program()"}),false);
});

test("Missing catalogue RPC uses one snapshot save, blocks occupied months, and lands on the client editor", async () => {
  const sourceId="11111111-1111-4111-8111-111111111111",clientId="22222222-2222-4222-8222-222222222222",newId="33333333-3333-4333-8333-333333333333";
  const source={title:"Signature Mobility",notes:"Coach note"};
  const exercise={id:"old-exercise",program_id:sourceId,day_id:"day",name:"Side plank",sets:3,reps:"30 sec",instructions:"Keep hips level",media_url:"https://youtu.be/abcdefghijk",library_id:null,order_index:0};
  let occupied=[],saveError=null,missingSource=false,copyError={code:"PGRST202",message:"Could not find the function public.copy_catalog_program(p_client_id, p_month_start_date, p_source_id, p_title, p_ungrouped_title) in the schema cache"};
  const calls=[],updates=[],revalidated=[];
  const db={from(table){let update=null;const filters=[];return {
    select(){return this;},eq(key,value){filters.push([key,value]);return this;},order(){return this;},range(){return this;},update(value){update=value;return this;},
    async maybeSingle(){return {data:table==="profiles"?{id:clientId,timezone:"America/Toronto"}:missingSource?null:source,error:null};},
    async returns(){return {data:table==="program_days"?[{id:"day",title:"Mobility",order_index:0}]:table==="exercises"?[exercise,{...exercise,id:"loose",day_id:null,name:"Breathing"}]:occupied.map(month_start_date=>({month_start_date})),error:null};},
    then(resolve){updates.push({update,filters});return Promise.resolve({error:{code:"PGRST204",message:"Could not find the 'source_program_id' column of 'programs' in the schema cache"}}).then(resolve);},
  };},async rpc(name,input){calls.push({name,input});return name==="copy_catalog_program"?{data:null,error:copyError}:{data:saveError?null:newId,error:saveError};}};
  const original=Module._load;
  Module._load=function(request,parent,main){
    if(request==="@/lib/admin-auth")return {requireStaff:async()=>({supabase:db})};
    if(request==="@/lib/i18n-server")return {getLang:async()=>"en"};
    if(request==="next/cache")return {revalidatePath:(...args)=>revalidated.push(args)};
    return original.call(this,request,parent,main);
  };
  const actions=require("../src/app/admin/programs/actions.ts");Module._load=original;
  const input={sourceId,clientId,monthStartDate:"2026-10-01"};
  const result=await actions.assignCatalogProgram(input);
  assert.equal(result.href,`/admin/clients/${clientId}/programs/${newId}/edit`);
  assert.deepEqual(calls.map(call=>call.name),["copy_catalog_program","save_program"]);
  const snapshot=calls[1].input;
  assert.equal(snapshot.p_id,null);assert.equal(snapshot.p_kind,"client");assert.equal(snapshot.p_client_id,clientId);assert.equal(snapshot.p_month_start_date,"2026-10-01");
  assert.deepEqual(snapshot.p_days.map(day=>day.exercises.map(ex=>ex.name)),[["Side plank"],["Breathing"]]);
  assert.deepEqual(Object.keys(snapshot.p_days[0].exercises[0]).sort(),["instructions","library_id","media_url","name","reps","sets"]);
  assert.deepEqual(updates[0],{update:{source_program_id:sourceId},filters:[["id",newId],["kind","client"],["client_id",clientId]]});
  exercise.instructions="Changed original";source.title="Changed source";
  assert.equal(snapshot.p_days[0].exercises[0].instructions,"Keep hips level");assert.equal(snapshot.p_title,"Signature Mobility");
  occupied=[input.monthStartDate];calls.length=0;
  assert.equal((await actions.assignCatalogProgram(input)).monthTaken,true);assert.equal(calls.length,0);
  occupied=[];saveError={code:"23505",message:"duplicate key"};
  assert.equal((await actions.assignCatalogProgram(input)).monthTaken,true);
  saveError=null;missingSource=true;calls.length=0;
  assert.equal((await actions.assignCatalogProgram(input)).error,t("en","catalog.notFound"));assert.equal(calls.length,1);
  missingSource=false;copyError={code:"42501",message:"permission denied"};calls.length=0;
  assert.equal((await actions.assignCatalogProgram(input)).ok,false);assert.equal(calls.length,1);
  assert.ok(revalidated.some(([route])=>route==="/dashboard"));
});

test("Renamed recurrence helper retains local time across daylight-saving changes", () => {
  const rows=generateRecurringOccurrences({firstDate:"2026-10-25",localTime:"09:00",timeZone:"America/Toronto",weeks:2,durationMin:30});
  assert.deepEqual(rows.map(row=>row.startsAt),["2026-10-25T13:00:00.000Z","2026-11-01T14:00:00.000Z"]);
});
