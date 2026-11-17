import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkBrowserVoiceSupportForLang,
  detectSpeechLanguageCode,
  ensurePlayableWavBuffer,
  extractPureTargetSpeechText,
  hasRiffWaveHeader,
  normalizeSpeechLangCode,
  parsePcmSampleRate,
} from './ttsUtils';

test('ensurePlayableWavBuffer wraps raw L16 PCM bytes in a valid 44-byte RIFF/WAVE header', () => {
  const rawPcm = Buffer.from([0x01, 0x00, 0x02, 0x00, 0x03, 0x00, 0x04, 0x00]);
  assert.equal(hasRiffWaveHeader(rawPcm), false);

  const res = ensurePlayableWavBuffer(rawPcm, 'audio/L16;rate=24000');
  assert.equal(res.wrappedFromRawPcm, true);
  assert.equal(res.mimeType, 'audio/wav');
  assert.equal(res.buffer.length, 44 + rawPcm.length);
  assert.equal(hasRiffWaveHeader(res.buffer), true);
  assert.equal(res.buffer.readUInt32LE(24), 24000);
  assert.equal(res.buffer.readUInt32LE(40), rawPcm.length);
});

test('ensurePlayableWavBuffer passes through valid RIFF WAV and compressed MP3/OGG buffers untouched', () => {
  const wavHeader = Buffer.alloc(44);
  wavHeader.write('RIFF', 0, 'ascii');
  wavHeader.write('WAVE', 8, 'ascii');
  const wavRes = ensurePlayableWavBuffer(wavHeader, 'audio/wav');
  assert.equal(wavRes.wrappedFromRawPcm, false);
  assert.equal(wavRes.buffer, wavHeader);

  const mp3Buf = Buffer.from([0xff, 0xfb, 0x90, 0x64]);
  const mp3Res = ensurePlayableWavBuffer(mp3Buf, 'audio/mpeg');
  assert.equal(mp3Res.wrappedFromRawPcm, false);
  assert.equal(mp3Res.mimeType, 'audio/mpeg');
});

test('parsePcmSampleRate handles rate parameters cleanly', () => {
  assert.equal(parsePcmSampleRate('audio/L16;codec=pcm;rate=24000'), 24000);
  assert.equal(parsePcmSampleRate('audio/pcm;rate=16000'), 16000);
  assert.equal(parsePcmSampleRate(undefined), 24000);
});

test('normalizeSpeechLangCode and detectSpeechLanguageCode isolate French, Spanish, Japanese, and Kiswahili accurately', () => {
  assert.equal(normalizeSpeechLangCode('French'), 'fr-FR');
  assert.equal(normalizeSpeechLangCode('kiswahili'), 'sw-KE');
  assert.equal(normalizeSpeechLangCode('ja'), 'ja-JP');

  assert.equal(detectSpeechLanguageCode('おはようございます'), 'ja-JP');
  assert.equal(detectSpeechLanguageCode('Bonjour, comment allez-vous ?'), 'fr-FR');
  assert.equal(detectSpeechLanguageCode('Habari za asubuhi, rafiki yangu?'), 'sw-KE');
  assert.equal(detectSpeechLanguageCode('¡Buenos días! Gracias por tu ayuda.'), 'es-ES');
  assert.equal(detectSpeechLanguageCode('Je suis prêt', 'French'), 'fr-FR');
});

test('extractPureTargetSpeechText removes English meanings and romanization clutter', () => {
  assert.equal(extractPureTargetSpeechText('**Habari za asubuhi** [Good morning]'), 'Habari za asubuhi');
  assert.equal(
    extractPureTargetSpeechText('ありがとう (pronounced arigato) — Thank you'),
    'ありがとう'
  );
});

test('checkBrowserVoiceSupportForLang never falls back to English for unsupported foreign languages', () => {
  const englishOnlyVoices = [
    { name: 'English US', lang: 'en-US', voiceURI: 'en-us-1', default: true, localService: true },
  ];

  const swMatch = checkBrowserVoiceSupportForLang(englishOnlyVoices, 'sw-KE');
  assert.equal(swMatch.languageSupported, false);
  assert.equal(swMatch.matchedVoice, null);
  assert.equal(Boolean(swMatch.unsupportedReason?.includes('Kiswahili')), true);

  const jaMatch = checkBrowserVoiceSupportForLang(englishOnlyVoices, 'ja-JP');
  assert.equal(jaMatch.languageSupported, false);
  assert.equal(jaMatch.matchedVoice, null);

  const multiVoices = [
    ...englishOnlyVoices,
    { name: 'French France', lang: 'fr-FR', voiceURI: 'fr-fr-1', localService: true },
  ];
  const frMatch = checkBrowserVoiceSupportForLang(multiVoices, 'fr-FR');
  assert.equal(frMatch.languageSupported, true);
  assert.equal(frMatch.matchedVoice?.voiceURI, 'fr-fr-1');
});
