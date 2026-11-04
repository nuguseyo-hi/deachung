const {test}=require('node:test');const assert=require('node:assert/strict');
const {Story,MOM,TEACHER,FINAL,RHYTHM,rhythmChart}=require('../engine.js');
function advance(s,seconds){for(let i=0;i<seconds*20;i++)s.advance(.05)}
function setup(){const events=[];const s=new Story(e=>events.push(e));return {s,events}}
function room(s){advance(s,8);assert.equal(s.ready,true);s.answer(true)}
test('opening delivers mom messages in order and waits for a response',()=>{const {s,events}=setup();advance(s,.5);assert.equal(s.messages.length,0);assert.equal(s.answer(),false);advance(s,7.5);assert.deepEqual(s.messages,MOM);assert.equal(s.roomStart,null);assert.equal(s.answer(),true);assert.equal(s.view,'room');assert.equal(events.filter(e=>e.type==='reply').length,1)});
test('silence is a valid response and does not send a message',()=>{const {s,events}=setup();room(s);assert.equal(events.some(e=>e.type==='reply'),false);assert.equal(s.view,'room')});
test('teacher sends exactly the requested nine messages every ten seconds, even when read',()=>{const {s,events}=setup();room(s);advance(s,9.9);assert.equal(s.teacherMessages.length,0);advance(s,.2);assert.deepEqual(s.teacherMessages,[TEACHER[0]]);s.openPhone();assert.deepEqual(s.messages,[TEACHER[0]]);advance(s,10);assert.deepEqual(s.messages,TEACHER.slice(0,2));s.closePhone();advance(s,70);assert.deepEqual(s.teacherMessages,TEACHER);assert.deepEqual(events.filter(e=>e.type==='teacherMessage').map(e=>e.text),TEACHER);assert.equal(s.chat,'teacher');});
test('reading messages keeps history and prevents unread escalation until another message arrives',()=>{const {s,events}=setup();room(s);for(let i=0;i<9;i++){advance(s,10.1);s.openPhone();assert.deepEqual(s.messages,TEACHER.slice(0,i+1));s.closePhone();}advance(s,50);assert.equal(events.some(e=>e.type==='knock'),false);assert.deepEqual(s.teacherMessages,TEACHER);assert.equal(s.view,'room')});
test('ignored messages all arrive before the existing final sequence',()=>{const {s,events}=setup();room(s);advance(s,91);assert.deepEqual(s.teacherMessages,TEACHER);assert.notEqual(s.chat,'final');advance(s,10);assert.equal(s.chat,'final');assert.equal(s.view,'phone');assert.equal(events.filter(e=>e.type==='teacherMessage').length,9);s.closePhone();s.sit();assert.equal(s.view,'phone');advance(s,20);assert.deepEqual(s.messages,FINAL);assert.equal(s.view,'over');});
test('sitting at piano stops escalation; thoughts repeat and standing unlocks headphones',()=>{const {s,events}=setup();room(s);advance(s,70);s.sit();assert.equal(s.distress,true);advance(s,70);assert.equal(s.done,false);assert.equal(s.chat,'mom');assert.ok(events.filter(e=>e.type==='thought').length>20);s.stand();assert.equal(s.escaped,true);assert.equal(s.view,'room');const count=events.filter(e=>e.type==='thought').length;advance(s,10);assert.equal(events.filter(e=>e.type==='thought').length,count)});
test('piano interaction immediately stops teacher messages and allows headphone progression',()=>{const {s,events}=setup();room(s);s.sit();assert.equal(s.distress,true);assert.equal(s.resolved,true);advance(s,100);assert.equal(s.teacherMessages.length,0);assert.equal(events.some(e=>e.type==='teacherMessage'),false);s.stand();assert.equal(s.escaped,true);advance(s,30);assert.equal(s.teacherMessages.length,0)});
test('sitting after two messages stops later messages without erasing history',()=>{const {s}=setup();room(s);advance(s,21);s.sit();advance(s,100);assert.deepEqual(s.teacherMessages,TEACHER.slice(0,2));s.stand();s.openPhone();assert.deepEqual(s.messages,TEACHER.slice(0,2));});

function rhythm(){const {s,events}=setup();room(s);advance(s,31);s.sit();s.stand();s.startRhythm();return {s,events}}
test('five red notes arrive at 10 second intervals; avoiding them completes 60 seconds',()=>{const {s}=rhythm();advance(s,59);assert.equal(s.done,false);advance(s,1.1);assert.equal(s.view,'ending');assert.deepEqual(s.notes.filter(n=>n.red).map(n=>n.at),[10,20,30,40,50]);assert.equal(s.strikes,0)});
test('red hits count once each and the fifth causes blackout instead of success',()=>{const {s}=rhythm();for(const at of [10,20,30,40,50]){advance(s,at-s.rhythmTime);s.hit();s.hit();}assert.equal(s.strikes,5);assert.equal(s.view,'collapse');advance(s,3.1);assert.equal(s.view,'over')});
test('normal notes score, key repeat cannot rescore and out of range presses do not hit red',()=>{const {s}=rhythm();advance(s,.5);s.hit();assert.equal(s.score,1000);s.hit();assert.equal(s.score,1000);assert.equal(s.strikes,0)});

test('harder chart follows the beat, adds late bursts, and leaves room around red notes',()=>{const notes=rhythmChart(),normal=notes.filter(n=>!n.red);assert.ok(normal.length>110);assert.ok(normal.some(n=>n.at>40&&normal.some(m=>m.at===n.at+.25)));for(const red of notes.filter(n=>n.red))assert.ok(normal.every(n=>Math.abs(n.at-red.at)>RHYTHM.hitWindow*2));assert.ok(notes.every(n=>n.at>0&&n.at<60));assert.equal(new Set(notes.map(n=>n.at)).size,notes.length)});
test('tighter timing accepts Good hits but rejects inputs outside the new window',()=>{const {s}=rhythm();advance(s,.6);s.hit();assert.equal(s.score,600);advance(s,.2);s.hit();assert.equal(s.score,600);advance(s,.2);s.hit();assert.equal(s.score,1600)});
test('restarting rhythm restores the chart, score and five red notes',()=>{const {s}=rhythm();advance(s,.5);s.hit();s.startRhythm();assert.equal(s.rhythmTime,0);assert.equal(s.score,0);assert.deepEqual(s.notes,rhythmChart())});

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
