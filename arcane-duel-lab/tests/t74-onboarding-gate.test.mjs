import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {normalizeOnboarding} from '../dist/src/onboarding-state.mjs';
import {complianceState} from '../dist/src/tap-safety.mjs';

test('first-run click capture yields immediately to service dialogs and resumes without advancing the guide',async()=>{
 const source=(await fs.readFile(new URL('../dist/src/onboarding-guide.mjs',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').replace('export function installOnboarding','function installOnboarding');
 let serviceOpen=false,capture,saved=0;const profile={onboarding:{step:'start',menuIndex:0}},parts={};
 const rect={left:30,top:50,right:150,bottom:100,width:120,height:50};
 function node(){return{style:{},hidden:false,contains:()=>false,closest:()=>null,getClientRects:()=>[rect],getBoundingClientRect:()=>rect,addEventListener(){},setAttribute(){},classList:{toggle(){}}};}
 const target=node(),button=node(),focus=node(),bubble=node();bubble.querySelector=s=>parts[s]??=node();bubble.getBoundingClientRect=()=>({width:270,height:145});
 const layer=node();layer.hidden=true;layer.querySelector=s=>s==='.guide-focus'?focus:s==='.guide-bubble'?bubble:button;layer.showPopover=()=>{};layer.hidePopover=()=>{};
 const body={append:n=>n.parentNode=body},document={body,head:{append(){}},createElement:()=>layer,querySelector:s=>s.includes('.platform-safety-gate[open]')?(assert.ok(s.includes('.service-policy-view[open]')&&s.includes('.service-withdraw-dialog[open]')),serviceOpen?{}:null):s==='[data-onboarding-style]'?{}:s==='#start-button'?target:null,addEventListener:(type,fn)=>{if(type==='click')capture=fn;},removeEventListener(){}};
 const install=vm.runInNewContext(source+'\ninstallOnboarding',{document,window:{addEventListener(){}},normalizeOnboarding,getComputedStyle:()=>({visibility:'visible'}),innerWidth:800,innerHeight:360,setInterval:()=>1,clearInterval(){},setTimeout(){},loadSolo(){throw Error('Use isolated profile');},saveSolo(){throw Error('Use isolated persistence');}});
 const guide=install('title',{storage:{},getProfile:()=>profile,persist:()=>{saved++;return true;}});assert.equal(layer.hidden,false);
 const click=()=>{let blocked=false;capture({target:node(),preventDefault(){blocked=true;},stopImmediatePropagation(){blocked=true;}});return blocked;};
 assert.equal(click(),true,'normal guide still constrains unrelated clicks');
 serviceOpen=true;assert.equal(click(),false,'consent click must pass before the next 350ms refresh');guide.refresh();assert.equal(layer.hidden,true);assert.equal(saved,0);assert.equal(profile.onboarding.step,'start');
 serviceOpen=false;guide.refresh();assert.equal(layer.hidden,false);assert.equal(click(),true);assert.equal(saved,0);
});

test('fresh native unchecked state asks for authentication instead of falsely reporting a service outage',()=>{
 const state=complianceState({available:true,initialized:false,complianceAllowed:false,complianceRevision:0,reason:'unchecked'});
 assert.equal(state.phase,'unchecked');assert.equal(state.label,'尚未进行实名认证');assert.equal(state.allowed,false);
 assert.equal(complianceState({available:true,initialized:true,complianceAllowed:false,complianceCode:1200}).phase,'serviceUnavailable');
});
