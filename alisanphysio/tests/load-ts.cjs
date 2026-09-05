/* eslint-disable @typescript-eslint/no-require-imports -- This dependency-free Node test loader uses CommonJS. */
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "../src");
const load = Module._load;
Module._load = function(request, parent, main) {
  if (request.startsWith("@/")) request = path.join(root, request.slice(2));
  return load.call(this, request, parent, main);
};
for (const ext of [".ts", ".tsx"]) require.extensions[ext] = (module, filename) => {
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  module._compile(code, filename);
};
