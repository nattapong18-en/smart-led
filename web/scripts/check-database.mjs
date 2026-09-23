import assert from 'node:assert/strict';

const origin = process.env.LUMA_URL || 'http://127.0.0.1:3000';
const initial = await (await fetch(origin+'/api/esp32/status')).json();
assert.equal(initial.blinking,false,'Run while LED is steady; the check preserves brightness');
const first = await fetch(origin+'/api/history');
assert.equal(first.status,200);
const cookie = first.headers.get('set-cookie')?.split(';')[0];
assert.ok(cookie?.startsWith('luma_session='));
const request = async (path,method='GET',body) => {
  const response = await fetch(origin+path,{method,headers:{Cookie:cookie,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:response.status,body:await response.json()};
};
const presetName = `ตรวจฐานข้อมูล-${Date.now()}`;
try {
  assert.equal((await request('/api/assistant','POST',{message:'สถานะไฟ'})).status,200);
  const preset = await request('/api/presets','POST',{name:presetName,mode:'steady',brightness:initial.brightness,onMs:500,offMs:500,count:0});
  assert.equal(preset.status,201);
  assert.equal((await request('/api/presets')).body.presets.some(p=>p.id===preset.body.id),true);
  assert.equal((await request('/api/presets','POST',{action:'apply',id:preset.body.id})).status,200);
  const history = (await request('/api/history')).body;
  assert.equal(history.turns.at(-1).input,'สถานะไฟ');
  assert.equal(history.commands.at(0).source,'preset');
  assert.equal(history.commands.at(0).outcome,'confirmed');
  const outsider = await (await fetch(origin+'/api/history')).json();
  assert.equal(outsider.turns.some(x=>x.input==='สถานะไฟ'),false);
  assert.equal(outsider.commands.some(x=>x.source==='preset'),false);
  assert.equal((await request(`/api/presets?id=${preset.body.id}`,'DELETE')).status,200);
  const after = await (await fetch(origin+'/api/esp32/status')).json();
  assert.equal(after.brightness,initial.brightness);
  console.log('PASS: persisted chat, presets, confirmed command, session isolation, unchanged brightness');
} finally {
  const after = await (await fetch(origin+'/api/esp32/status')).json();
  if (after.blinking || after.brightness!==initial.brightness) await request(`/api/esp32/light?brightness=${initial.brightness}`,'POST');
}
