// Verify the configured Nano Banana stdio MCP without printing credentials or image base64.
//   node scripts/dev-test/check-nano-banana.js [--generate] [--models] [--package=<candidate>] [--model=<id>]
//   node scripts/dev-test/check-nano-banana.js --jobs=captures/<study>/asset-jobs.json
// --jobs runs explicit generate_image/edit_image/continue_editing jobs and saves image bytes to workspace paths.
// Reads Codex's nano-banana entry and private env; does not change client configuration.
// --generate makes one provider call and stores any returned image in ignored captures/nano-banana-check/.
// Requires MCP SDK already available in node_modules. Package startup may need network access.
const fs=require('fs'),path=require('path');
const {Client}=require('@modelcontextprotocol/sdk/client/index.js');
const {StdioClientTransport}=require('@modelcontextprotocol/sdk/client/stdio.js');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'captures/nano-banana-check');
const arg=k=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3);
const configPath=path.join(process.env.USERPROFILE||require('os').homedir(),'.codex/config.toml');
const toml=fs.readFileSync(configPath,'utf8');
const section=name=>toml.match(new RegExp('^\\['+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\]\\s*([\\s\\S]*?)(?=^\\[|$(?![\\s\\S]))','m'))?.[1]||'';
const value=(section,key)=>{const raw=section.match(new RegExp('^\\s*'+key+'\\s*=\\s*("(?:[^"\\\\]|\\\\.)*"|\'[^\']*\'|\\[[\\s\\S]*?\\])','m'))?.[1];return raw?.startsWith("'")?raw.slice(1,-1):raw?JSON.parse(raw):undefined;};
const entry=section('mcp_servers.nano-banana'),privateEnv=section('mcp_servers.nano-banana.env');
const cfg={command:value(entry,'command'),args:value(entry,'args')||[],env:{}};
if(!cfg.command)throw Error('Codex nano-banana command is not configured');
const env={...process.env};
for(const line of privateEnv.split(/\r?\n/)){const name=line.match(/^\s*([A-Za-z_][\w]*)\s*=/)?.[1];if(name)env[name]=value(privateEnv,name);}
if(arg('package')){cfg.command='npx';cfg.args=['-y',arg('package')];}
const key=env.GEMINI_API_KEY;
if(!key||key==='YOUR_GEMINI_API_KEY_HERE')throw Error('GEMINI_API_KEY is not configured');
env.GEMINI_API_KEY=key;
const redact=s=>String(s).split(key).join('[REDACTED]').replace(/AIza[\w-]{20,}/g,'[REDACTED]');
const client=new Client({name:'gys-nano-banana-diagnostic',version:'1.0.0'});
const transport=new StdioClientTransport({command:cfg.command,args:cfg.args,env,cwd:root,stderr:'pipe',maxBufferSize:32*1024*1024});
let diagnostics='';transport.stderr?.on('data',d=>{diagnostics+=d.toString();if(diagnostics.length>16000)diagnostics=diagnostics.slice(-16000);});
const report={checkedAt:new Date().toISOString(),client:'Codex',command:cfg.command,args:cfg.args};
(async()=>{fs.mkdirSync(out,{recursive:true});try{
 if(process.argv.includes('--models')){const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models',{headers:{'x-goog-api-key':key},signal:AbortSignal.timeout(20000)});const body=await res.json();if(!res.ok)throw Error('Model discovery: '+redact(JSON.stringify(body)));report.imageModels=(body.models||[]).filter(m=>/image/i.test(m.name)).map(m=>({name:m.name,methods:m.supportedGenerationMethods}));console.log(JSON.stringify({imageModels:report.imageModels}));}
 await client.connect(transport,{timeout:90000});report.server=client.getServerVersion();
 const {tools}=await client.listTools();report.tools=tools.map(t=>({name:t.name,inputSchema:t.inputSchema}));
 console.log('MCP connected: '+JSON.stringify(report.server));console.log('Tools: '+tools.map(t=>t.name).join(', '));
 if(tools.some(t=>t.name==='get_configuration_status')){const r=await client.callTool({name:'get_configuration_status',arguments:{}},undefined,{timeout:15000});report.configuration=r.content?.filter(c=>c.type==='text').map(c=>redact(c.text));console.log(JSON.stringify({configuration:report.configuration}));}
 if(tools.some(t=>t.name==='get_status')){const r=await client.callTool({name:'get_status',arguments:{}},undefined,{timeout:15000});report.configuration=r.content?.filter(c=>c.type==='text').map(c=>redact(c.text).replace(/key:\s*[^,)\r\n]+/gi,'key: [REDACTED]'));console.log(JSON.stringify({configuration:report.configuration}));}
 if(arg('jobs')){const jobs=JSON.parse(fs.readFileSync(path.resolve(root,arg('jobs')),'utf8'));report.assets=[];for(const job of jobs){if(!['generate_image','edit_image','continue_editing'].includes(job.tool))throw Error('Unsupported asset job');const dest=path.resolve(root,job.saveAs);const relative=path.relative(root,dest);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Asset output must stay in the workspace');console.log('Nano Banana asset: '+relative);const r=await client.callTool({name:job.tool,arguments:job.arguments},undefined,{timeout:240000});const picture=r.content?.find(c=>c.type==='image');if(r.isError||!picture)throw Error('Asset generation failed: '+r.content?.filter(c=>c.type==='text').map(c=>redact(c.text)).join('\n'));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,Buffer.from(picture.data,'base64'));report.assets.push({tool:job.tool,path:relative,mimeType:picture.mimeType,prompt:job.arguments.prompt});console.log(JSON.stringify({saved:relative,mimeType:picture.mimeType}));fs.writeFileSync(path.join(out,'asset-report.json'),JSON.stringify(report,null,2));}}
 if(process.argv.includes('--generate')){console.log('Starting one image-generation smoke check');const input={prompt:'Create a simple square test image: a single yellow circle centered on a dark purple background. No letters or numbers. Flat colors.'};if(arg('model'))input.model=arg('model');const r=await client.callTool({name:'generate_image',arguments:input},undefined,{timeout:180000});report.generated=[];for(const c of r.content||[]){if(c.type==='image'){const dest=path.join(out,'connection-test.'+(c.mimeType==='image/jpeg'?'jpg':'png'));fs.writeFileSync(dest,Buffer.from(c.data,'base64'));report.generated.push(path.relative(root,dest));}}report.generationText=r.content?.filter(c=>c.type==='text').map(c=>redact(c.text));if(r.isError||!report.generated.length)throw Error('Generation did not return an image. '+report.generationText?.join('\n'));console.log(JSON.stringify({generated:report.generated}));}
 report.ok=true;
}catch(e){report.ok=false;report.error=redact(e.message);console.error(report.error);if(diagnostics)report.serverDiagnostics=redact(diagnostics);process.exitCode=1;
}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await client.close().catch(()=>{});if(!report.ok&&report.serverDiagnostics)console.error(report.serverDiagnostics.slice(-3500));}})();
