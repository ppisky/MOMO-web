import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configurationSelection, portablePreferences } from '../../src/product/contracts/moc';
test('configuration export rejects unknown scopes and strips local file references', () => {
  assert.throws(() => configurationSelection({ global:['constructor'],prompts:[],personal_spaces:[],spaces:{} }));
  assert.throws(() => configurationSelection({ global:[],prompts:[],personal_spaces:[],spaces:{ arbitrary:[] } }));
  assert.throws(() => portablePreferences({ api_key:'must not export' }));
  const mode={ backgroundPrimary:'#ffffff',backgroundSecondary:'#ffffff',backgroundTertiary:'#eeeeee',brand:'#aabbcc' };
  const value=portablePreferences({ stream:true,userAvatarKey:'local',interfaceColorPresets:[{ id:'custom',label:'Custom',colors:{ light:mode,dark:mode } }] });
  assert.ok(!('userAvatarKey' in value));
  assert.equal((value.interfaceColorPresets as {label:string}[])[0]?.label,'Custom');
});
