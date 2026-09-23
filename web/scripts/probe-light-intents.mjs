// Read-only evaluation: calls the same parser and Ollama classifier as the
// assistant route, but never sends a command to the ESP32.
import { parseLightIntent } from '../lib/light-intent.ts';
import { classifyLightIntentWithAi, shouldConsultLightAi } from '../lib/local-light-ai.ts';
import { answerLightQuestion } from '../lib/light-dialogue.ts';

const state = { brightness: 40, on: true, blinking: false, blinkBrightness: 80, blinkOnMs: 500, blinkOffMs: 500, blinkCount: 0 };
const cases = [
  ['เปิดไฟ', 'set', 100], ['ช่วยเปิดหลอดให้ที', 'set', 100], ['เปิดไฟให้หน่อยได้ไหม', 'set', 100],
  ['ปิดไฟ', 'set', 0], ['ปิดหลอดตรงนี้หน่อย', 'set', 0], ['turn on the light', 'set', 100],
  ['please switch off the light', 'set', 0], ['ตั้งความสว่าง 35%', 'set', 35],
  ['help me turn off the light', 'set', 0],
  ['ช่วยหรี่ไฟให้เหลือ 30%', 'set', 30], ['set the light to 65 percent', 'set', 65],
  ['สว่างขึ้นอีกนิด', 'adjust', 10], ['หรี่ลงหน่อย', 'adjust', -10],
  ['ขอไฟสว่างขึ้นอีกนิด', 'adjust', 10], ['ช่วยหรี่ไฟให้เหลือ 30%', 'set', 30],
  ['ปรับไฟให้เหลือ 25 เปอร์เซ็นต์', 'set', 25],
  ['กระพริบไฟเร็ว 5 ครั้ง', 'blink'], ['กะพริบหน่อยแบบช้าๆ', 'blink'],
  ['blink slowly 2 times at 40 percent', 'blink'], ['หยุดกระพริบไฟ', 'stop-blink'],
  ['ตอนนี้ไฟเปิดอยู่ไหม', 'question'], ['ไฟสว่างกี่เปอร์เซ็นต์', 'question'],
  ['what is the light status', 'question'], ['ช่วยอะไรได้บ้าง', 'question'],
  ['เปิดไฟในห้องให้หน่อย', 'set', 100], ['ปิดไฟในห้องให้ที', 'set', 0],
  ['turn the lamp on please', 'set', 100], ['dim the lights a bit', 'adjust', -10],
  ['หยุดไฟกระพริบ', 'stop-blink'], ['กระพริบไฟให้หน่อยได้ไหม', 'blink'],
  ['ไฟกระพริบได้ไหม', 'question'], ['ไฟเปิดอยู่แล้ว', 'question'],
  ['อย่าปิดไฟ', 'unknown'], ['เปิดไฟหรือปิดไฟดี', 'unknown'],
  ['เปิดไฟแล้วปิดไฟ', 'unknown'], ['กระพริบไฟแล้วปิด', 'unknown'],
  ['กระพริบไฟสีแดง', 'unknown'], ['เปิดไฟห้องนอน', 'unknown'],
  ['ตั้งความสว่าง 120%', 'unknown'], ['กระพริบไฟ 101 ครั้ง', 'unknown'],
  ['flash five times', 'blink'], ['blink 7x', 'blink'], ['flash eleven times', 'unknown'],
  ['เล่าเรื่องไฟกระพริบ', 'unknown'], ['ทำให้แสงอุ่นขึ้น', 'unknown'],
  ['วันนี้อากาศดี', 'unknown'],
  ['เล่าเรื่องตลกให้ฟัง', 'unknown'], ['can you tell me a joke', 'unknown'],
];

let passed = 0;
for (const [message, expectedKind, expectedValue] of cases) {
  const answer = answerLightQuestion(message, state);
  let intent = parseLightIntent(message);
  let source = 'rules';
  if (answer !== null) { intent = { kind: 'question' }; source = 'dialogue'; }
  else if (shouldConsultLightAi(intent, message)) {
    const proposal = await classifyLightIntentWithAi(message, fetch, state);
    if (proposal) { intent = proposal; source = 'pi-ai'; }
  }
  const actualKind = intent.kind === 'error' ? 'unknown' : intent.kind;
  const ok = actualKind === expectedKind && (expectedValue === undefined || intent.value === expectedValue);
  if (ok) passed++;
  if (!ok || process.argv.includes('--verbose')) {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${JSON.stringify(message)} expected=${expectedKind}${expectedValue === undefined ? '' : ':' + expectedValue} actual=${JSON.stringify(intent)} source=${source}`);
  }
}
console.log(`RESULT ${passed}/${cases.length}`);
if (passed !== cases.length) process.exitCode = 1;
