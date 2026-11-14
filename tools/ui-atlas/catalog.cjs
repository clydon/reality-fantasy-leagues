// Durable case recipes. Data setup and review expectations live beside source, not in a one-off gallery.
const surfaces=[
 ['hub','Main hub','/home','src/new/screens/home.tsx','Find a show, relevant work and your people.','[data-hub]'],
 ['tonight','Tonight','/show/{seasonId}/tonight','src/new/show/tonight.tsx','Understand your episode and act without hunting through detail.','[data-tab="tonight"]'],
 ['episodes','Past episodes','/show/{seasonId}/episodes','src/new/show/episodes.tsx','Find watched, next and hidden episodes.','[data-tab="episodes"]'],
 ['games','Games overview','/show/{seasonId}/games','src/new/show/games.tsx','Find a game and its necessary quick action.','[data-tab="games"]'],
 ['cast','Players / Cast','/show/{seasonId}/cast','src/new/show/cast.tsx','Browse show facts and drill into a participant.','[data-cast]'],
 ['chat','Episode chat','/show/{seasonId}/chat','src/new/show/chat.tsx','Understand the conversation boundary and take part.','[data-chat]'],
 ['game','Generated game','/show/{seasonId}/game/{gameId}','src/new/show/game-page.tsx','Make a decision or inspect graphs, history and permitted picks.','[data-game-page]'],
 ['scoring','Scoring / rulebook','/show/{seasonId}/scoring','src/new/show/how-it-works.tsx','Understand a moment, its value and its counted contribution.','[data-scoring]'],
 ['draft','Snake draft','/show/{seasonId}/draft','src/new/show/draft.tsx','Know whose turn it is and make an eligible choice.','[data-draft]'],
 ['blind','Blind draft','/show/{seasonId}/blind','src/new/show/draft.tsx','Choose a private team and understand when it becomes visible.','[data-draft="blind"]'],
 ['settings','Account and preferences','/settings','src/new/settings/settings.tsx','Control identity, appearance, viewing and notifications.','[data-settings-quick]'],
 ['welcome','Welcome','/welcome','src/new/welcome/landing.tsx','Understand the product and enter.','main'],
 ['signin','Sign in','/signin','src/new/welcome/sign-in.tsx','Access an account and recover from problems.','form'],
 ['wizard','Create a game','/show/{seasonId}/games','src/new/couch/start-game.tsx','Understand and configure play, preview, and return without losing choices.','[data-start-card]'],
 ['watch','Watch along','/show/{seasonId}/tonight?page=watch&ep=6','src/new/show/watch-along.tsx','Keep a companion clock and return to your viewing position.','[data-watch-along]'],
];
const profiles={
 'reveal-ready':{title:'Watched episode 3 / results hidden',dimensions:{participation:'multiplayer',pace:'own',couch:'group',shows:'one',stage:'reveal-ready'},seen:3,kind:'derived'},
 live:{title:'Playing live · multiple games',dimensions:{participation:'multiplayer',pace:'airing',couch:'group',shows:'one',stage:'active'},kind:'recorded'},
 'no-couch':{title:'No couch · no shows',dimensions:{participation:'watcher',pace:'none',couch:'none',shows:'none',stage:'empty'},kind:'derived'},
 'empty-couch':{title:'Empty couch · no shows',dimensions:{participation:'watcher',pace:'none',couch:'empty',shows:'none',stage:'empty'},kind:'derived'},
 'one-show':{title:'One show · no game',dimensions:{participation:'watcher',pace:'airing',couch:'group',shows:'one',stage:'watching'},kind:'derived'},
 'multiple-shows':{title:'Multiple shows · mixed watching',dimensions:{participation:'mixed',pace:'airing',couch:'group',shows:'multiple',stage:'active'},kind:'derived'},
 watcher:{title:'Watching only · behind',dimensions:{participation:'watcher',pace:'own',couch:'group',shows:'one',stage:'watching'},seen:3,kind:'derived'},
 catchup:{title:'Multiplayer · catch-up',dimensions:{participation:'multiplayer',pace:'own',couch:'group',shows:'one',stage:'catchup'},seen:3,kind:'derived'},
 solo:{title:'Solo · own pace',dimensions:{participation:'solo',pace:'own',couch:'none',shows:'one',stage:'catchup'},seen:3,kind:'derived'},
 'caught-up':{title:'Caught up · still airing',dimensions:{participation:'watcher',pace:'airing',couch:'group',shows:'one',stage:'caught-up'},kind:'derived'},
 error:{title:'Read failure and recovery',dimensions:{stage:'error'},kind:'fault'},
 loading:{title:'Slow reads / loading',dimensions:{stage:'loading'},kind:'fault'},
 saved:{title:'All decisions saved',dimensions:{participation:'multiplayer',stage:'saved'},kind:'derived'},
 locked:{title:'Airing now / locked',dimensions:{participation:'multiplayer',stage:'locked'},kind:'derived'},
 waiting:{title:'Aired / waiting for results',dimensions:{participation:'multiplayer',stage:'waiting'},kind:'derived'},
 early:{title:'Early results ready to reveal',dimensions:{participation:'multiplayer',stage:'early'},seen:5,kind:'derived'},
 finished:{title:'Finished recorded episode span',dimensions:{participation:'multiplayer',stage:'finished'},kind:'derived'},
 drafting:{title:'Before draft · fixture',dimensions:{participation:'multiplayer',pace:'airing',couch:'group',shows:'one',stage:'drafting'},kind:'recorded',dataset:'draft'},
};
function registry(){const cases=[];for(const [id,title,route,file,intent,ready]of surfaces){const variants=id==='hub'?['live','no-couch','empty-couch','one-show','multiple-shows','error','loading']:['tonight','episodes','games','cast','chat'].includes(id)?(id==='tonight'?['live','watcher','catchup','reveal-ready','solo','caught-up','saved','locked','waiting','early','finished','error','loading']:['live','watcher','catchup','solo','caught-up','error','loading']):['draft','blind'].includes(id)?['drafting']:['welcome','signin'].includes(id)?['live']:['live'];for(const profile of variants){const p=profiles[profile];cases.push({id:id+'.'+profile,surface:id,title:title+' / '+p.title,route,file,intent,ready,profile,dataset:p.dataset||'recorded',dataKind:p.kind,dimensions:p.dimensions,action:id==='wizard'?{selector:'[data-start-row="start"]'}:null,expectations:{intent:[intent,'Can the user return from detail without losing context?'],impeccable:['Does real content remain readable and expressive at the selected viewport?','Do artwork, controls and hierarchy work together?'],pfd:['What registers first: situation, action or unrelated detail?','Are necessary actions visible without a discovery gesture?']}});}}
 for(const [story,variants]of [['buttons',['default','disabled']],['chips',['default','selected']],['empty-state',['default','error']],['guard',['default','empty','off']],['stepper',['default','empty']],['rows',['default','due']],['sheet',['default','open']],['show-bar',['default','tall']],['face',['default','missing','out']]])for(const state of variants)cases.push({id:'kit.'+story+'.'+state,surface:'kit',title:story+' / '+state,route:'/show/{seasonId}/atlas-kit?story='+story+'&state='+state,file:'src/new/dev/atlas-stories.tsx',intent:'Inspect a real shared UI component in isolation.',ready:'[data-atlas-kit]',profile:'live',dataset:'recorded',dataKind:'component-story',dimensions:{story,state},expectations:{intent:['Is the action and its state understandable?'],impeccable:['Inspect sizing, contrast and interaction states.'],pfd:['Does this signal have the same meaning across contexts?']}});
 return {schemaVersion:1,stateCoverage:{'no game':['one-show','watcher'],'empty couch':['empty-couch'],'one show':['one-show'],'multiple shows':['multiple-shows'],drafting:['drafting'],catchup:['catchup'],saved:['saved'],locked:['locked'],waiting:['waiting'],'early results':['early'],'final results':['live'],finished:['finished'],error:['error'],loading:['loading']},surfaces:surfaces.map(([id,title,route,file,intent,ready])=>({id,title,route,file,intent,ready})),profiles,cases,mocks:[{id:'tonight-study',title:'Tonight · six-situation study',surface:'tonight',url:'http://127.0.0.1:4303/__study/tonight.html?scenario={scenario}',alignment:'independent-fixtures',note:'Existing study uses its own scenario data. Compare composition; this is not an identical-data claim.'}],requiredStates:['no game','empty couch','one show','multiple shows','drafting','catchup','saved','locked','waiting','early results','final results','finished','error','loading']};
}
module.exports={registry,profiles};
