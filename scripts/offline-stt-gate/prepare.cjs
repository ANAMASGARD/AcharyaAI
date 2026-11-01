/* global __dirname */
const fs = require('node:fs');
const { Buffer } = require('node:buffer');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const directory = path.resolve(__dirname, '../../.expo/offline-stt-gate');
const url = 'https://raw.githubusercontent.com/ggml-org/whisper.cpp/482279b8a18855ba741d7b88c30fcb3874691f59/samples/jfk.wav';
const hash = '59dfb9a4acb36fe2a2affc14bacbee2920ff435cb13cc314a08c13f66ba7860e';
async function main() {
  fs.mkdirSync(directory, { recursive: true });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Fixture download failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== hash) throw new Error('Public fixture checksum mismatch');
  const input = path.join(directory, 'jfk.wav'); fs.writeFileSync(input, bytes);
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-stream_loop', '-1', '-i', input,
    '-t', '65', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', '-y', path.join(directory, 'class.wav')], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Install ffmpeg to generate the 65-second synthetic fixture');
  for (const [name, text] of [
    ['hindi', 'आज हम कक्षा में पौधों के बारे में पढ़ेंगे। पौधे सूर्य की रोशनी से भोजन बनाते हैं।'],
    ['hinglish', 'आज हम photosynthesis सीखेंगे। Plants use sunlight and water to make food.'],
  ]) {
    const raw = path.join(directory, `${name}-raw.wav`);
    const speech = spawnSync('espeak-ng', ['-v', 'hi', '-s', '130', '-w', raw, text], { stdio: 'inherit' });
    if (speech.status !== 0) throw new Error('Install espeak-ng for synthetic Hindi and Hinglish fixtures');
    const convert = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', raw, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', '-y', path.join(directory, `${name}.wav`)], { stdio: 'inherit' });
    if (convert.status !== 0) throw new Error('Speech fixture conversion failed');
  }
  const silence = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono', '-t', '5', '-c:a', 'pcm_s16le', '-y', path.join(directory, 'silence.wav')], { stdio: 'inherit' });
  if (silence.status !== 0) throw new Error('Silence fixture conversion failed');
  console.log('Verified public English fixture and prepared synthetic Hindi, Hinglish and silence. No microphone or teacher data used.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
