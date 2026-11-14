# Dev-only: restart UI Atlas (npm run ui:atlas, :4400) and re-activate its previous non-bench frames on the same ports.
# Needed after editing tools/gameplay-bench or src (source drift / pinned adapter versions). Run: bash scripts/dev-test/restart-atlas.sh
cd "$(dirname "$0")/../.."
curl -s http://127.0.0.1:4400/__atlas/status > .ui-atlas/status-before-restart.json
pid=$(netstat -ano | grep LISTENING | grep "127.0.0.1:4400 " | awk '{print $NF}' | head -1)
[ -n "$pid" ] && taskkill //PID $pid //F >/dev/null
# The old process's live bench cases die with it: remove their zt-gb- rows.
node tools/gameplay-bench/live-db.cjs down-all
sleep 1; (nohup npm run ui:atlas > .ui-atlas/atlas-serve.log 2>&1 &)
for i in $(seq 1 60); do curl -s -o /dev/null http://127.0.0.1:4400/__atlas/status && break; sleep 2; done
node -e "
const before=require('./.ui-atlas/status-before-restart.json').frames.filter(f=>!f.caseId.startsWith('bench.'));
(async()=>{let moved=0;for(const f of before){const r=await fetch('http://127.0.0.1:4400/__atlas/activate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({caseId:f.caseId,dataset:f.dataset,theme:f.theme,clock:f.clock})});const j=await r.json();if(j.origin!==f.origin)moved++;}
const s=await (await fetch('http://127.0.0.1:4400/__atlas/status')).json();console.log('restored',before.length,'moved',moved,'drift',s.sourceChanged.length);})()"
