// The full guidance is meant to be read in chat and exceeds the TTS endpoint's
// 200-character limit. Do not attempt playback or surface a misleading error.
export function shouldSpeakReply(reply: string): boolean {
  return reply.length <= 200 && !/^(?:ไม่รู้จักคำสั่งนี้ครับ|I don't know that command\.)/.test(reply);
}
