import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCustomWord } from '../public/custom-words.js';
const valid = { term: '確認質問を一つずつ', category: '共通', meaning: '質問を一度に詰め込まずに進める。', example: '不足した情報は一問ずつ確認してください。' };

test('正常な入力をtrimし、独立したIDと空の別名を返す', () => {
  const result = validateCustomWord({ ...valid, term: ` ${valid.term} `, source: 'https://example.com/reference' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.word.term, valid.term);
  assert.match(result.word.id, /^custom-[0-9a-f-]{36}$/);
  assert.equal(result.word.custom, true);
  assert.deepEqual(result.word.aliases, []);
  assert.equal(result.word.source, 'https://example.com/reference');
  assert.notEqual(result.word.id, validateCustomWord(valid).word.id);
});
test('全項目空欄と必須項目の型異常は失敗する', () => {
  for (const input of [null, undefined, [], 'text', 42]) assert.equal(validateCustomWord(input).ok, false);
  const empty = validateCustomWord({});
  assert.equal(empty.errors.length, 4);
  assert.equal(empty.word, undefined);
  for (const key of ['term', 'meaning', 'example', 'category']) {
    for (const value of [null, 0, {}, [], '  ']) assert.equal(validateCustomWord({ ...valid, [key]: value }).ok, false);
  }
});
test('各必須項目の最大文字数境界を検証する', () => {
  for (const [key, max] of [['term', 80], ['meaning', 600], ['example', 1200], ['category', 40]]) {
    assert.equal(validateCustomWord({ ...valid, [key]: 'あ'.repeat(max) }).ok, true);
    const result = validateCustomWord({ ...valid, [key]: 'あ'.repeat(max + 1) });
    assert.equal(result.ok, false);
    assert.equal(result.word, undefined);
  }
});
test('URLはHTTP/HTTPSだけを受け付ける', () => {
  for (const source of ['https://example.com', 'http://example.com/path?q=1', '', '   ', undefined, null]) {
    assert.equal(validateCustomWord({ ...valid, source }).ok, true);
  }
  for (const source of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'ftp://example.com', '/relative', 'not a url', 42, {}, 'https://user:pass@example.com']) {
    const result = validateCustomWord({ ...valid, source });
    assert.equal(result.ok, false, String(source));
    assert.equal(result.word, undefined);
  }
});
test('NFKCと大文字小文字をそろえて重複を検出する', () => {
  const existing = [{ id: 'word-1', term: 'Workers AI' }];
  assert.equal(validateCustomWord({ ...valid, term: 'ｗｏｒｋｅｒｓ ＡＩ' }, existing).ok, false);
  assert.equal(validateCustomWord({ ...valid, term: ' WORKERS AI ' }, existing).ok, false);
  assert.equal(validateCustomWord(valid, [null, {}, { term: 42 }]).ok, true);
});
test('編集時には自分を除外し、別のワードとの重複は防ぐ', () => {
  const existing = [{ id: 'custom-one', term: valid.term }, { id: 'custom-two', term: 'Other' }];
  const result = validateCustomWord(valid, existing, 'custom-one');
  assert.equal(result.ok, true);
  assert.equal(result.word.id, 'custom-one');
  assert.equal(validateCustomWord({ ...valid, term: 'other' }, existing, 'custom-one').ok, false);
  for (const id of ['', 0, {}, []]) assert.equal(validateCustomWord(valid, [], id).ok, false);
});
test('XSSの字句もデータとして保持し、検証時は変換や実行をしない', () => {
  const input = { ...valid, term: '<img src=x onerror=alert(1)>', meaning: '<script>alert(1)</script>', example: '"</textarea><img src=x onerror=alert(1)>' };
  const snapshot = structuredClone(input);
  const result = validateCustomWord(input);
  assert.equal(result.ok, true);
  assert.equal(result.word.term, input.term);
  assert.equal(result.word.meaning, input.meaning);
  assert.equal(result.word.example, input.example);
  assert.deepEqual(input, snapshot);
});
