import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
test('the Android privacy iframe receives the original static scrollable document without game styles, controls or SDK bootstrap',t=>{
 const source=readFileSync(path.join(root,'dist/mobile-privacy.html'));
 const builtPath=path.join(root,'mobile/web/mobile-privacy.html');
 if(!existsSync(builtPath)){t.skip('Build Android web assets first to audit the actual bundled document');return;}
 const built=readFileSync(builtPath),html=built.toString('utf8');
 assert.deepEqual(built,source,'Policy body and all source bytes must remain unchanged during Android packaging');
 assert.doesNotMatch(html,/<script\b|mobile-bootstrap|mobile-layout\.css|mobile-controls|data-mobile\b/i,'A document iframe must not initialize any game shell, touch handler or SDK');
 assert.doesNotMatch(html,/(?:html|body)\s*\{[^}]*overflow\s*:\s*hidden/i,'The standalone policy must remain naturally scrollable');
 assert.match(html,/<h2>八、变更及联系<\/h2>/,'The complete policy must remain in the packaged document');
});
