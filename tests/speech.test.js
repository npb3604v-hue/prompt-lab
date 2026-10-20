import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechController } from '../public/speech.js';

function fixture() {
  const instances = [], states = [], texts = [], errors = [];
  class Recognition {
    constructor() { instances.push(this); }
    start() { this.started = true; }
    abort() { this.aborted = true; }
  }
  const controller = createSpeechController({ Recognition, onState: s => states.push(s), onText: t => texts.push(t), onError: e => errors.push(e) });
  return { controller, instances, states, texts, errors };
}
const results = (...texts) => ({ results: texts.map(transcript => [{ transcript }]) });
test('日本語の部分結果を下書きに連結し、最終結果の再通知を重複させない', () => {
  const f = fixture(); f.controller.start('メモ'); const r = f.instances[0];
  assert.equal(r.lang, 'ja-JP'); assert.equal(r.interimResults, true); r.onstart();
  r.onresult(results('ホーム')); r.onresult(results('ホームページ', 'を作る')); r.onresult(results('ホームページ', 'を作る'));
  assert.deepEqual(f.texts, ['メモ\nホーム', 'メモ\nホームページを作る', 'メモ\nホームページを作る']);
  r.onend(); assert.equal(f.controller.phase, 'idle'); assert.deepEqual(f.states, ['starting', 'listening', 'idle']);
});
test('開始待ちでも停止でき、遅延した開始・結果イベントを無視する', () => {
  const f = fixture(); f.controller.start(); const r = f.instances[0]; const start = r.onstart, result = r.onresult;
  f.controller.stop(); start(); result(results('古い声'));
  assert.equal(r.aborted, true); assert.deepEqual(f.texts, []); assert.deepEqual(f.states, ['starting', 'idle']);
});
test('お題が変わったときの遅延結果を無視する', () => {
  const f = fixture(); let active = true; f.controller.start('', () => active); const r = f.instances[0];
  active = false; r.onresult(results('別のお題に入れてはいけない')); assert.deepEqual(f.texts, []);
});
test('新しい認識を開始した後は以前の結果が下書きを上書きしない', () => {
  const f = fixture(); f.controller.start('旧'); const old = f.instances[0], result = old.onresult;
  f.controller.start('新'); result(results('遅れた音声')); f.instances[1].onresult(results('今回の音声'));
  assert.equal(old.aborted, true); assert.deepEqual(f.texts, ['新\n今回の音声']);
});
test('マイク拒否・ネットワーク失敗時に録音状態を解除する', () => {
  for (const error of ['not-allowed', 'network', 'no-speech']) {
    const f = fixture(); f.controller.start(); f.instances[0].onerror({ error });
    assert.deepEqual(f.errors, [error]); assert.equal(f.controller.phase, 'idle'); assert.equal(f.states.at(-1), 'idle');
  }
});
test('非対応・開始例外でも録音中表示を残さない', () => {
  for (const Recognition of [undefined, class { start() { throw Error('failed'); } abort() {} }]) {
    const errors = [], states = []; const controller = createSpeechController({ Recognition, onError: e => errors.push(e), onState: s => states.push(s) });
    controller.start(); assert.equal(controller.phase, 'idle'); assert.deepEqual(states, ['starting', 'idle']); assert.equal(errors.length, 1);
  }
});
test('長い音声でも入力上限8,000文字を超えず、停止の重複も安全', () => {
  const f = fixture(); f.controller.start('既存'); f.instances[0].onresult(results('あ'.repeat(9000)));
  assert.equal(f.texts[0].length, 8000); f.controller.stop(); f.controller.stop(); assert.equal(f.controller.phase, 'idle');
});
