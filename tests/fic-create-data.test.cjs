const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {freshDocumentData,ficValidationMessage}=require('../lib/fic-create-data.ts');
const input={entity:{id:12},items_list:[{id:-1,name:'Test',vat:{id:0}}],payments_list:[{id:-1,amount:122}]};const out=freshDocumentData(input);assert.equal(out.entity.id,12);assert.equal(out.items_list[0].vat.id,0);assert.equal(out.items_list[0].id,undefined);assert.equal(out.payments_list[0].id,undefined);assert.equal(input.payments_list[0].id,-1);
assert.match(ficValidationMessage({error:{message:'Richiesta non valida',validation_result:{'data.ei_data.payment_method':['Campo obbligatorio']}}}),/Campo obbligatorio/);
console.log('PASS creation strips source row IDs, preserves entity/VAT IDs, and exposes API validation details.');
