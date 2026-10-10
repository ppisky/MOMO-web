import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configurationSelection, portablePreferences } from '../../src/product/contracts/moc';
import { promptSpaces } from '../../src/product/contracts/prompts';
test('prompt export sources must be known and unique, rather than treating every body as modified', () => {
  const builtin = { id: 'assistant', source: 'builtin', content: 'Built in', revision: 'revision' };
  assert.equal(promptSpaces([builtin])[0]?.source, 'builtin');
  assert.throws(() => promptSpaces([{ ...builtin, source: 'unknown' }]));
  assert.throws(() => promptSpaces([{ ...builtin, source: ['builtin'] }]));
  assert.throws(() => promptSpaces([{ ...builtin, id: 'unknown' }]));
  assert.throws(() => promptSpaces([builtin, builtin]));
});
test('configuration export rejects unknown scopes and strips local file references', () => {
  assert.throws(() => configurationSelection({ global:['constructor'],prompts:[],personal_spaces:[],spaces:{} }));
  assert.throws(() => configurationSelection({ global:[],prompts:[],personal_spaces:[],spaces:{ arbitrary:[] } }));
  assert.throws(() => portablePreferences({ api_key:'must not export' }));
  const mode={ backgroundPrimary:'#ffffff',backgroundSecondary:'#ffffff',backgroundTertiary:'#eeeeee',brand:'#aabbcc' };
  const value=portablePreferences({ stream:true,userAvatarKey:'local',interfaceColorPresets:[{ id:'custom',label:'Custom',colors:{ light:mode,dark:mode } }] });
  assert.ok(!('userAvatarKey' in value));
  assert.equal((value.interfaceColorPresets as {label:string}[])[0]?.label,'Custom');
});
