/* eslint-disable @typescript-eslint/no-require-imports -- Uses the existing dependency-free Node test loader. */
require("./load-ts.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { catalogListItems, loadCatalogPrograms } = require("../src/lib/catalog-programs.ts");
const { t } = require("../src/lib/i18n.ts");

test("Catalogue counts distinguish clients from assignments and include all days/exercises", () => {
  const rows = [{ id: "a", title: "Mobility", updated_at: "2026-09-05", program_days: [{ count: 5 }], exercises: [{ count: 17 }] }, { id: "b", title: "Empty", updated_at: "2026-09-04", program_days: [], exercises: [] }];
  const result = catalogListItems(rows, [{ source_program_id: "a", client_id: "c1" }, { source_program_id: "a", client_id: "c1" }, { source_program_id: "a", client_id: "c2" }]);
  assert.deepEqual(result.map(p => [p.dayCount,p.exerciseCount,p.clientCount,p.assignmentCount]), [[5,17,2,3],[0,0,0,0]]);
});

test("Catalogue loader paginates both programmes and lineage counts, and does not hide query errors", async () => {
  const calls = [];
  const db = { from() {
    let fields, start;
    return { select(v) { fields=v; return this; }, eq(key,value) { calls.push([key,value]); return this; }, not() { return this; }, order(key, options) { calls.push([key, options]); return this; }, range(a) { start=a; return this; }, async returns() {
      const count = start === 0 ? 1000 : 1;
      return { data: Array.from({length:count},(_,i)=> fields.startsWith("id,") ? { id:String(start+i),title:"Programme",updated_at:"2026-09-05",program_days:[],exercises:[] } : { source_program_id:"0",client_id:String(start+i) }), error:null };
    } };
  } };
  const rows=await loadCatalogPrograms(db);
  assert.equal(rows.length,1001);assert.equal(rows[0].assignmentCount,1001);assert.equal(rows[0].clientCount,1001);
  assert.ok(calls.some(([key,value])=>key==="kind"&&value==="catalog"));
  assert.ok(calls.some(([key,value])=>key==="updated_at"&&value.ascending===false));
  const failed={from(){const query={select(){return this;},eq(){return this;},not(){return this;},order(){return this;},range(){return this;},returns:async()=>({error:{message:"offline"}})};return query;}};
  await assert.rejects(loadCatalogPrograms(failed));
});

test("Catalogue actions check occupied months before copying, handle races and protect catalogue-only deletion", async () => {
  const sourceId="11111111-1111-4111-8111-111111111111",clientId="22222222-2222-4222-8222-222222222222",newId="33333333-3333-4333-8333-333333333333";
  let occupied=[],rpcError=null,lang="en",staffCalls=0,invalidClient=false;
  const rpcs=[],queries=[],revalidated=[];
  const db={from(table){
    const filters=[];let deleting=false;
    const query={select(){return this;},eq(key,value){filters.push([key,value]);return this;},order(){return this;},range(){return this;},delete(){deleting=true;return this;},async maybeSingle(){queries.push({table,filters,deleting});
      if(table==="profiles")return {data:invalidClient?null:{id:clientId,timezone:"America/Toronto"},error:null};
      return {data:deleting?{id:sourceId}:{title:"Signature Mobility"},error:null};
    },async returns(){return {data:occupied.map(month_start_date=>({month_start_date})),error:null};}};return query;
  },async rpc(name,input){rpcs.push({name,input});return {data:rpcError?null:newId,error:rpcError};}};
  const original=Module._load;
  Module._load=function(request,parent,main){
    if(request==="@/lib/admin-auth")return {requireStaff:async()=>{staffCalls++;return {supabase:db};}};
    if(request==="@/lib/i18n-server")return {getLang:async()=>lang};
    if(request==="next/cache")return {revalidatePath:(...args)=>revalidated.push(args)};
    return original.call(this,request,parent,main);
  };
  const actions=require("../src/app/admin/programs/actions.ts");Module._load=original;
  occupied=["2026-09-01"];
  const blocked=await actions.assignCatalogProgram({sourceId,clientId,monthStartDate:"2026-09-01"});
  assert.equal(blocked.monthTaken,true);assert.equal(rpcs.length,0);
  const invalid=await actions.assignCatalogProgram({sourceId,clientId,monthStartDate:"2026-10-02"});assert.equal(invalid.ok,false);assert.equal(rpcs.length,0);
  const success=await actions.assignCatalogProgram({sourceId,clientId,monthStartDate:"2026-10-01"});
  assert.equal(success.href,`/admin/clients/${clientId}/programs/${newId}/edit`);
  assert.deepEqual(rpcs[0],{name:"copy_catalog_program",input:{p_source_id:sourceId,p_client_id:clientId,p_month_start_date:"2026-10-01",p_title:null,p_ungrouped_title:t("en","editor.ungrouped")}});
  rpcError={code:"23505",message:"private database detail"};lang="tr";
  const race=await actions.assignCatalogProgram({sourceId,clientId,monthStartDate:"2026-10-01"});assert.equal(race.monthTaken,true);assert.equal(race.error,t("tr","err.programMonthTaken"));
  rpcError={code:"P0002",message:"catalog_not_found"};
  const gone=await actions.assignCatalogProgram({sourceId,clientId,monthStartDate:"2026-10-01"});assert.equal(gone.error,t("tr","catalog.notFound"));
  rpcError=null;const duplicate=await actions.duplicateCatalogProgram(sourceId);assert.equal(duplicate.programId,newId);
  assert.equal(rpcs.at(-1).input.p_client_id,null);assert.equal(rpcs.at(-1).input.p_month_start_date,null);assert.equal(rpcs.at(-1).input.p_title,"Signature Mobility (kopya)");
  const deleted=await actions.deleteCatalogProgram(sourceId);assert.equal(deleted.ok,true);
  assert.deepEqual(queries.find(q=>q.deleting).filters,[["id",sourceId],["kind","catalog"]]);
  invalidClient=true;const before=rpcs.length;assert.equal((await actions.assignCatalogProgram({sourceId,clientId,monthStartDate:"2026-10-01"})).ok,false);assert.equal(rpcs.length,before);
  assert.equal(staffCalls,8);assert.ok(revalidated.some(([route])=>route==="/admin/programs"));
});

test("Unexecuted SQL keeps snapshots independent and source deletion non-cascading", () => {
  const sql=fs.readFileSync(path.join(__dirname,"../supabase/migrations/0020_catalog_programmes.sql"),"utf8");
  assert.match(sql,/foreign key \(source_program_id\) references public.programs\(id\) on delete set null/);
  assert.doesNotMatch(sql,/on delete cascade/i);
  assert.match(sql,/result_id := public.save_program\(null,/);
  assert.match(sql,/update public.programs set source_program_id = source.id where id = result_id/);
  assert.match(sql,/kind = 'catalog' for share/);
  assert.match(sql,/security invoker/);
  assert.ok(sql.indexOf("program_month_taken")<sql.indexOf("result_id :="));
  for(const field of ["name","sets","reps","instructions","media_url","library_id"])assert.match(sql,new RegExp(`'${field}', e\\.${field}`));
  assert.doesNotMatch(sql,/create or replace function public.save_program/);
  const save=fs.readFileSync(path.join(__dirname,"../supabase/migrations/0018_monthly_programs.sql"),"utf8");
  assert.match(save,/program_ownership_immutable/);
  const clientLoader=fs.readFileSync(path.join(__dirname,"../src/lib/program-editor-loader.ts"),"utf8");
  assert.doesNotMatch(clientLoader,/source_program_id/);
});
