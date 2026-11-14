// Persistent gameplay-to-UI coverage, separate from a sampled compiler census.
// node scripts/gameplay-matrix.js build | check [--strict] | inspect <feature-id>
// node scripts/gameplay-matrix.js record --input <review.json>
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.ui-atlas'),M=require('../tools/gameplay-coverage/build.cjs');
const args=process.argv.slice(2),command=args[0]||'build',input=args.includes('--input')?args[args.indexOf('--input')+1]:null;
try{
  const report=M.buildReport({root});
  if(command==='record'){
    if(!input)throw Error('Use record --input <review.json>');const value=JSON.parse(fs.readFileSync(path.resolve(root,input),'utf8')),records=Array.isArray(value)?value:[value],ledgerFile=path.join(root,'tools/gameplay-coverage/reviews.json'),ledger=JSON.parse(fs.readFileSync(ledgerFile,'utf8'));
    for(const record of records){const issues=M.validateRecord(record,{root,features:report.features,sourceHash:report.sourceFingerprint,specimens:report.specimens});if(issues.length)throw Error((record.id||'Review')+': '+issues.join('; '));if(ledger.records.some(r=>r.id===record.id))throw Error('Review id already exists; append a new review instead of overwriting');record.artifacts=(record.artifacts||[]).map(a=>M.artifact(root,typeof a==='string'?a:a.path));if(record.fixture)record.fixture=M.artifact(root,typeof record.fixture==='string'?record.fixture:record.fixture.path);ledger.records.push(record);}
    fs.writeFileSync(ledgerFile,JSON.stringify(ledger,null,2)+'\n');const updated=M.buildReport({root,ledger});M.writeReport({root,out,report:updated});console.log(JSON.stringify({ok:true,recorded:records.length,summary:updated.summary}));
  }else if(command==='inspect'){
    const feature=report.features.find(f=>f.id===args[1]);if(!feature)throw Error('Unknown feature; use e.g. main:team or control:person');console.log(JSON.stringify({feature,sourceFingerprint:report.sourceFingerprint,requirements:Object.fromEntries(feature.surfaces.map(s=>[s,args.includes('--expand')?M.requirements(feature,s):{units:M.requirements(feature,s).length,gates:['render','interaction','design'],profiles:[...new Set(M.requirements(feature,s).map(u=>u.profileId))],viewports:report.viewports,themes:report.themes}])),profiles:report.profiles.filter(p=>!p.tags.length||p.tags.some(t=>feature.tags.includes(t))),examples:feature.examples.map(id=>report.specimens.find(s=>s.id===id))},null,2));
  }else if(command==='build'||command==='check'){
    M.writeReport({root,out,report});const bad=Object.values(report.integration).some(list=>list.length)||report.ledgerIssues.length,uiCoverageComplete=!bad&&report.summary.completeCells===report.summary.requiredCells,strict=args.includes('--strict');console.log(JSON.stringify({ok:!bad&&(!strict||uiCoverageComplete),sourceChecksPassed:!bad,uiCoverageComplete,strict,summary:report.summary,issues:{...report.integration,ledger:report.ledgerIssues},file:'.ui-atlas/gameplay-matrix.html',url:'http://127.0.0.1:4400/__atlas/gameplay'}));if(bad||(strict&&!uiCoverageComplete))process.exitCode=1;
  }else throw Error('Use build, check [--strict], inspect <feature-id>, or record --input <file>');
}catch(e){console.error(e.message);process.exitCode=1;}
