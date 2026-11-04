/* Deterministic story clock; advance only with foreground, unpaused play time. */
(function(root){
'use strict';
const MOM=['우리 딸~ 오늘도 화이팅!','잘할 수 있지?','오늘도 연습 열심히 해~ 엄마가 열심히 서포트할게!'];
const TEACHER=['뭐해?','연습안해?','혹시 그만둘 생각이니? 그럼 말해.','내가 지금 나 잘되자고 이러는 줄 알아?','빨리 연습해.','그러니까 네가 만년 꼴찌인거야.','그런 정신머리로 어떻게 예고 가려고?','너만 힘든 줄 알아?','그런 식으로 할거면 그냥 관둬라. 나도 너같은 애 가르치기 힘들어.'];
const FINAL=['선생님께 다 들었어.','예리야, 많이 힘들어? 그렇다고 해서 연습을 안하면 어떻게 하니?','지금 너를 위해 엄마가 얼마나 투자했는데, 어떻게 네가 엄마한테 이러니?','실망했다. 이런 식으로 할거면 하지 마. 너보다 힘든 애가 얼마나 많은데. 고작 이거 하나 못해?'];
const THOUGHTS=['하기 싫다.','그만하고 싶다.','지겨워.','만약에 내가 지금 기절하면 더이상 안 쳐도 되지 않을까?','언제까지 이렇게 살아야하지?','그만, 그만해.','아, 하지만 다들 이만큼 하는데.','엄마가 날 위해 이만큼 투자해줬는데, 난 왜 이 모양이지?','더이상 못견디겠어.','죽을 것 같아.','차라리 교통사고가 나서 병원에 한 달 정도 입원하면 쉴 수 있을텐데.'];
// 120 BPM: denser beats, then syncopation and short eighth-note bursts.
const RHYTHM={lookahead:1.65,hitWindow:.16,perfectWindow:.065};
function rhythmChart(){
 const redTimes=[10,20,30,40,50],notes=[];
 for(let base=0;base<60;base+=4){
  const offsets=base<20?[.5,1,1.5,2,2.5,3,3.5,4]:base<40?[.5,1,1.75,2,2.5,3,3.75,4]:[.5,.75,1,1.5,2,2.5,2.75,3,3.5,4];
  for(const offset of offsets){const at=base+offset;if(at<60&&!redTimes.some(red=>Math.abs(red-at)<.33))notes.push({at,red:false,state:'new'});}
 }
 for(const at of redTimes)notes.push({at,red:true,state:'new'});
 return notes.sort((a,b)=>a.at-b.at);
}
// Coordinates use the 384 × 288 room canvas; positions mark Yeri's feet.
const ROOM_OBJECTS=[
 {name:'camera',x:53,y:164}, {name:'clock',x:193,y:101},
 {name:'sofa',x:111,y:145}, {name:'headphones',x:104,y:211},
 {name:'door',x:80,y:247}, {name:'piano',x:268,y:162}
];
const ROOM_SOLIDS=[[28,92,81,63],[73,169,62,39],[278,91,76,103],[24,220,51,54],[329,202,25,48],[263,217,26,29]];
class RoomMovement{
 constructor(){this.x=222;this.y=214;}
 canStand(x,y){return x>=23&&x<=361&&y>=103&&y<=265&&!ROOM_SOLIDS.some(([sx,sy,w,h])=>x+7>sx&&x-7<sx+w&&y>sy&&y-5<sy+h);}
 move(dx,dy,dt){const length=Math.hypot(dx,dy);if(!length)return;const distance=76*Math.min(.1,Math.max(0,dt)),steps=Math.max(1,Math.ceil(distance/2));
  for(let i=0;i<steps;i++){const x=this.x+dx/length*distance/steps,y=this.y+dy/length*distance/steps;if(this.canStand(x,this.y))this.x=x;if(this.canStand(this.x,y))this.y=y;}
 }
 nearby(){return ROOM_OBJECTS.filter(o=>Math.hypot(this.x-o.x,this.y-o.y)<=38).sort((a,b)=>Math.hypot(this.x-a.x,this.y-a.y)-Math.hypot(this.x-b.x,this.y-b.y));}
}
class Story{
 constructor(emit=()=>{}){this.emit=emit;this.time=0;this.roomStart=null;this.view='phone';this.chat='mom';this.messages=[];this.messageIndex=0;this.nextMessage=1;this.ready=false;this.notificationAt=null;this.teacherRead=false;this.teacherMessages=[];this.nextTeacherAt=null;this.pressureAt=null;this.pressureLevel=0;this.resolved=false;this.distress=false;this.escaped=false;this.rhythmTime=0;this.strikes=0;this.score=0;this.notes=[];this.lastBeat=-1;this.nextThought=0;this.thoughtIndex=0;this.collapseAt=null;this.done=false;}
 event(type,data){this.emit({type,...data});}
 advance(dt){if(this.done)return;this.time+=dt;
  if(this.nextMessage!==null&&this.time>=this.nextMessage){const list=this.chat==='mom'?MOM:this.chat==='teacher'?TEACHER:FINAL;if(this.messageIndex<list.length){const text=list[this.messageIndex++];this.messages.push(text);this.event('message',{text});this.nextMessage=this.time+(this.chat==='final'?3.2:2.2);}else{this.nextMessage=null;this.ready=true;this.event('chatReady');if(this.chat==='final'){this.collapseAt=this.time+3;this.event('collapse');}}}
  if(this.roomStart!==null&&!this.resolved&&this.chat!=='final'){
   while(this.nextTeacherAt!==null&&this.time>=this.nextTeacherAt&&this.teacherMessages.length<TEACHER.length){const text=TEACHER[this.teacherMessages.length];this.teacherMessages.push(text);this.nextTeacherAt+=10;if(this.notificationAt===null||this.teacherRead)this.notificationAt=this.time;const visible=this.view==='phone'&&this.chat==='teacher';this.teacherRead=visible;if(this.chat==='teacher')this.messages=[...this.teacherMessages];this.event('teacherMessage',{text,visible});}if(this.teacherMessages.length===TEACHER.length)this.nextTeacherAt=null;
   if(this.notificationAt!==null&&!this.teacherRead&&this.pressureAt===null&&this.time-this.notificationAt>=30){this.pressureAt=this.time;this.event('knock',{text:'연습 안하고 뭐해!!!!'});}
   if(this.pressureAt!==null){const level=Math.floor((this.time-this.pressureAt)/10);if(level>this.pressureLevel||(level>=4&&this.time-this.roomStart>=100)){this.pressureLevel=level;if(level>=4&&this.time-this.roomStart>=100){this.openChat('final');this.event('notification');}else if(level<4)this.event('knock',{text:['','연습안하니?','미쳤구나?','아, 그만두려고? 선생님이 어머님께 연락드릴까?'][level]});}}
  }
  if(this.view==='piano'&&this.distress&&this.time>=this.nextThought){this.event('thought',{text:THOUGHTS[this.thoughtIndex++%THOUGHTS.length]});this.nextThought=this.time+2.6;}
  if(this.view==='rhythm')this.advanceRhythm(dt);
  if(this.collapseAt!==null&&this.time>=this.collapseAt){this.done=true;this.view='over';this.event('gameover');}
 }
 openChat(kind){this.view='phone';this.chat=kind;this.messageIndex=0;this.messages=[];this.ready=false;this.nextMessage=this.time+.7;this.event('chat',{kind});}
 answer(silent=false){if(this.chat!=='mom'||!this.ready||this.roomStart!==null)return false;if(!silent)this.event('reply',{text:'응. 열심히 할게.'});this.roomStart=this.time;this.nextTeacherAt=this.time+10;this.view='room';this.event('room');return true;}
 openPhone(){if(this.done||this.collapseAt!==null)return;if(this.teacherMessages.length&&this.chat!=='final'){this.teacherRead=true;this.view='phone';this.chat='teacher';this.messages=[...this.teacherMessages];this.nextMessage=null;this.ready=true;this.event('chat',{kind:'teacher',history:true});}else{this.view='phone';this.event('chat',{kind:this.chat,history:true});}}
 closePhone(){if(this.chat==='final'||this.roomStart===null)return;this.view='room';this.event('room');}
 sit(){if(this.done||this.chat==='final')return;this.view='piano';this.resolved=true;this.nextTeacherAt=null;this.distress=true;this.nextThought=this.time+.6;this.event('piano',{distress:this.distress});}
 stand(){if(this.view!=='piano')return;if(this.distress)this.escaped=true;this.view='room';this.event('room');}
 startRhythm(){if(!this.escaped||this.done)return;this.view='rhythm';this.rhythmTime=0;this.strikes=0;this.score=0;this.notes=rhythmChart();this.lastBeat=-1;this.event('rhythm');}
 advanceRhythm(dt){this.rhythmTime+=dt;const beat=Math.floor(this.rhythmTime/.5);if(beat!==this.lastBeat){this.lastBeat=beat;this.event('beat',{beat});}
 for(const n of this.notes)if(n.state==='new'&&this.rhythmTime>n.at+RHYTHM.hitWindow){n.state='miss';if(!n.red)this.event('judge',{text:'·',kind:'miss'});}
 if(this.rhythmTime>=60){this.done=true;this.view='ending';this.event('ending');}}
 hit(){if(this.view!=='rhythm'||this.done)return;const n=this.notes.filter(n=>n.state==='new'&&Math.abs(n.at-this.rhythmTime)<=RHYTHM.hitWindow).sort((a,b)=>Math.abs(a.at-this.rhythmTime)-Math.abs(b.at-this.rhythmTime))[0];if(!n){this.event('judge',{text:'·',kind:'miss'});return;}n.state='hit';if(n.red){this.strikes++;this.event('strike',{strikes:this.strikes});if(this.strikes>=5){this.view='collapse';this.collapseAt=this.time+3;this.event('collapse');}}else{this.score+=Math.abs(n.at-this.rhythmTime)<=RHYTHM.perfectWindow?1000:600;this.event('judge',{text:'♪',kind:'good'});}}
}
const api={RoomMovement,ROOM_OBJECTS,Story,MOM,TEACHER,FINAL,THOUGHTS,RHYTHM,rhythmChart};if(typeof module!=='undefined')module.exports=api;else root.PracticeStory=api;
})(globalThis);
