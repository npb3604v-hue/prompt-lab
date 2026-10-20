import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import { scenarios } from '../public/catalog.js';

const sample = { scenarioId: scenarios[0].id, prompt: scenarios[0].samplePrompt };
const request = (path, body = sample, headers = {}) => new Request(`https://prompt.test${path}`, { method: 'POST', headers: { 'Content-Type':'application/json', ...headers }, body: JSON.stringify(body) });
test('healthはAIの接続有無を明示する', async () => {
  const response = await worker.fetch(new Request('https://prompt.test/api/health'));
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{status:'ok',aiConnected:false,storage:'device'});
});
test('採点APIは対象のお題のサンプルを評価する',async()=>{
  const response=await worker.fetch(request('/api/evaluate'));
  assert.equal(response.status,200);const result=await response.json();assert.ok(result.score>=85);assert.equal(result.dimensions.length,5);
});
test('未知の課題・空入力・過長・型違いは400',async()=>{
  for(const body of [{...sample,scenarioId:'missing'},{...sample,prompt:''},{...sample,prompt:'あ'.repeat(8001)},{...sample,prompt:42},null]){
    assert.equal((await worker.fetch(request('/api/evaluate',body))).status,400);
  }
});
test('別オリジン・不正Content-Type・壊れたJSONを拒否する',async()=>{
  assert.equal((await worker.fetch(request('/api/evaluate',sample,{Origin:'https://attacker.test'}))).status,400);
  assert.equal((await worker.fetch(request('/api/evaluate',sample,{'Content-Type':'text/plain'}))).status,400);
  assert.equal((await worker.fetch(new Request('https://prompt.test/api/evaluate',{method:'POST',headers:{'Content-Type':'application/json'},body:'{broken'}))).status,400);
});
test('32KBを超えるリクエストを拒否する',async()=>{
  assert.equal((await worker.fetch(request('/api/evaluate',{...sample,extra:'x'.repeat(33000)}))).status,400);
});
test('メソッド・未知のAPIはエラーを返し資産へフォールバックしない',async()=>{
  assert.equal((await worker.fetch(new Request('https://prompt.test/api/evaluate'))).status,405);
  assert.equal((await worker.fetch(request('/api/unknown'))).status,404);
});
test('AI未接続は明示的な503で採点を偽装しない',async()=>{
  const response=await worker.fetch(request('/api/coach'));assert.equal(response.status,503);assert.equal((await response.json()).code,'AI_UNAVAILABLE');
});
test('レート制限未設定の場合AIを実行しない',async()=>{
  let called=false; const response=await worker.fetch(request('/api/coach'),{AI:{run(){called=true;}}});assert.equal(response.status,503);assert.equal(called,false);
});
test('レート制限超過時はAIを実行しない',async()=>{
  let called=false; const response=await worker.fetch(request('/api/coach'),{AI:{run(){called=true;}},AI_LIMITER:{limit:async()=>({success:false})}});assert.equal(response.status,429);assert.equal(called,false);
});
test('AIの正常応答と依頼者モードを受け取れる',async()=>{
  let messages;const env={AI:{run:async(model,body)=>{messages=body.messages;return{response:'対象と枚数を具体的に書いてみましょう。'};}},AI_LIMITER:{limit:async()=>({success:true})}};
  const response=await worker.fetch(request('/api/coach',{...sample,kind:'roleplay'}),env);assert.equal(response.status,200);const data=await response.json();assert.equal(data.source,'Workers AI');assert.ok(data.feedback.includes('具体的'));assert.ok(messages[0].content.includes('依頼者役'));
});
test('AI障害・空の応答を502で扱う',async()=>{
  for(const run of [async()=>{throw Error('upstream');},async()=>({})]){const response=await worker.fetch(request('/api/coach'),{AI:{run},AI_LIMITER:{limit:async()=>({success:true})}});assert.equal(response.status,502);}
});
test('レート制限サービスの障害は503で扱う',async()=>{
  const response=await worker.fetch(request('/api/coach'),{AI:{run:async()=>({response:'ok'})},AI_LIMITER:{limit:async()=>{throw Error('unavailable');}}});assert.equal(response.status,503);
});
test('chat.completion形式の応答にも対応する',async()=>{
  const response=await worker.fetch(request('/api/coach'),{AI:{run:async()=>({choices:[{message:{content:'<think>internal</think>出力形式を指定しましょう。'}}]})},AI_LIMITER:{limit:async()=>({success:true})}});assert.equal(response.status,200);assert.equal((await response.json()).feedback,'出力形式を指定しましょう。');
});
test('静的ファイルはASSETSに委譲する',async()=>{
  const response=await worker.fetch(new Request('https://prompt.test/style.css'),{ASSETS:{fetch:async()=>new Response('body{}')}});assert.equal(await response.text(),'body{}');
});
