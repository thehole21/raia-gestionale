const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const root=process.env.RAIA_PROJECT||path.resolve(__dirname,'..');
const ts=require(path.join(root,'node_modules/typescript'));
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {bookPrice,baseBookUnit,IVORY,COVER_COATED,COVER_MARKED}=require(path.join(root,'lib/book-pricing.ts'));
const {emptySpec}=require(path.join(root,'lib/portal.ts'));
const fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'book-price-fixtures.json'),'utf8')).fixtures;
const specs=[];
for(const f of fixtures){
 const spec={...emptySpec,title:'Confronto Excel '+f.cell,pages:f.pages,colorPages:f.colorPages,format:f.format,
 paper:f.paperKey==='avorio80'?IVORY:'Uso mano',paperWeight:Number(f.paperKey.replace('usomano',''))||80,
 cover:f.coverKey==='patinata'?COVER_COATED:COVER_MARKED,flaps:f.flaps,print:f.colorPages?'Bianco e nero con inserti a colori':'Bianco e nero'};
 assert.ok(Math.abs(baseBookUnit(spec)-f.unit)<1e-10,JSON.stringify(f)+' actual '+baseBookUnit(spec));
 assert.ok(bookPrice(spec).price,JSON.stringify(bookPrice(spec).errors));
 specs.push({spec,expected:bookPrice(spec).price,excelUnit:f.unit});
}
for(const [copies,discount] of [[1,0],[19,0],[20,0],[49,0],[50,3],[99,3],[100,5],[199,5],[200,8],[299,8],[300,12],[499,12],[500,18],[100000,18]]){
 const spec={...emptySpec,title:'Soglia '+copies,copies,shipments:2},price=bookPrice(spec).price;
 assert.equal(price.items[0].discountPercent,discount);assert.equal(price.shippingNet,10);
 assert.equal(price.minimumFee,copies<20?30:0);specs.push({spec,expected:price});
}
for(const colorPages of [0,8]){const spec={...emptySpec,title:'Campione',copies:1,orderKind:'sample',shipments:1,colorPages,print:colorPages?'Bianco e nero con inserti a colori':'Bianco e nero'},price=bookPrice(spec).price;assert.equal(price.totalNet,colorPages?50:35);specs.push({spec,expected:price});}
const mixed={...emptySpec,title:'Titolo A',orderKind:'mixed',copies:10,shipments:1,additionalBooks:[{...emptySpec,title:'Titolo B',copies:10}]};
assert.equal(bookPrice(mixed).price.minimumFee,50);assert.equal(bookPrice(mixed).price.items[0].discountPercent,0);specs.push({spec:mixed,expected:bookPrice(mixed).price});
for(const patch of [{pages:0},{pages:5001},{copies:1.5},{colorPages:113},{paper:IVORY,paperWeight:100},{format:'A5'},{cover:'Rigida'},{shipments:-1},{orderKind:'sample',copies:2},{orderKind:'mixed'}])assert.equal(bookPrice({...emptySpec,...patch}).price,null);
console.log('PASS: '+fixtures.length+' Excel formulas, discount boundaries, samples, mixed titles, shipments and invalid inputs.');
if(process.env.RAIA_PARITY_OUT)fs.writeFileSync(process.env.RAIA_PARITY_OUT,JSON.stringify(specs));
