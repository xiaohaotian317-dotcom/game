import {audioPreferences,audioGains} from './audio-preferences.mjs';
export class Sound {
  constructor({scene='hall'}={}){this.prefs=audioPreferences();this.ctx=null;this.noise=null;this.scene=scene;this.unlocked=false;this.prefs.subscribe(()=>this.applyLevels());if(typeof document!=='undefined'){const unlock=()=>{this.unlocked=true;this.init();};document.addEventListener('pointerdown',unlock,{once:true});document.addEventListener('keydown',unlock,{once:true});document.addEventListener('visibilitychange',()=>this.updateMusic());window.addEventListener('pagehide',()=>this.music?.pause());}}
  get enabled(){return this.prefs.value.enabled;}
  set enabled(value){this.prefs.update({enabled:!!value});}
  setScene(scene){if(this.scene!==scene){this.scene=scene;this.music?.pause();this.musicNode?.disconnect();this.music=null;this.musicNode=null;}this.updateMusic();}
  applyLevels(){if(this.ctx){const gain=audioGains(this.prefs.value),t=this.ctx.currentTime;this.master?.gain.setTargetAtTime(gain.master,t,.07);this.bus?.gain.setTargetAtTime(gain.effects,t,.07);this.musicBus?.gain.setTargetAtTime(gain.music,t,.15);}this.updateMusic();}
  updateMusic(){if(typeof document==='undefined'||!this.unlocked||!this.ctx)return;const p=this.prefs.value;if(document.hidden||!p.enabled||!p.musicEnabled||p.volume===0||p.musicVolume===0){this.music?.pause();return;}if(!this.music){const file=this.scene==='battle'?'realm-battle.wav':this.scene==='journey'?'realm-journey.wav':'moonlit-hall.wav';this.music=new Audio(new URL('../assets/music/'+file,import.meta.url));this.music.loop=true;this.music.preload='auto';this.musicNode=this.ctx.createMediaElementSource(this.music);this.musicNode.connect(this.musicBus);}this.music.play().catch(()=>{});}

