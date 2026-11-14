// Repair only Codex's nano-banana launch/model settings, preserving its existing key and all other config.
// Preview: node scripts/dev-test/configure-nano-banana.js
// Apply (writes the user's private Codex config; requires filesystem approval):
//   node scripts/dev-test/configure-nano-banana.js --write
const fs=require('fs'),path=require('path');
const config=path.join(process.env.USERPROFILE||require('os').homedir(),'.codex/config.toml');
const before=fs.readFileSync(config,'utf8'),newline=before.includes('\r\n')?'\r\n':'\n';
const updateSection=(text,name,values)=>{const nameEscaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const re=new RegExp('(^\\['+nameEscaped+'\\]\\r?\\n)([\\s\\S]*?)(?=^\\[|$(?![\\s\\S]))','m');if(!re.test(text))throw Error('Missing expected section: '+name);return text.replace(re,(_,heading,body)=>{for(const [key,value]of Object.entries(values)){const line=new RegExp('^'+key+'\\s*=.*$','m');if(line.test(body))body=body.replace(line,key+' = '+value);else body=body.replace(/\s*$/,'')+newline+key+' = '+value+newline+newline;}return heading+body;});};
let after=updateSection(before,'mcp_servers.nano-banana',{command:'"npx"',args:'["-y", "@seungmanchoi/nano-banana-mcp@1.2.1"]',startup_timeout_sec:'90',tool_timeout_sec:'240'});
after=updateSection(after,'mcp_servers.nano-banana.env',{GEMINI_MODEL:'"gemini-3.1-flash-image"'});
const keyLine=t=>t.match(/^GEMINI_API_KEY\s*=.*$/m)?.[0];if(!keyLine(before)||keyLine(before)!==keyLine(after))throw Error('Refusing to change the existing key');
console.log(JSON.stringify({target:config,package:'@seungmanchoi/nano-banana-mcp@1.2.1',model:'gemini-3.1-flash-image',startupTimeoutSeconds:90,toolTimeoutSeconds:240,key:'preserved, not displayed',changed:after!==before}));
if(process.argv.includes('--write')){if(after!==before){const backup=config+'.before-nano-banana-fix.bak';if(!fs.existsSync(backup))fs.copyFileSync(config,backup);fs.writeFileSync(config,after);}console.log('Codex nano-banana configuration updated. Private backup remains beside config.toml.');}
