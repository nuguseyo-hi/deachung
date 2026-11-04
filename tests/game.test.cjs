const {test}=require('node:test');const assert=require('node:assert/strict');
const {Story,MOM,TEACHER,FINAL,RHYTHM,rhythmChart}=require('../engine.js');
function advance(s,seconds){for(let i=0;i<seconds*20;i++)s.advance(.05)}
function setup(){const events=[];const s=new Story(e=>events.push(e));return {s,events}}
function room(s){advance(s,8);assert.equal(s.ready,true);s.answer(true)}
test('opening delivers mom messages in order and waits for a response',()=>{const {s,events}=setup();advance(s,.5);assert.equal(s.messages.length,0);assert.equal(s.answer(),false);advance(s,7.5);assert.deepEqual(s.messages,MOM);assert.equal(s.roomStart,null);assert.equal(s.answer(),true);assert.equal(s.view,'room');assert.equal(events.filter(e=>e.type==='reply').length,1)});
test('silence is a valid response and does not send a message',()=>{const {s,events}=setup();room(s);assert.equal(events.some(e=>e.type==='reply'),false);assert.equal(s.view,'room')});
test('teacher notification arrives after 30 seconds in room, then an unread deadline of 30 seconds',()=>{const {s,events}=setup();room(s);advance(s,29);assert.equal(s.notificationAt,null);advance(s,1.2);assert.notEqual(s.notificationAt,null);assert.equal(s.pressureAt,null);advance(s,29);assert.equal(s.pressureAt,null);advance(s,1.2);assert.notEqual(s.pressureAt,null);assert.equal(events.filter(e=>e.type==='knock')[0].text,'연습 안하고 뭐해!!!!')});
test('reading teacher messages before deadline prevents unread escalation',()=>{const {s,events}=setup();room(s);advance(s,31);s.openPhone();advance(s,6);assert.deepEqual(s.messages,TEACHER);s.closePhone();advance(s,65);assert.equal(events.some(e=>e.type==='knock'),false);assert.equal(s.view,'room')});
test('ignored phone escalates at 10, 20, 30, 40 seconds and ends after final messages',()=>{const {s,events}=setup();room(s);advance(s,101);assert.equal(s.chat,'final');assert.equal(s.view,'phone');assert.deepEqual(events.filter(e=>e.type==='knock').map(e=>e.text),['연습 안하고 뭐해!!!!','연습 안하니?','미쳤구나?','아, 그만두려고? 선생님이 어머님께 연락드릴까?']);s.closePhone();s.sit();assert.equal(s.view,'phone');advance(s,20);assert.deepEqual(s.messages,FINAL);assert.equal(s.view,'over');assert.equal(s.done,true)});
test('sitting at piano stops escalation; thoughts repeat and standing unlocks headphones',()=>{const {s,events}=setup();room(s);advance(s,70);s.sit();assert.equal(s.distress,true);advance(s,70);assert.equal(s.done,false);assert.equal(s.chat,'mom');assert.ok(events.filter(e=>e.type==='thought').length>20);s.stand();assert.equal(s.escaped,true);assert.equal(s.view,'room');const count=events.filter(e=>e.type==='thought').length;advance(s,10);assert.equal(events.filter(e=>e.type==='thought').length,count)});
test('already seated piano becomes distressed when teacher notification arrives',()=>{const {s}=setup();room(s);s.sit();assert.equal(s.distress,false);advance(s,31);assert.equal(s.distress,true);assert.equal(s.resolved,true)});
function rhythm(){const {s,events}=setup();room(s);advance(s,31);s.sit();s.stand();s.startRhythm();return {s,events}}
test('waiting sixty seconds alone cannot reach the exit; chart has five safe red intervals',()=>{const {s}=rhythm();const red=s.notes.filter(n=>n.red).map(n=>n.at);advance(s,60.1);assert.equal(s.view,'danceRetry');assert.equal(s.done,false);assert.equal(s.danceProgress,0);assert.deepEqual(red,[10,20,30,40,50]);});
test('red hits count once each and the fifth causes blackout instead of success',()=>{const {s}=rhythm();for(const at of [10,20,30,40,50]){advance(s,at-s.rhythmTime);s.hit();s.hit();}assert.equal(s.strikes,5);assert.equal(s.view,'collapse');advance(s,3.1);assert.equal(s.view,'over')});
test('normal notes score, key repeat cannot rescore and out of range presses do not hit red',()=>{const {s}=rhythm();advance(s,.5);s.hit();assert.equal(s.score,1000);s.hit();assert.equal(s.score,1000);assert.equal(s.strikes,0)});

