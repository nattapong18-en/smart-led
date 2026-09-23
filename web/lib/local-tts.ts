import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = resolve(process.cwd(), '../tts');
const python = join(root, '.venv/bin/python');
const synthesizer = join(root, 'synthesize.py');
const cache = join(root, 'cache');

export function hasLocalTts() {
  return existsSync(python) && existsSync(synthesizer);
}

export async function synthesizeLocal(text: string): Promise<Uint8Array> {
  await mkdir(cache, { recursive: true, mode: 0o700 });
  const digest = createHash('sha256').update(text).digest('hex');
  const destination = join(cache, `${digest}.wav`);
  try {
    return new Uint8Array(await readFile(destination));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const temporary = join(cache, `${digest}.${randomUUID()}.wav`);
  try {
    await run(python, [synthesizer, text, temporary], { cwd: root, timeout: 30_000, maxBuffer: 1024 * 1024 });
    const audio = await readFile(temporary);
    if (audio.length < 44 || audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE') {
      throw new Error('Thai TTS produced an invalid WAV file');
    }
    await rename(temporary, destination);
    return new Uint8Array(audio);
  } finally {
    await unlink(temporary).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; });
  }
}