  init(){try{const A=window.AudioContext||window.webkitAudioContext;if(!A)return;this.ctx ||= new A();this.unlocked=true;this.ctx.resume();if(!this.bus){const compressor=this.ctx.createDynamicsCompressor();compressor.threshold.value=-16;compressor.ratio.value=5;this.bus=this.ctx.createGain();this.musicBus=this.ctx.createGain();this.master=this.ctx.createGain();this.bus.connect(compressor);this.musicBus.connect(compressor);compressor.connect(this.master);this.master.connect(this.ctx.destination);this.applyLevels();}if(!this.noise){this.noise=this.ctx.createBuffer(1,this.ctx.sampleRate*2,this.ctx.sampleRate);const d=this.noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}this.updateMusic();}catch{}}
  tone(freq,end,duration=.15,volume=.04,type='sine',delay=0){
    const c=this.ctx;if(!c||!this.enabled||!this.prefs.value.effectsEnabled)return;const t=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(15,end),t+duration);g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(volume,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(this.bus);o.start(t);o.stop(t+duration+.03);
  }
  rustle(freq=600,duration=.2,vol=.055,delay=0,type='bandpass'){
    const c=this.ctx;if(!c||!this.noise||!this.enabled||!this.prefs.value.effectsEnabled)return;const t=c.currentTime+delay,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=this.noise;f.type=type;f.frequency.setValueAtTime(freq,t);f.frequency.exponentialRampToValueAtTime(Math.max(70,freq*.22),t+duration);f.Q.value=.7;g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(vol,t+.012);g.gain.exponentialRampToValueAtTime(.001,t+duration);s.connect(f);f.connect(g);g.connect(this.bus);s.start(t);s.stop(t+duration);
  }
  event(e){
    if(e.type==='enemyAttack'&&e.enemyStyle){
      const style=e.enemyStyle;
      if(['lava','rock','stone','bone'].includes(style)){this.tone(e.heavy?65:130,28,.45,e.heavy?.075:.045,'triangle');this.rustle(style==='lava'?700:1900,.4,.055,0,style==='lava'?'lowpass':'bandpass');if(style==='stone')this.tone(470,290,.6,.025,'sine',.04);}
      else if(['ice','star','lightning'].includes(style)){this.tone(style==='ice'?1650:720,style==='lightning'?70:400,.35,.035,'sine');this.rustle(style==='lightning'?4200:3200,.25,.045);}
      else if(style==='venom'){this.tone(190,85,.25,.035,'sine');this.rustle(1000,.32,.05,0,'lowpass');}
      else if(style==='sonic'){this.tone(540,170,.45,.04,'sawtooth');this.rustle(1600,.25,.04);}
      else{this.rustle(style==='web'?2800:1700,.25,.045);this.tone(180,60,.22,.03,'triangle');}
      return;
    }
    const school=e.school||e.hero;
    if(['frost','lightning','shadow','star'].includes(school)&&['attack','hit'].includes(e.type)){
      if(school==='frost'){this.tone(1600,800,.19,.025,'sine');this.rustle(4800,.13,.035);}
      if(school==='lightning'){if(e.type==='hit'){this.rustle(2600,.11,.07);this.tone(100,28,.16,.055,'triangle');this.tone(1600,900,.055,.018,'square');}else{this.rustle(4200,.09,.035);this.tone(220,85,.08,.028,'triangle');}}
      if(school==='shadow'){this.rustle(3100,.12,.045);this.tone(330,90,.14,.025,'triangle');}
      if(school==='star'){this.tone(520,260,.28,.035);this.tone(780,390,.3,.016,'sine',.04);}return;
    }
    if(['frostSkill','iceShatter','iceReflect'].includes(e.type)){this.tone(1200,220,.48,.04);this.tone(1800,800,.35,.018,'sine',.04);this.rustle(4800,.22,.05);return;}
    if(['thunderSkill','thunderImpact','chargedHit'].includes(e.type)){this.rustle(3200,.27,.08);this.tone(e.type==='thunderImpact'?65:220,30,.5,.07,'triangle');return;}
    if(['shadowSkill','shadowReturn'].includes(e.type)){this.rustle(2400,.26,.055);this.tone(240,60,.3,.04,'triangle');return;}
    if(['starSkill','starRepulse','starCollapse','portalTravel'].includes(e.type)){this.tone(160,45,.65,.065);this.tone(660,880,.4,.019,'sine',.08);this.rustle(1200,.4,.035);return;}
    if(e.type==='jump')this.tone(e.double?540:330,180,.16,.023,'sine');
    else if(e.type==='attack'){if(e.hero==='fire'){this.rustle(1500,.28,.10);this.tone(150,55,.18,.025,'triangle');}else{this.rustle(2800,.19,.045);this.tone(700,280,.2,.025,'triangle');}}
    else if(e.type==='hit'){this.tone(e.heavy?100:170,45,.14,.055,'triangle');this.rustle(e.fire?900:1900,.18,.07);}
    else if(['explode','break','bridge'].includes(e.type)){
      this.tone(e.heavy?65:100,22,e.heavy?1.1:.45,e.heavy?.17:.10);this.rustle(520,e.heavy?1.25:.5,e.heavy?.19:.10,0,'lowpass');this.rustle(2100,.15,.08);if(e.heavy){this.rustle(1100,.6,.06,.12);this.tone(110,38,.45,.06,'triangle',.04);}
    }
    else if(e.type==='wallHit'){this.rustle(e.fire?1200:2300,.15,.04);this.tone(220,85,.1,.025,'triangle');}
    else if(e.type==='land')this.rustle(250,.1,.026);
    else if(['summon','roots','tree','foxCommand'].includes(e.type)){this.tone(150,65,.38,.055,'triangle');this.rustle(1500,.55,.055);this.tone(520,780,.5,.018,'sine',.08);if(e.type==='tree'){this.tone(70,36,.85,.075);this.tone(780,1040,.9,.016,'sine',.22);this.rustle(620,.9,.075,0,'lowpass');}}
    else if(['woodHit','stagStrike'].includes(e.type)){this.tone(210,65,.18,.06,'triangle');this.rustle(850,.17,.055);}
    else if(['leap','dash','spring'].includes(e.type))this.rustle(900,.24,.045);
    else if(e.type==='hurt')this.tone(160,65,.22,.04,'triangle');
    else if(e.type==='mirror')this.tone(1100,750,.23,.014);
    else if(e.type==='meteor'){this.rustle(400,1.05,.07,0,'lowpass');this.tone(50,170,.95,.05);this.rustle(2500,.7,.035,.2);}
  }
}
