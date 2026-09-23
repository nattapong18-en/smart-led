import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, persistentSessionFor, sessionFor, sessionResponse, validatePreset } from './database.ts';

test('SQLite persists related chat, command and preset records after reconnect', () => {
  const dir = mkdtempSync(join(tmpdir(),'luma-db-test-'));
  const path = join(dir,'luma.sqlite');
  try {
    let db = openDatabase(path);
    db.prepare('INSERT INTO sessions(id) VALUES (?)').run('session-a');
    const turn = db.prepare('INSERT INTO chat_turns(session_id,input,reply,outcome) VALUES (?,?,?,?)').run('session-a','เปิดไฟ','ไฟเปิดอยู่แล้วครับ','answered').lastInsertRowid;
    db.prepare('INSERT INTO commands(session_id,turn_id,source,path,outcome,status_code) VALUES (?,?,?,?,?,?)').run('session-a',turn,'chat','/light?brightness=100','confirmed',200);
    db.prepare('INSERT INTO presets(session_id,name,mode,brightness,on_ms,off_ms,count) VALUES (?,?,?,?,?,?,?)').run('session-a','อ่านหนังสือ','steady',70,500,500,0);
    db.close();
    db = openDatabase(path);
    assert.equal(db.prepare('SELECT reply FROM chat_turns WHERE id=?').get(turn).reply,'ไฟเปิดอยู่แล้วครับ');
    assert.equal(db.prepare('SELECT outcome FROM commands WHERE turn_id=?').get(turn).outcome,'confirmed');
    assert.equal(db.prepare('SELECT brightness FROM presets WHERE name=?').get('อ่านหนังสือ').brightness,70);
    assert.throws(() => db.prepare('INSERT INTO presets(session_id,name,mode,brightness,on_ms,off_ms,count) VALUES (?,?,?,?,?,?,?)').run('other','x','steady',20,500,500,0),/FOREIGN KEY/);
    db.close();
  } finally { rmSync(dir,{ recursive:true,force:true }); }
});

test('preset validation rejects invalid light settings', () => {
  assert.equal(validatePreset({name:'bad',mode:'blink',brightness:0,onMs:500,offMs:500,count:0}),null);
  assert.equal(validatePreset({name:'bad',mode:'steady',brightness:10,onMs:10,offMs:500,count:0}),null);
  assert.deepEqual(validatePreset({name:'  demo  ',mode:'steady',brightness:0,onMs:500,offMs:500,count:0}),{name:'demo',mode:'steady',brightness:0,onMs:500,offMs:500,count:0});
});

test('each page session has separate history while presets keep the browser owner', () => {
  const db = openDatabase(':memory:');
  try {
    const owner = '11111111-1111-4111-8111-111111111111';
    const firstPage = '22222222-2222-4222-8222-222222222222';
    const nextPage = '33333333-3333-4333-8333-333333333333';
    db.prepare('INSERT INTO sessions(id) VALUES (?)').run(owner);
    const request = (page: string) => new Request('http://localhost:3000/api/history', {
      headers: { Cookie: `luma_session=${owner}`, 'X-Luma-Session': page },
    });
    const firstRequest = request(firstPage);
    assert.equal(sessionFor(firstRequest, db), firstPage);
    assert.equal(persistentSessionFor(firstRequest, db), owner);
    db.prepare('INSERT INTO chat_turns(session_id,input) VALUES (?,?)').run(firstPage, 'เปิดไฟ');
    db.prepare('INSERT INTO presets(session_id,name,mode,brightness,on_ms,off_ms,count) VALUES (?,?,?,?,?,?,?)').run(owner, 'อ่านหนังสือ', 'steady', 70, 500, 500, 0);
    assert.equal(sessionFor(request(nextPage), db), nextPage);
    assert.equal(db.prepare('SELECT count(*) AS total FROM chat_turns WHERE session_id=?').get(nextPage).total, 0);
    assert.equal(db.prepare('SELECT count(*) AS total FROM presets WHERE session_id=?').get(owner).total, 1);
    assert.equal(sessionResponse(firstRequest, Response.json({}), firstPage).headers.has('set-cookie'), false);
  } finally { db.close(); }
});
