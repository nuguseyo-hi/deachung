'use strict';
const $=id=>document.getElementById(id);
let story,paused=false,lastFrame=0,shoutUntil=0,judgeUntil=0,replyUntil=0,clockUntil=0,phoneOffUntil=0,ac,master,music,enabled=false,pianoAudio=[];
let knockBuffer,knockLoading,knockSource,knockGeneration=0;
let songBuffer,songLoading,songSource,songStartedAt=0,songGeneration=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;$('reduce').checked=reduced;document.body.classList.toggle('reduced',reduced);
$('reduce').onchange=()=>document.body.classList.toggle('reduced',$('reduce').checked);
function unlock(){if(!ac){ac=new AudioContext();master=ac.createGain();master.gain.value=.32;master.connect(ac.destination);music=ac.createGain();music.gain.value=.6;music.connect(master);loadKnock().catch(()=>{});}if(enabled)ac.resume().catch(()=>{});}
function enableSound(){enabled=true;unlock();if(master)master.gain.value=.32;$('sound').textContent='소리 끄기';$('sound').ariaLabel='소리 끄기';$('sound').ariaPressed='true';$('audio-hint').hidden=true;}
document.addEventListener('pointerdown',e=>{if(!ac&&e.target!==$('sound'))enableSound()},{once:true});document.addEventListener('keydown',e=>{if(!ac&&e.target!==$('sound'))enableSound()},{once:true});
$('sound').onclick=()=>{if(!enabled){enableSound();notify()}else{enabled=false;stopKnock();if(master)master.gain.value=0;$('sound').textContent='소리 켜기';$('sound').ariaPressed='false';$('sound').ariaLabel='소리 켜기';}};
function tone(freq,duration=.25,type='sine',gain=.2,delay=0,bus=null){if(!enabled||!ac)return;const at=ac.currentTime+delay,o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(freq,at);g.gain.setValueAtTime(.001,at);g.gain.exponentialRampToValueAtTime(Math.max(.002,gain),at+.012);g.gain.exponentialRampToValueAtTime(.001,at+duration);o.connect(g);g.connect(bus||master);o.start(at);o.stop(at+duration+.02);}
function noise(duration,gain,delay=0,low=250){if(!enabled||!ac)return;const buffer=ac.createBuffer(1,ac.sampleRate*duration,ac.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/(data.length*.16));const source=ac.createBufferSource(),filter=ac.createBiquadFilter(),g=ac.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=low;g.gain.value=gain;source.connect(filter);filter.connect(g);g.connect(master);source.start(ac.currentTime+delay);}
function notify(){tone(740,.12,'sine',.28);tone(988,.24,'sine',.22,.14);}
async function loadKnock(){
 if(knockBuffer)return knockBuffer;
 if(!knockLoading)knockLoading=fetch('assets/door-knock.mp3').then(response=>{if(!response.ok)throw Error('Knock audio unavailable');return response.arrayBuffer()}).then(bytes=>ac.decodeAudioData(bytes)).then(buffer=>knockBuffer=buffer).catch(error=>{knockLoading=null;throw error});
 return knockLoading;
}
function stopKnock(){knockGeneration++;if(knockSource){knockSource.stop();knockSource=null;}}
async function knock(){
 if(!enabled||!ac||paused)return;
 stopKnock();const generation=knockGeneration;
 try{const buffer=await loadKnock();if(generation!==knockGeneration||!enabled||paused)return;
  const source=ac.createBufferSource();source.buffer=buffer;source.connect(master);knockSource=source;source.onended=()=>{source.disconnect();if(knockSource===source)knockSource=null;};source.start();
 }catch{if(generation!==knockGeneration||!enabled||paused)return;for(let i=0;i<3;i++){noise(.32,.95,i*.28,210);tone(76,.22,'sine',.28,i*.28);}}
}
async function loadSong(){
 if(songBuffer)return songBuffer;
 if(!songLoading)songLoading=fetch('assets/the-finish-line-televisions.mp3').then(response=>{if(!response.ok)throw Error('Music unavailable');return response.arrayBuffer()}).then(bytes=>ac.decodeAudioData(bytes)).then(buffer=>{if(buffer.duration<60)throw Error('Music is too short');return songBuffer=buffer;}).catch(error=>{songLoading=null;throw error});
 return songLoading;
}
function stopSong(){songGeneration++;if(songSource){songSource.stop();songSource.disconnect();songSource=null;}}
async function startSong(){
 if(story.view!=='player'||$('start-rhythm').disabled)return;
 unlock();const generation=++songGeneration;
 $('start-rhythm').disabled=true;$('start-rhythm').textContent='음악 불러오는 중…';$('music-status').textContent='';
 try{const buffer=await loadSong();if(generation!==songGeneration||story.view!=='player')return;
  if(!paused)await ac.resume();if(generation!==songGeneration||story.view!=='player')return;
  music.gain.cancelScheduledValues(ac.currentTime);music.gain.value=.6;
  const source=ac.createBufferSource();source.buffer=buffer;source.connect(music);songSource=source;songStartedAt=ac.currentTime;source.start(songStartedAt,0,60);story.startRhythm();
 }catch{if(generation===songGeneration)$('music-status').textContent='음악을 불러오지 못했어요. 재생을 눌러 다시 시도해 주세요.';}
 finally{if(generation===songGeneration){$('start-rhythm').disabled=false;$('start-rhythm').textContent='▶ 재생';}}
}
function latch(){noise(.13,.65,0,2100);noise(.17,.6,.19,1400);tone(165,.07,'triangle',.16,.03);}
function tick(){noise(.035,.23,0,4000);tone(1500,.025,'sine',.04);}
function pianoNote(index){tone(261.63*Math.pow(2,index/12),1.4,'triangle',.3);tone(523.26*Math.pow(2,index/12),.7,'sine',.08);}
function makeMessage(text,reply=false){const el=document.createElement('div');el.className='message'+(reply?' reply':'');el.textContent=text;$('messages').append(el);$('messages').scrollTop=$('messages').scrollHeight;}
function hideDialog(){ $('dialog').hidden=true;clockUntil=0; }
let dialogReturn=null;
function dialog(text,choices=[['확인',hideDialog]]){dialogReturn=document.activeElement;$('dialog-text').textContent=text;$('dialog-actions').replaceChildren();for(const [label,action] of choices){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{hideDialog();action();if(story.view==='room'&&dialogReturn?.isConnected)dialogReturn.focus()};$('dialog-actions').append(b)}$('dialog').hidden=false;$('dialog-actions').querySelector('button').focus();}
function showChat(kind,history=false){phoneOffUntil=0;$('phone-layer').classList.remove('powering-off');hideDialog();$('room').hidden=story.roomStart===null;$('piano').hidden=true;$('phone-layer').hidden=false;$('conversation').hidden=false;$('player').hidden=true;$('phone-toggle').hidden=true;$('messages').replaceChildren();$('compose').hidden=true;$('replies').hidden=!(kind==='mom'&&story.ready&&story.roomStart===null);$('typing').hidden=story.ready;$('close-phone').hidden=kind==='final'||story.roomStart===null;$('sender').textContent=kind==='teacher'?'선생님':'엄마';$('avatar').textContent=kind==='teacher'?'선':'엄';$('contact-sub').textContent=kind==='final'?'메시지':'메시지';if(history){for(const text of story.messages)makeMessage(text);if(kind==='mom'&&story.roomStart!==null&&story.sentReply)makeMessage('응. 열심히 할게.',true);} $('badge').hidden=true;if(kind==='final'){$('shout').hidden=true;$('dialog').hidden=true;}$('messages').scrollTop=$('messages').scrollHeight;}
function showRoom(){hideDialog();$('room').hidden=false;$('piano').hidden=true;$('piano').classList.remove('distressed');if(!$('phone-layer').hidden){$('phone-layer').classList.add('powering-off');phoneOffUntil=story.time+.55;}else $('phone-layer').hidden=true;$('phone-toggle').hidden=false;$('thoughts').replaceChildren();$('badge').hidden=story.notificationAt===null||story.teacherRead||story.resolved;drawMap();}
function event(e){switch(e.type){case 'message':makeMessage(e.text);notify();break;case 'chat':showChat(e.kind,e.history);if(e.kind==='final')notify();break;case 'chatReady':$('typing').hidden=true;if(story.chat==='mom'&&story.roomStart===null){$('replies').hidden=false;$('agree').focus()}break;case 'notification':$('badge').hidden=false;notify();break;case 'room':showRoom();if(story.roomStart!==null)$('phone-toggle').focus();break;case 'reply':makeMessage(e.text,true);break;case 'piano':hideDialog();$('room').hidden=true;$('phone-layer').hidden=true;$('piano').hidden=false;$('piano').classList.toggle('distressed',e.distress);$('badge').hidden=story.resolved||story.teacherRead;$('phone-toggle').hidden=false;$('shout').hidden=true;$('stand').focus();break;case 'thought':{const el=document.createElement('div');el.className='thought';el.textContent=e.text;const i=story.thoughtIndex;el.style.top=(12+(i*19)%62)+'%';el.style.left=(3+(i*13)%25)+'%';el.dataset.expires=story.time+11;$('thoughts').append(el);break;}case 'knock':hideDialog();knock();$('shout').hidden=false;$('shout').textContent=e.text;shoutUntil=story.time+5;break;case 'collapse':hideDialog();$('shout').hidden=true;$('fade').classList.add('collapsing');if(music)music.gain.setTargetAtTime(.001,ac.currentTime,.4);break;case 'gameover':stopSong();$('phone-layer').hidden=true;$('phone-toggle').hidden=true;$('gameover').hidden=false;$('restart').focus();break;case 'rhythm':$('start-rhythm').hidden=true;$('leave-player').disabled=true;$('rhythm-lane').focus();break;case 'beat':break;case 'judge':$('rhythm-judge').textContent=e.text;judgeUntil=story.time+.5;break;case 'strike':knock();notify();if(music)music.gain.setTargetAtTime(Math.max(.035,.6-e.strikes*.11),ac.currentTime,.4);$('rhythm-judge').textContent='!';judgeUntil=story.time+.8;break;case 'ending':stopSong();$('ending').hidden=false;$('phone-toggle').hidden=true;$('phone-layer').hidden=true;$('again').focus();tone(523,.6,'sine',.16);tone(659,.8,'sine',.12,.15);tone(784,1,'sine',.1,.3);break;}}
function reset(){stopSong();stopKnock();story=new PracticeStory.Story(event);window.story=story;paused=false;shoutUntil=judgeUntil=replyUntil=clockUntil=phoneOffUntil=0;$('gameover').hidden=$('ending').hidden=$('pause-screen').hidden=$('room').hidden=$('piano').hidden=$('phone-toggle').hidden=$('shout').hidden=true;$('fade').className='fade';$('thoughts').replaceChildren();$('draft').value='';$('unsent').textContent='';$('start-rhythm').hidden=false;$('start-rhythm').disabled=false;$('start-rhythm').textContent='▶ 재생';$('music-status').textContent='';$('leave-player').disabled=false;hideDialog();if(music)music.gain.value=.6;if(master)master.gain.value=enabled?.32:0;showChat('mom');lastFrame=performance.now();}
$('agree').onclick=()=>{if(!story.ready||replyUntil)return;story.sentReply=true;makeMessage('응. 열심히 할게.',true);$('replies').hidden=true;$('compose').hidden=true;replyUntil=story.time+1;};
$('silent').onclick=()=>story.answer(true);
$('custom').onclick=()=>{$('replies').hidden=true;$('compose').hidden=false;$('draft').focus()};
$('compose-back').onclick=()=>{$('compose').hidden=true;$('replies').hidden=false;$('custom').focus()};
$('compose').onsubmit=e=>{e.preventDefault();if(!$('draft').value.trim()){$('unsent').textContent='커서만 조용히 깜빡인다.';return;}$('unsent').textContent='전송되지 않았다. 손가락이 보내기 버튼 위에서 멈췄다.';tone(180,.08,'sine',.06);};
$('close-phone').onclick=()=>story.closePhone();$('phone-toggle').onclick=()=>{if(story.view==='piano')story.stand();story.openPhone()};$('stand').onclick=()=>story.stand();
function object(name){if(story.view!=='room'||story.done)return;switch(name){case 'camera':dialog('선생님이 지금도 보고계실까...?');break;case 'sofa':dialog('잠깐 앉아도 될까. 피아노에서 너무 멀리 떨어진 것 같다.');break;case 'headphones':if(!story.escaped)dialog('핸드폰에 연결하면 노래를 들을 수 있다.');else dialog('...스마트폰에 연결해서 지겨운 클래식말고 다른 노래를 들어볼까?',[['yes',openPlayer],['no',()=>{}]]);break;case 'door':latch();dialog('언제나처럼 열리지 않는다...');break;case 'clock':tick();clockUntil=story.time+5;dialog(`연습실에 온지 ${Math.floor(story.time/60*30)}분 지났다...`);clockUntil=story.time+5;break;case 'piano':story.sit();break;}}
for(const b of document.querySelectorAll('[data-object]'))b.onclick=()=>object(b.dataset.object);
function openPlayer(){unlock();loadSong().catch(()=>{});phoneOffUntil=0;$('phone-layer').classList.remove('powering-off');hideDialog();$('phone-layer').hidden=false;$('phone-toggle').hidden=true;$('conversation').hidden=true;$('player').hidden=false;$('start-rhythm').hidden=false;$('leave-player').disabled=false;story.view='player';$('notes').replaceChildren();$('rhythm-judge').textContent='';$('rhythm-time').textContent='00:00 / 01:00';$('rhythm-score').textContent='0';$('strikes').textContent='○ ○ ○ ○ ○';$('music-progress').style.width='0';$('start-rhythm').focus();}
$('leave-player').onclick=()=>{if(story.view==='player'){stopSong();$('start-rhythm').disabled=false;$('start-rhythm').textContent='▶ 재생';story.view='room';showRoom()}};
$('start-rhythm').onclick=startSong;
$('rhythm-lane').onpointerdown=e=>{e.preventDefault();story.hit()};
const keymap=['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK'];const semitones=[0,2,4,5,7,9,11,12];
for(let i=0;i<8;i++){const b=document.createElement('button');b.className='key';b.ariaLabel=['도','레','미','파','솔','라','시','높은 도'][i];b.onpointerdown=()=>pianoNote(semitones[i]);$('keys').append(b);}
for(const [i,n] of [[0,1],[1,3],[3,6],[4,8],[5,10]]){const b=document.createElement('button');b.className='key black';b.style.left=(4+(i+1)*11.5-3.25)+'%';b.ariaLabel='검은 건반';b.onpointerdown=()=>pianoNote(n);$('keys').append(b);}
function togglePause(force){if(story.done)return;paused=force??!paused;$('pause-screen').hidden=!paused;if(ac){if(paused)ac.suspend().catch(()=>{});else if(enabled||songSource)ac.resume().catch(()=>{});}if(paused)$('resume').focus();else if(story.view==='rhythm')$('rhythm-lane').focus();lastFrame=performance.now();}
$('resume').onclick=()=>togglePause(false);document.addEventListener('visibilitychange',()=>{if(document.hidden)togglePause(true)});window.addEventListener('blur',()=>togglePause(true));
document.addEventListener('keydown',e=>{if(e.code==='Tab'&&!$('dialog').hidden){const buttons=[...$('dialog-actions').querySelectorAll('button')],first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}return;}const typing=['INPUT','TEXTAREA'].includes(e.target.tagName);if(typing)return;if(e.code==='KeyP'&&!e.repeat){e.preventDefault();togglePause();return;}if(paused)return;if(!$('dialog').hidden&&e.code!=='Escape')return;if(e.code==='Escape'){if(!$('dialog').hidden)hideDialog();else if(story.view==='piano')story.stand();else if(story.view==='phone')story.closePhone();return;}if(story.view==='rhythm'&&(e.code==='Space'||(e.code==='Enter'&&e.target===$('rhythm-lane')))){e.preventDefault();if(!e.repeat)story.hit();}if(story.view==='piano'&&keymap.includes(e.code)&&!e.repeat){pianoNote(semitones[keymap.indexOf(e.code)]);const key=$('keys').children[keymap.indexOf(e.code)];key.classList.add('pressed');pianoAudio.push(key);}});
document.addEventListener('keyup',()=>{for(const k of pianoAudio)k.classList.remove('pressed');pianoAudio=[];});
$('restart').onclick=$('again').onclick=reset;
// Small-resolution, hand-built pixel scenery: all objects have matching semantic hit targets.
const ctx=$('map').getContext('2d');function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.floor(x),Math.floor(y),w,h)}
const C={outline:'#3c334e',wall:'#b5bca0',floor:'#797387',light:'#d9d5b5',wood:'#aa7c65',shadow:'#5c526c',blue:'#7d9db1'};
function outline(x,y,w,h,fill,border=3){rect(x,y,w,h,C.outline);rect(x+border,y+border,w-border*2,h-border*2,fill)}
function drawMap(){ctx.imageSmoothingEnabled=false;rect(0,0,384,288,'#24212c');outline(7,6,370,276,'#716a7d',4);rect(15,14,354,80,C.wall);rect(15,94,354,180,C.floor);rect(15,92,354,5,C.outline);rect(15,97,354,3,'#9b91a0');for(let y=106;y<273;y+=17){rect(16,y,352,1,'#716b7d');for(let x=30+(y%3)*13;x<360;x+=60)rect(x,y-16,1,16,'#746d80');}
// Left window: quiet blue afternoon, horizontal blinds.
outline(85,22,72,60,'#7696ad');rect(91,28,60,47,'#657d9f');for(let y=30;y<73;y+=8){rect(91,y,60,2,'#c3ccbe');}rect(86,80,74,4,C.shadow);rect(111,57,21,17,'#526784');rect(133,48,13,26,'#506581');rect(97,66,12,8,'#425771');
// Clearly visible upper-left camera, mount and lens.
rect(25,25,6,18,C.outline);rect(28,35,12,5,C.outline);outline(36,28,26,15,'#d0c5ad',2);rect(60,31,7,10,C.outline);rect(62,33,3,6,'#777e8a');rect(40,32,6,6,'#677b79');rect(49,32,3,3,story?.notificationAt!==null&&!story?.resolved?'#c08176':'#a6b283');
// Clock fixed above the centre of the room.
outline(178,24,30,30,'#b7886d',3);outline(182,28,22,22,'#e0d2b1',2);rect(192,31,2,11,C.outline);rect(192,40,7,2,C.outline);rect(186,32,2,2,'#a29182');rect(199,43,2,2,'#a29182');
// Acoustic wall tiles and framed study.
for(let x=231;x<348;x+=21){outline(x,28,15,32,'#9ba48f',1);for(let y=33;y<57;y+=5)rect(x+4,y,7,1,'#858f83');}outline(235,66,27,30,'#d5c8ad',2);rect(242,73,13,2,'#8f7d77');rect(242,79,13,1,'#8f7d77');rect(242,84,10,1,'#8f7d77');
// Sofa on the left wall.
rect(29,145,85,14,'#61546b');outline(30,92,77,54,'#77949e');outline(37,96,63,20,'#91a8aa',2);outline(38,117,28,23,'#869faa',2);outline(68,117,28,23,'#869faa',2);outline(28,106,12,40,'#677e8e',2);outline(97,106,12,40,'#677e8e',2);rect(35,146,6,7,C.outline);rect(96,146,6,7,C.outline);rect(45,101,16,10,'#b4bbaa');rect(48,102,10,2,'#d1d2b9');
// Worn rug and wooden coffee table, headphones on top.
outline(45,164,113,70,'#a36f60',2);rect(50,169,103,60,'#b47f64');rect(55,174,93,1,'#d6b283');rect(55,223,93,1,'#d6b283');for(let x=57;x<147;x+=11)rect(x,180,3,3,'#bb8c69');rect(76,201,64,8,'#5e4c5e');outline(73,169,62,30,C.wood,3);rect(78,173,51,3,'#c59a7a');rect(80,198,4,10,C.outline);rect(126,198,4,10,C.outline);
// Pixel headphone arch, two ear cups, loose cable.
rect(91,175,20,3,'#332f47');rect(88,178,4,12,'#332f47');rect(110,178,4,12,'#332f47');rect(88,177,6,3,'#d0b08a');outline(86,183,8,10,'#7f92a0',2);outline(108,183,8,10,'#7f92a0',2);rect(114,192,9,1,C.outline);rect(122,192,1,4,C.outline);
// Upright piano prominent against right wall, visible white and black keys.
rect(272,176,82,13,'#61536b');outline(282,91,68,66,'#9d705e',3);rect(288,97,56,28,'#b78b6b');outline(301,102,29,20,'#ddd3b7',2);for(let y=107;y<118;y+=3)rect(306,y,18,1,'#9c9385');rect(287,127,58,5,'#5d4050');outline(278,132,76,19,'#e0d7b9',3);for(let x=283;x<351;x+=5)rect(x,135,1,12,'#7c6c6e');for(let i=0;i<13;i++)if(i%7!==2&&i%7!==6)rect(285+i*5,135,3,7,'#332a3d');rect(283,151,8,29,C.outline);rect(340,151,8,29,C.outline);rect(291,151,49,4,'#76534e');outline(291,172,44,13,'#866976',2);rect(295,184,4,10,C.outline);rect(327,184,4,10,C.outline);
// Closed lower-left door, heavy frame and brass handle.
outline(24,220,51,52,'#655068',4);rect(31,225,37,42,'#987461');outline(35,229,28,30,'#a4816a',2);rect(59,244,5,3,'#dbbd80');rect(28,269,44,4,'#3b334a');rect(19,220,4,54,'#b6ad9d');
// Plant, bag and stool: small details soften the institutional room.
outline(329,229,23,21,'#ae8b69',2);rect(333,225,15,5,'#66536a');rect(339,202,3,24,'#6d806c');for(const [x,y] of [[330,209],[344,204],[333,218],[346,214]]){rect(x,y,8,5,'#8e9d76');rect(x+2,y-2,5,3,'#a8b08c');}outline(263,222,26,24,'#7b91a0',2);rect(268,217,15,5,C.outline);rect(273,226,3,13,'#c8baa3');rect(279,229,3,3,'#b4c1b0');
// Yeri, facing the piano; a little shadow anchors her in the room.
rect(209,205,23,4,'#665b74');rect(214,174,14,12,'#473849');rect(216,179,11,9,'#d2ad8d');rect(213,188,17,16,'#d3c8ab');rect(214,203,6,10,'#455267');rect(224,203,6,10,'#455267');rect(212,211,9,3,C.outline);rect(224,211,9,3,C.outline);rect(229,189,4,12,'#c69f85');rect(214,174,14,5,'#483846');rect(224,182,2,2,C.outline);
// Warm ceiling trim and subtle floor border.
rect(15,14,354,3,'#d4d0b0');rect(15,271,354,3,C.outline);}
let lastTick=-1;
function renderRhythm(){const time=story.rhythmTime;$('rhythm-time').textContent=`00:${String(Math.min(60,Math.floor(time))).padStart(2,'0')} / 01:00`;$('rhythm-score').textContent=String(story.score);$('strikes').textContent=Array.from({length:5},(_,i)=>i<story.strikes?'●':'○').join(' ');$('strikes').ariaLabel=`방해 음표 오입력 ${story.strikes}회`;$('music-progress').style.width=Math.min(100,time/60*100)+'%';const height=$('rhythm-lane').clientHeight,hit=height*.82;$('notes').replaceChildren();for(const n of story.notes){if(n.state!=='new'||n.at-time>PracticeStory.RHYTHM.lookahead||time-n.at>PracticeStory.RHYTHM.hitWindow)continue;const el=document.createElement('div');el.className='note'+(n.red?' red':'');el.style.top=(hit-(n.at-time)*hit/PracticeStory.RHYTHM.lookahead-6)+'px';$('notes').append(el);}}
function frame(now){const dt=Math.min(.1,Math.max(0,(now-lastFrame)/1000));lastFrame=now;if(!paused){const elapsed=story.view==='rhythm'&&songSource?Math.max(0,ac.currentTime-songStartedAt-story.rhythmTime):dt;story.advance(elapsed);if(phoneOffUntil&&story.time>=phoneOffUntil){phoneOffUntil=0;$('phone-layer').hidden=true;$('phone-layer').classList.remove('powering-off');}if(replyUntil&&story.time>=replyUntil){replyUntil=0;story.answer(true);}if(shoutUntil&&story.time>shoutUntil){$('shout').hidden=true;shoutUntil=0;}if(judgeUntil&&story.time>judgeUntil){$('rhythm-judge').textContent='';judgeUntil=0;}for(const el of $('thoughts').children)if(Number(el.dataset.expires)<story.time)el.remove();if(clockUntil>story.time&&Math.floor(story.time)!==lastTick){tick();lastTick=Math.floor(story.time);}if(story.view==='rhythm')renderRhythm();if(story.view==='room')drawMap();}requestAnimationFrame(frame);}
reset();requestAnimationFrame(frame);