test('harder chart follows the beat, adds late bursts, and leaves room around red notes',()=>{const notes=rhythmChart(),normal=notes.filter(n=>!n.red);assert.ok(normal.length>110);assert.ok(normal.some(n=>n.at>40&&normal.some(m=>m.at===n.at+.25)));for(const red of notes.filter(n=>n.red))assert.ok(normal.every(n=>Math.abs(n.at-red.at)>RHYTHM.hitWindow*2));assert.ok(notes.every(n=>n.at>0&&n.at<60));assert.equal(new Set(notes.map(n=>n.at)).size,notes.length)});
test('tighter timing accepts Good hits but rejects inputs outside the new window',()=>{const {s}=rhythm();advance(s,.6);s.hit();assert.equal(s.score,600);advance(s,.2);s.hit();assert.equal(s.score,600);advance(s,.2);s.hit();assert.equal(s.score,1600)});
test('repeated start requests cannot reset an active dance',()=>{const {s}=rhythm();advance(s,.5);s.hit();assert.equal(s.startRhythm(),false);assert.ok(s.rhythmTime>.49);assert.equal(s.score,1000);assert.equal(s.danceHits,1)});
const {RoomMovement,ROOM_OBJECTS}=require('../engine.js');
test('room movement is normalized, bounded and blocked by furniture',()=>{
 const straight=new RoomMovement(),diagonal=new RoomMovement();straight.move(1,0,.1);diagonal.move(1,1,.1);
 assert.ok(Math.abs(Math.hypot(diagonal.x-222,diagonal.y-214)-(straight.x-222))<1e-8);
 const w=new RoomMovement();w.x=260;w.y=150;for(let i=0;i<100;i++)w.move(1,0,.1);assert.ok(w.x<=271);
 w.x=193;w.y=120;for(let i=0;i<100;i++)w.move(0,-1,.1);assert.ok(w.y>=103);
 for(let i=0;i<100;i++)w.move(-1,1,.1);assert.ok(w.canStand(w.x,w.y));
});
test('proximity requires approaching, and every object is reachable from spawn',()=>{
 const w=new RoomMovement();assert.equal(w.nearby().length,0);
 const queue=[[222,214]],seen=new Set(['222,214']),reachable=new Set();
 for(let i=0;i<queue.length;i++){const [x,y]=queue[i];w.x=x;w.y=y;for(const o of w.nearby())reachable.add(o.name);
  for(const [dx,dy] of [[2,0],[-2,0],[0,2],[0,-2]]){const nx=x+dx,ny=y+dy,key=`${nx},${ny}`;if(!seen.has(key)&&w.canStand(nx,ny)){seen.add(key);queue.push([nx,ny]);}}
 }
 assert.deepEqual([...reachable].sort(),ROOM_OBJECTS.map(o=>o.name).sort());
 w.x=268;w.y=162;assert.equal(w.nearby()[0].name,'piano');w.x=222;w.y=214;assert.equal(w.nearby().some(o=>o.name==='piano'),false);
});

const {dancePosition,DANCE_PATH,ESCAPE_LINES}=require('../engine.js');
function completeDance(s){for(const n of [...s.notes]){advance(s,Math.max(0,n.at-s.rhythmTime));if(!n.red)s.hit();}advance(s,60.1-s.rhythmTime);}
test('successful notes move along a fully walkable route, misses do not move',()=>{const {s}=rhythm();advance(s,.5);s.hit();assert.equal(s.danceProgress,1/RHYTHM.requiredHits);const progress=s.danceProgress;advance(s,.3);s.hit();assert.equal(s.danceProgress,progress);const w=new RoomMovement();for(let i=0;i<=1000;i++){const p=dancePosition(i/1000);assert.ok(w.canStand(p.x,p.y),JSON.stringify(p));}assert.deepEqual(dancePosition(0),{x:DANCE_PATH[0][0],y:DANCE_PATH[0][1]});assert.deepEqual(dancePosition(1),{x:83,y:247});});
test('forty-eight hits reach the door, but escape choices wait for the full sixty seconds',()=>{const {s}=rhythm();for(const n of [...s.notes].filter(n=>!n.red).slice(0,48)){advance(s,Math.max(0,n.at-s.rhythmTime));s.hit();}assert.equal(s.danceProgress,1);assert.equal(s.view,'rhythm');assert.equal(s.escapeAvailable,false);advance(s,60.1-s.rhythmTime);assert.equal(s.view,'escapeChoice');assert.equal(s.escapeAvailable,true);assert.equal(s.notes.length,0);});
test('open door plays corridor lines in order, then escape ending; cannot open before success',()=>{const {s,events}=rhythm();assert.equal(s.chooseEscape(true),false);completeDance(s);assert.equal(s.chooseEscape(true),true);assert.equal(s.view,'escaping');advance(s,14.1);assert.deepEqual(events.filter(e=>e.type==='escapeLine').map(e=>e.text),ESCAPE_LINES);assert.equal(s.view,'ending');assert.equal(s.done,true);});
test('returning to piano allows another headphone dance with reset scores and mistakes',()=>{const {s}=rhythm();completeDance(s);s.chooseEscape(false);assert.equal(s.view,'returning');advance(s,3.1);assert.equal(s.view,'room');assert.equal(s.escaped,true);assert.equal(s.danceProgress,0);assert.equal(s.prepareDance(),true);assert.equal(s.view,'player');s.startRhythm();assert.equal(s.strikes,0);assert.equal(s.rhythmTime,0);assert.equal(s.danceProgress,0);assert.equal(s.escapeAvailable,false);});
test('dance blocks surveillance and ordinary phone events; a fresh story resets every run',()=>{const {s,events}=rhythm();const start=events.length;advance(s,59);s.openPhone();s.sit();assert.equal(s.view,'rhythm');assert.equal(events.slice(start).some(e=>['notification','knock','chat'].includes(e.type)),false);const fresh=new Story();assert.equal(fresh.view,'phone');assert.equal(fresh.roomStart,null);assert.equal(fresh.notificationAt,null);assert.equal(fresh.pressureAt,null);assert.equal(fresh.danceProgress,0);assert.equal(fresh.escapeAvailable,false);assert.equal(fresh.strikes,0);});
test('insufficient progress offers retry and restarting the dance is fully possible',()=>{const {s}=rhythm();advance(s,60.1);assert.equal(s.view,'danceRetry');s.retryDance();assert.equal(s.view,'player');s.startRhythm();completeDance(s);assert.equal(s.view,'escapeChoice');});
