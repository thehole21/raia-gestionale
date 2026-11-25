const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {reconcilePayments,applyPaymentTerms}=require('../lib/fic-payments.ts');
const doc={type:'invoice',date:'2026-11-25',payments_list:[{amount:0,status:'not_paid',due_date:'2026-12-25'}]};
assert.equal(reconcilePayments(doc,122).payments_list[0].amount,122);assert.equal(doc.payments_list[0].amount,0);
const split={...doc,payments_list:[{amount:50,status:'paid'},{amount:10,status:'not_paid',due_date:'2026-12-25'}]};const result=reconcilePayments(split,122);assert.equal(result.payments_list[0].amount,50);assert.equal(result.payments_list[1].amount,72);assert.equal(result.payments_list[1].due_date,'2026-12-25');
assert.equal(reconcilePayments({...doc,payments_list:[]},122).payments_list[0].amount,122);
assert.throws(()=>reconcilePayments({...doc,payments_list:[{amount:50,status:'paid'}]},122));assert.throws(()=>reconcilePayments(split,40));assert.throws(()=>reconcilePayments(doc,undefined));
assert.equal(reconcilePayments({...doc,type:'quote'},undefined).type,'quote');
assert.equal(reconcilePayments(doc,10.01).payments_list[0].amount,10.01);
console.log('PASS invoice payment reconciliation, split deadlines, paid amount preservation, rounding and invalid totals.');

const term={type:'invoice',date:'2026-11-25',payments_list:[{amount:122,status:'not_paid',payment_terms:{days:60,type:'standard'}}]};
assert.equal(applyPaymentTerms(term).payments_list[0].due_date,'2027-01-24');
const manual={...term,payments_list:[{...term.payments_list[0],due_date:'2027-02-01'}]};assert.equal(applyPaymentTerms(manual).payments_list[0].due_date,'2027-02-01');
assert.equal(applyPaymentTerms({...manual,date:'2026-11-26'},manual).payments_list[0].due_date,'2027-01-25');
console.log('PASS payment terms calculate dates across years and preserve manual deadlines.');
