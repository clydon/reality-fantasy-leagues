// Promote the study's generated backdrops without regenerating or changing any image bytes.
// node scripts/dev-test/save-fidelity-assets.js
// Refuses conflicting destination bytes; saves prompts/provenance beside versioned public assets.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),source=path.join(root,'captures/fidelity-2026-11-10/asset-provenance.json');
const original=JSON.parse(fs.readFileSync(source,'utf8')),destDir=path.join(root,'public/art/generated');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(destDir,{recursive:true});const assets=[];
for(const asset of original.generated){const stem=path.basename(asset.file,'.png'),name=stem+'-v1.png';const bytes=fs.readFileSync(path.resolve(root,asset.file));if(sha(bytes)!==asset.sha256)throw Error('Source hash mismatch: '+stem);const dest=path.join(destDir,name);if(fs.existsSync(dest)&&sha(fs.readFileSync(dest))!==asset.sha256)throw Error('Existing version has different bytes: '+name);if(!fs.existsSync(dest))fs.writeFileSync(dest,bytes);assets.push({...asset,file:'public/art/generated/'+name,url:'/art/generated/'+name,sourceStudy:'fidelity-2026-11-10',reviewStatus:'candidate; reuse bytes when selected',bytes:bytes.length});}
fs.writeFileSync(path.join(destDir,'manifest.json'),JSON.stringify({schemaVersion:1,generatedAt:original.generatedAt,policy:'Reuse these versioned files. Generate a new version only for an intentional requested visual change; never regenerate just to implement an approved study.',assets},null,2)+'\n');
for(const file of ['overlay.js','sports.html']){const p=path.join(root,'captures/fidelity-2026-11-10',file);let text=fs.readFileSync(p,'utf8');text=text.replaceAll('/__study/assets/island-night.png','/art/generated/island-night-v1.png');text=text.replace("/__study/assets/${generic?'event':'football'}-night.png","/art/generated/${generic?'event':'football'}-night-v1.png");fs.writeFileSync(p,text);}
console.log(JSON.stringify({saved:assets.map(a=>({file:a.file,bytes:a.bytes,sha256:a.sha256})),unchangedBytes:true}));
