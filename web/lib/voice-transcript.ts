// Only repair a known, whole-utterance recognition artifact. Do not use
// prefix matching: negations, brightness values and longer phrases must survive.
export function normalizeVoiceTranscript(input: string): string {
  const text = input.trim();
  const compact = text.toLowerCase().replace(/[.!?。？！]/g, "").replace(/\s+/g, "");
  const knownArtifact = compact.match(/^(เปิด|ปิด)(?:ไฟ|ไฟล์|ไฟล|ไฟร์)(?:ให้หน่อย|หน่อย|ให้ที|ที|นะ|ครับ|ค่ะ|คะ|เลย)?$/u);
  return knownArtifact ? `${knownArtifact[1]}ไฟ` : text;
}
