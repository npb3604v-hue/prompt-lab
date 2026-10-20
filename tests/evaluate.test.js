import test from 'node:test';
import assert from 'node:assert/strict';
import { categories, scenarios, keywords } from '../public/catalog.js';
import { evaluatePrompt } from '../public/evaluate.js';

const scenario = scenarios[0];
test('空入力は0点で次の指示を示す', () => {
  for (const input of ['', '   ', null, undefined]) {
    const result = evaluatePrompt(input, scenario);
    assert.equal(result.score, 0);
    assert.equal(result.matched.length, 0);
    assert.ok(result.improvements.length);
    assert.ok(result.improvedPrompt.includes('目的'));
  }
});
test('教材は6カテゴリ18題で参照整合性を保つ', () => {
  assert.equal(categories.length, 6);
  assert.equal(scenarios.length, 18);
  assert.equal(new Set(keywords.map((k) => k.id)).size, keywords.length);
  for (const item of scenarios) {
    assert.ok(categories.some((c) => c.id === item.category));
    assert.ok(item.keywordIds.every((id) => keywords.some((k) => k.id === id)));
    assert.ok(item.followups.length > 0);
  }
});
test('キラーワードを羅列しても合格点にはならない', () => {
  const list = keywords.map((k) => k.term).join('、');
  assert.equal(evaluatePrompt(list, scenario).score, 0);
  assert.ok(evaluatePrompt(`${list}。作成してください。`, scenario).score < 70);
  assert.ok(evaluatePrompt(`${list}。作成してください。検証してください。`, scenario).score < 70);
});
test('すべての優良サンプルが5軸で高評価になる', () => {
  for (const item of scenarios) {
    const result = evaluatePrompt(item.samplePrompt, item);
    assert.ok(result.score >= 85, `${item.id}: ${result.score}`);
    assert.equal(result.score, result.dimensions.reduce((sum, d) => sum + d.score, 0));
    assert.equal(result.dimensions.length, 5);
    assert.ok(result.dimensions.every((d) => d.score >= 0 && d.score <= d.max));
  }
});
test('同義語と大文字小文字を認識する', () => {
  const result = evaluatePrompt('デスクトップ優先で仕事用のメモアプリを作成してください。ブラウザで保存を確認してください。', scenario);
  assert.ok(result.matched.includes('pc'));
  assert.ok(result.matched.includes('browser-test'));
});
test('単に長い文章や繰り返しだけでは得点を増やさない', () => {
  assert.equal(evaluatePrompt('とても便利で楽しいもの'.repeat(1000), scenario).score, 0);
  const text = 'メモアプリを作成してください。';
  assert.equal(evaluatePrompt(text.repeat(1000), scenario).score, evaluatePrompt(text, scenario).score);
});
test('検証条件を加えると検証軸が改善する', () => {
  const base = 'PCで使う新人向けのメモアプリを作成してください。画面は一覧と編集に分けてください。';
  const improved = `${base}ブラウザで再読込をテストし、内容が残ることを合格条件にしてください。`;
  assert.ok(evaluatePrompt(improved, scenario).dimensions[4].score > evaluatePrompt(base, scenario).dimensions[4].score);
});
test('XSS文字列や長文でも落ちずスコアが有限である', () => {
  for (const text of ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', 'あ'.repeat(200000)]) {
    const result = evaluatePrompt(text, scenario);
    assert.ok(Number.isFinite(result.score));
    assert.ok(result.score >= 0 && result.score <= 100);
    assert.ok(result.improvedPrompt.length < 18000);
  }
});
test('存在しない課題やキーワードでも安全に評価する', () => {
  const result = evaluatePrompt('新人向けに議事録を作成してください。', { keywordIds: ['unknown-id'] }, []);
  assert.deepEqual(result.matched, []);
  assert.deepEqual(result.missing, []);
  assert.doesNotThrow(() => evaluatePrompt('議事録を作成してください。'));
});
