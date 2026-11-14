const fs=require('fs'),path=require('path'),crypto=require('crypto'),ts=require('typescript');
const slash=s=>s.split(path.sep).join('/');
function filesIn(dir){if(!fs.existsSync(dir))return [];return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()?filesIn(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function buildInventory(root){
 const sourceFiles=filesIn(path.join(root,'src')).filter(f=>/\.(tsx?|jsx?)$/.test(f)),candidates=sourceFiles.filter(f=>/\.(tsx|jsx)$/.test(f)&&!/[\\/]api[\\/]/.test(f));
 const fileSet=new Set(candidates.map(f=>path.resolve(f))),files=[],components=[],routes=[];
 function resolve(from,ref){const base=ref.startsWith('@/')?path.join(root,'src',ref.slice(2)):ref.startsWith('.')?path.resolve(path.dirname(from),ref):null;if(!base)return null;for(const x of [base,...['.tsx','.jsx','.ts','.js','/index.tsx','/index.ts'].map(e=>base+e)])if(fs.existsSync(x)&&fs.statSync(x).isFile())return slash(path.relative(root,x));return null;}
 for(const abs of candidates){
  const file=slash(path.relative(root,abs)),source=fs.readFileSync(abs,'utf8'),sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),imports=[],nodes=[];
  const line=n=>sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1;
  const clip=(n,max=180)=>n?.getText(sf).replace(/\s+/g,' ').slice(0,max)||'';
  function hasJsx(n){if(!n)return false;if(ts.isJsxElement(n)||ts.isJsxSelfClosingElement(n)||ts.isJsxFragment(n))return true;return ts.forEachChild(n,hasJsx)||false;}
  function find(n){
   if(ts.isImportDeclaration(n)&&ts.isStringLiteral(n.moduleSpecifier)){const ref=n.moduleSpecifier.text;imports.push({ref,file:resolve(abs,ref),names:n.importClause?clip(n.importClause):''});}
   if(ts.isFunctionDeclaration(n)&&n.body&&hasJsx(n.body)){const name=n.name?.text||'default';if(/^[A-Z]/.test(name)||name==='default')nodes.push({name,node:n,body:n.body,props:n.parameters.map(p=>clip(p,500)).join(', '),exported:n.modifiers?.some(m=>[ts.SyntaxKind.ExportKeyword,ts.SyntaxKind.DefaultKeyword].includes(m.kind))||false});}
   if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&/^[A-Z]/.test(n.name.text)&&n.initializer&&hasJsx(n.initializer))nodes.push({name:n.name.text,node:n,body:n.initializer,props:'',exported:n.parent?.parent?.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)||false});
   ts.forEachChild(n,find);
  }find(sf);
  for(const c of nodes){const markers=[],uses=new Set(),states=[],conditions=[];
   function visit(n){
    if(ts.isJsxAttribute(n)){const key=n.name.getText(sf);if(key.startsWith('data-')||['role','aria-label'].includes(key))markers.push({name:key,value:n.initializer&&ts.isStringLiteral(n.initializer)?n.initializer.text:null,expression:n.initializer&&!ts.isStringLiteral(n.initializer)?clip(n.initializer):null,line:line(n)});}
    if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){const name=n.tagName.getText(sf);if(/^[A-Z]/.test(name))uses.add(name);}
    if(ts.isVariableDeclaration(n)&&n.initializer&&ts.isCallExpression(n.initializer)&&/\buseState$/.test(n.initializer.expression.getText(sf)))states.push({name:clip(n.name),initial:clip(n.initializer.arguments[0]),line:line(n)});
    if(ts.isIfStatement(n)||ts.isConditionalExpression(n))conditions.push({expression:clip(ts.isIfStatement(n)?n.expression:n.condition),line:line(n)});
    if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken&&hasJsx(n.right))conditions.push({expression:clip(n.left),line:line(n)});
    ts.forEachChild(n,visit);
   }visit(c.body);
   components.push({id:file+'#'+c.name,file,name:c.name,line:line(c.node),exported:c.exported,props:c.props,uses:[...uses].sort(),markers,states,conditions:conditions.filter((v,i,a)=>a.findIndex(x=>x.expression===v.expression)===i),preview:'source-only'});
  }
  const short=path.basename(file).replace(/\.(tsx|jsx)$/,'');
  if(file.startsWith('src/app/')&&['page','layout','loading','error','not-found','default'].includes(short)){
   const segments=slash(path.relative(path.join(root,'src/app'),path.dirname(abs))).split('/').filter(s=>s&&s!=='.'&&!s.startsWith('(')&&!s.startsWith('@'));
   routes.push({id:file,file,kind:short,path:'/'+segments.join('/'),line:1});
  }
  files.push({file,hash:hash(source),mtimeMs:fs.statSync(abs).mtimeMs,imports,components:components.filter(c=>c.file===file).map(c=>c.id)});
 }
 const byFile=new Map(files.map(f=>[f.file,f]));
 function reachable(file){const seen=new Set(),queue=[file];while(queue.length){const f=queue.shift();if(seen.has(f))continue;seen.add(f);for(const i of byFile.get(f)?.imports||[])if(i.file&&byFile.has(i.file))queue.push(i.file);}return [...seen].sort();}
 for(const r of routes)r.reachableFiles=reachable(r.file);
 for(const c of components)c.routes=routes.filter(r=>r.kind==='page'&&r.reachableFiles.includes(c.file)).map(r=>r.path);
 const dependencies=sourceFiles.filter(f=>!fileSet.has(path.resolve(f))).map(f=>({file:slash(path.relative(root,f)),hash:hash(fs.readFileSync(f)),mtimeMs:fs.statSync(f).mtimeMs}));
 const fingerprint=hash([...files,...dependencies].sort((a,b)=>a.file.localeCompare(b.file)).map(f=>f.file+':'+f.hash).join('\n'));
 return {schemaVersion:1,fingerprint,counts:{files:files.length,components:components.length,routes:routes.filter(r=>r.kind==='page').length,markers:components.reduce((n,c)=>n+c.markers.length,0)},files,dependencies,components,routes,limits:['Static discovery identifies JSX component candidates and possible file-level reachability, not guaranteed runtime instances.','State conditions are source hints; valid recipes require explicit data adapters.','A source-only component is not a verified preview.']};
}
module.exports={buildInventory,filesIn,hash};
