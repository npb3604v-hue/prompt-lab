import { categories, scenarios, keywords, sources } from './catalog.js';
import { evaluatePrompt } from './evaluate.js';
import { validateCustomWord } from './custom-words.js';
import { createSpeechController } from './speech.js';

const $ = (s, root = document) => root.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const paths = {
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a19 19 0 0 1 0 18 19 19 0 0 1 0-18Z"/>',
  presentation: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="m8 22 4-5 4 5M7 9h4m-4 4h9"/>',
  clipboard: '<rect x="5" y="5" width="14" height="16" rx="2"/><rect x="9" y="2" width="6" height="5" rx="1"/><path d="M9 12h6m-6 4h4"/>',
  workflow: '<rect x="8" y="2" width="8" height="6" rx="1"/><rect x="2" y="16" width="7" height="6" rx="1"/><rect x="15" y="16" width="7" height="6" rx="1"/><path d="M12 8v4m-7 4v-4h14v4"/>',
  pen: '<path d="m16 3 5 5-12 12-6 1 1-6ZM13 6l5 5M3 21h18"/>',
  stethoscope: '<path d="M5 3v6a5 5 0 0 0 10 0V3m-12 0h4m6 0h4m-7 11v3a4 4 0 0 0 8 0v-3"/><circle cx="18" cy="11" r="3"/>',
  book: '<path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v15"/>',
  chart: '<path d="M4 3v18h18M9 16v-4m5 4V7m5 9v-6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8"/>',
  volume: '<path d="m11 4-6 5H2v6h3l6 5Zm5 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  close: '<path d="m5 5 14 14M5 19 19 5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chat: '<path d="M21 15a3 3 0 0 1-3 3H8l-5 4V5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3Z"/><path d="M7 8h10M7 12h6"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  link: '<path d="m10 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.spark}</svg>`;
const mascot = (small = false) => `<div class="mascot ${small ? 'small' : ''}" aria-label="コーチのポコ" role="img"><div class="mascot-orbit"></div><div class="mascot-body"><i class="mascot-bump"></i><div class="mascot-face"><i class="eye"></i><i class="eye"></i><i class="cheek left"></i><i class="cheek right"></i><i class="mouth"></i></div><i class="arm left"></i><i class="arm right"></i></div><div class="mascot-shadow"></div><i class="tiny-spark s1">✦</i><i class="tiny-spark s2">✧</i></div>`;

let storageOkay = true;
function read(key, fallback) { try { const value = JSON.parse(localStorage.getItem(`promptlab:${key}`)); return value ?? fallback; } catch { return fallback; } }
function persist(key, value) { try { localStorage.setItem(`promptlab:${key}`, JSON.stringify(value)); } catch { storageOkay = false; toast('端末に保存できません。練習内容をコピーして保管してください。'); } }
const storedWords = read('customWords', []);
let customWords = [];
if(Array.isArray(storedWords)) for(const item of storedWords.slice(0,100)) { const checked = validateCustomWord(item,keywords,typeof item?.id === 'string' ? item.id : null); if(checked.ok) { customWords.push(checked.word); keywords.push(checked.word); } }
let scenarioExtras = read('scenarioExtras',{}); if(!scenarioExtras || typeof scenarioExtras!=='object'||Array.isArray(scenarioExtras))scenarioExtras={};
const initialHistory = read('history', []);
const initialFavorites = read('favorites', []);
let history = Array.isArray(initialHistory) ? initialHistory.filter(h => h && typeof h.id === 'string' && typeof h.prompt === 'string' && h.prompt.length <= 8000 && Number.isFinite(h.score) && h.score >= 0 && h.score <= 100 && Number.isFinite(Date.parse(h.date)) && scenarios.some(s => s.id === h.scenarioId)).slice(0, 100) : [];
let favorites = Array.isArray(initialFavorites) ? initialFavorites.filter(id => keywords.some(k => k.id === id)) : [];
let drafts = read('drafts', {}); if (!drafts || Array.isArray(drafts) || typeof drafts !== 'object') drafts = {};
const state = { page: 'practice', category: categories[0].id, scenarioId: scenarios[0].id, mode: 'practice', query: '', onlyFavorites: false, level: 'すべて', aiConnected: false, busy: false, speaking: false, recording: false, transcript: '', roleIndex: 0, result: null, recordCategory: 'all' };
let speechController, toastTimer, timerId, elapsed = 0, lastTick = Date.now();
const scenario = () => { const s=scenarios.find(s => s.id === state.scenarioId)||scenarios[0]; const extra=Array.isArray(scenarioExtras[s.id])?scenarioExtras[s.id].filter(id=>keywords.some(k=>k.id===id)):[]; return {...s,keywordIds:[...new Set([...s.keywordIds,...extra])]}; };
const draft = () => typeof drafts[state.scenarioId] === 'string' ? drafts[state.scenarioId] : '';
const byId = id => keywords.find(k => k.id === id);
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 3500); }
function dateLabel(date) { return new Date(date).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function completedCount(category) { return new Set(history.filter(h => (!category || scenarios.find(s => s.id === h.scenarioId)?.category === category) && h.score >= 70).map(h => h.scenarioId)).size; }
function todayCount() { return history.filter(h => new Date(h.date).toDateString() === new Date().toDateString()).length; }
function sidebar() { return `<aside class="sidebar"><a class="brand" href="#practice" aria-label="プロンプトラボの練習画面"><span class="brand-mark">${icon('spark')}</span><span>プロンプト<span class="brand-light">ラボ</span><small>自分のワークスペース</small></span></a><div class="nav-label">ワークスペース</div><nav aria-label="メインメニュー">${[['practice','spark','練習する'],['library','book','キラーワード集'],['history','chart','練習の記録']].map(([page,i,label]) => `<button data-page="${page}" aria-label="${label}" class="nav-button ${state.page === page ? 'active' : ''}" ${state.page === page ? 'aria-current="page"' : ''}>${icon(i)}<span>${label}</span>${page === 'library' ? `<span class="nav-count">${keywords.length}</span>` : ''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="daily-card"><div class="daily-heading">${icon('chart')} 今日の練習<span>${Math.min(todayCount(),3)} / 3</span></div><div class="daily-track"><i style="width:${Math.min(todayCount()/3,1)*100}%"></i></div><p>${todayCount() ? `${todayCount()}回の練習を記録しました` : 'まずは1つのお題から'}</p></div><button class="sidebar-help" data-action="about">${icon('settings')} 使い方・技術について</button><div class="profile"><span class="avatar">自</span><div><strong>自分のワークスペース</strong><small><i class="status-dot"></i> この端末に保存</small></div></div></div></aside>`; }
function header() { const labels = { practice: 'プロンプトの練習', library: 'キラーワード集', history: '練習の記録' }; return `<header class="topbar"><div class="breadcrumb">ワークスペース ${icon('chevron')} <span>${labels[state.page]}</span></div><div class="topbar-right"><span class="save-indicator"><i class="status-dot"></i> 自動保存</span><button class="icon-button" data-action="about" aria-label="使い方">?</button></div></header>`; }
function categoryTabs() { return `<div class="category-tabs" role="tablist" aria-label="練習テーマ">${categories.map(c => `<button role="tab" aria-selected="${state.category === c.id}" class="category-tab ${state.category === c.id ? 'selected' : ''}" data-category="${esc(c.id)}"><span class="category-icon ${esc(c.icon)}">${icon(c.icon)}</span><span>${esc(c.label)}<small>${scenarios.filter(s => s.category === c.id).length}のお題</small></span>${state.category === c.id ? '<span class="category-selected-dot"></span>' : ''}</button>`).join('')}</div>`; }
function practice() {
  const s = scenario(); const c = categories.find(c => c.id === s.category); const list = scenarios.filter(item => item.category === state.category && (state.level === 'すべて' || item.level === state.level));
  return `<div class="page-heading"><div><div class="eyebrow">トレーニング</div><h1>プロンプトの練習</h1></div><div class="page-heading-right"><span class="soft-badge">${completedCount()} / ${scenarios.length} お題クリア</span></div></div>${categoryTabs()}<div class="workspace-grid"><section class="exercise-list" aria-label="お題一覧"><div class="section-heading"><h2>お題を選ぶ</h2><span>${list.length}</span></div><label class="select-wrap"><span class="sr-only">難易度</span><select id="level" aria-label="難易度">${['すべて','入門','実践','応用'].map(l => `<option ${state.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select></label><div class="exercise-cards">${list.map((item,i) => { const best = Math.max(0, ...history.filter(h => h.scenarioId === item.id).map(h => h.score)); return `<button class="exercise-card ${s.id === item.id ? 'selected' : ''}" data-scenario="${esc(item.id)}"><div class="exercise-card-top"><span class="exercise-number">${String(i+1).padStart(2,'0')}</span><span class="difficulty ${item.level === '入門' ? 'beginner' : ''}">${esc(item.level)}</span></div><strong>${esc(item.title)}</strong><div class="exercise-card-bottom"><span>${icon('clock')} ${item.minutes}分</span>${best ? `<span class="best-score ${best >= 70 ? 'passed' : ''}">${best >= 70 ? icon('check') : ''} ${best}点</span>` : `${icon('arrow')}`}</div></button>`; }).join('')}</div><div class="practice-note">${icon('book')}<span>キラーワードは使い方まで<br>具体的に書いてみましょう。</span></div></section><div class="editor-column"><div class="mode-tabs" role="tablist" aria-label="練習モード"><button role="tab" aria-selected="${state.mode === 'practice'}" data-mode="practice" class="${state.mode === 'practice' ? 'selected' : ''}">${icon('pen')} プロンプト練習</button><button role="tab" aria-selected="${state.mode === 'roleplay'}" data-mode="roleplay" class="${state.mode === 'roleplay' ? 'selected' : ''}">${icon('chat')} ロールプレイ</button></div><section class="brief-card"><div class="brief-top"><span class="label-orange">今回のお題</span><span class="difficulty ${s.level === '入門' ? 'beginner' : ''}">${esc(s.level)}</span></div><h2>${esc(s.title)}</h2><p>${esc(s.brief)}</p><div class="requirements"><span>満たしたい条件</span>${s.requirements.map(r => `<div>${icon('check')}<span>${esc(r)}</span></div>`).join('')}</div>${state.mode === 'roleplay' ? `<div class="client-message">${icon('chat')}<div><strong>依頼者からの相談</strong><p>${esc(s.client)}</p></div></div><div id="role-conversation" class="role-conversation">${roleMessages.map(m => `<div class="role-message ${m.role}"><strong>${m.role === 'client' ? '依頼者' : '自分'}</strong><p>${esc(m.text)}</p></div>`).join('')}</div>` : ''}<div class="brief-bottom">${icon(c.icon)} ${esc(c.label)}<span>${icon('clock')} 目安 ${s.minutes}分</span></div></section><section class="prompt-card"><div class="prompt-heading"><label for="prompt-input">${state.mode === 'roleplay' ? '依頼者への提案・確認' : 'あなたのプロンプト'}</label><span id="draft-status">${draft() ? '保存済み' : '下書きは自動保存'}</span></div><textarea id="prompt-input" aria-label="${state.mode === 'roleplay' ? '依頼者への提案・確認' : 'あなたのプロンプト'}" maxlength="8000" placeholder="何を作るか、誰に向けるか、どう使いたいか。&#10;いつもの言葉で入力してみましょう。">${esc(draft())}</textarea><div class="editor-meta"><span id="char-count">${draft().length.toLocaleString()} / 8,000文字</span><span>${icon('clock')} <span id="practice-timer">${formatTime(elapsed)}</span></span></div><div class="editor-toolbar"><button class="text-button" data-action="mic" id="mic-button">${icon('mic')} 音声入力</button><button class="text-button" data-action="copy-draft" aria-label="入力したプロンプトをコピー">${icon('copy')}</button><span class="toolbar-spacer"></span><span class="shortcut">⌘ / Ctrl + Enter</span><button class="primary-button" data-action="submit" id="submit-button" ${draft().trim().length < 10 ? 'disabled' : ''}>${state.mode === 'roleplay' ? '提案を送る' : 'フィードバックを見る'} ${icon('arrow')}</button></div><div id="speech-note" class="speech-note" hidden></div></section><div class="under-editor"><span><i class="status-dot"></i> 練習内容はこの端末にのみ保存</span><button class="text-button" data-action="sample">回答例を見る ${icon('chevron')}</button></div><section id="feedback-inline" tabindex="-1" aria-label="採点のフィードバック" class="feedback-inline" ${state.result ? '' : 'hidden'}></section></div><aside class="coach-column"><section class="coach-card"><div class="coach-label"><span><i class="status-dot"></i> 練習コーチ</span><button class="icon-button" data-action="speak" aria-label="コーチの言葉を読み上げる">${icon('volume')}</button></div>${mascot()}<div class="coach-name">ポコ <span>COACH</span></div><div class="coach-bubble" id="coach-bubble">まずは「何を、誰のために作るか」から。<br>キラーワードも参考にしてね。</div></section><section class="keyword-panel"><div class="keyword-panel-heading"><h2>${icon('spark')} 今回のキラーワード</h2><span id="keyword-progress">0 / ${s.keywordIds.length}</span></div><div class="keyword-progress-track"><i id="keyword-progress-bar"></i></div><div class="keyword-help">タップで意味と使用例を確認</div><div class="keyword-list">${s.keywordIds.map((id,i) => keywordItem(byId(id),i === 0)).join('')}</div><button class="all-keywords" data-page="library">キラーワード集を開く ${icon('arrow')}</button></section></aside></div>`;
}
let roleMessages = []; let currentDialogResult = null; let aiRequestController, aiRequestVersion=0;
function keywordItem(k, open = false) { if (!k) return ''; return `<details class="keyword-item" ${open ? 'open' : ''} data-keyword-id="${esc(k.id)}"><summary><span class="keyword-match">${icon('check')}</span><span>${esc(k.term)}</span>${icon('chevron')}</summary><div class="keyword-detail"><p>${esc(k.meaning)}</p><div class="keyword-example">${esc(k.example)}</div><div class="keyword-actions"><button data-insert="${esc(k.id)}">${icon('pen')} 例文を入力</button><button class="favorite ${favorites.includes(k.id) ? 'saved' : ''}" data-favorite="${esc(k.id)}" aria-label="${esc(k.term)}を${favorites.includes(k.id) ? '保存解除' : '保存'}" aria-pressed="${favorites.includes(k.id)}">${icon('star')}</button></div></div></details>`; }
function library() {
  const query = state.query.toLocaleLowerCase();
  const list = keywords.filter(k => (!state.onlyFavorites || favorites.includes(k.id)) && `${k.term} ${k.meaning} ${k.example}`.toLocaleLowerCase().includes(query));
  return `<div class="page-heading"><div><div class="eyebrow">リファレンス</div><h1>キラーワード集</h1></div><div class="library-heading-actions"><span class="soft-badge">${keywords.length}ワード</span><button class="primary-button" data-action="add-word">${icon('pen')} ワードを追加</button></div></div><div class="library-toolbar"><label class="search-field">${icon('search')}<input id="keyword-search" type="search" placeholder="キラーワードを検索" value="${esc(state.query)}" aria-label="キラーワードを検索"></label><button class="filter-button ${state.onlyFavorites ? 'active' : ''}" data-action="favorites" aria-pressed="${state.onlyFavorites}">${icon('star')} 保存したワード <span>${favorites.length}</span></button></div><div id="library-results"><div class="results-count">${list.length}件のキラーワード</div><div class="library-grid">${list.map(k => `<article class="library-card"><div class="library-card-top"><span class="word-icon">${icon('spark')}</span><button class="favorite ${favorites.includes(k.id) ? 'saved' : ''}" data-favorite="${esc(k.id)}" aria-label="${esc(k.term)}を${favorites.includes(k.id) ? '保存解除' : '保存'}" aria-pressed="${favorites.includes(k.id)}">${icon('star')}</button></div><h2>${esc(k.term)}${k.custom?'<span class="custom-badge">自分のワード</span>':''}</h2><p>${esc(k.meaning)}</p><div class="keyword-example">${esc(k.example)}</div>${k.source?`<a class="word-source" href="${esc(k.source)}" target="_blank" rel="noopener noreferrer">${icon('link')} 参考URL</a>`:''}<div class="library-card-bottom"><span>${esc(categories.find(c => c.id === k.category)?.label || k.category || '共通')}</span><button class="text-button" data-copy-keyword="${esc(k.id)}">${icon('copy')} 例文をコピー</button></div><div class="word-extra-actions"><button class="text-button" data-use-keyword="${esc(k.id)}">${icon('arrow')} このお題で練習</button>${k.custom?`<button class="text-button" data-edit-word="${esc(k.id)}">編集</button>`:''}</div></article>`).join('')}</div>${!list.length ? `<div class="empty-state">${icon('search')}<h2>該当するワードがありません</h2><p>検索語を変えるか、保存フィルターを解除してください。</p></div>` : ''}</div><div class="source-note"><strong>参考資料</strong>${sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${icon('link')}${esc(s.title)} ${icon('arrow')}</a>`).join('')}<small>用語の解説・例文・お題は、学習用に独自に構成しています。</small></div>`;
}
function historyPage() {
  const average = history.length ? Math.round(history.reduce((a,h) => a+h.score,0)/history.length) : 0;
  const filtered = history.filter(h => state.recordCategory === 'all' || scenarios.find(s => s.id === h.scenarioId)?.category === state.recordCategory);
  return `<div class="page-heading"><div><div class="eyebrow">アクティビティ</div><h1>練習の記録</h1></div><button class="secondary-button" data-action="export" ${!history.length ? 'disabled' : ''}>${icon('download')} 記録を書き出す</button></div><div class="stat-grid"><div class="stat-card"><span>練習回数</span><strong>${history.length}<small>回</small></strong>${icon('pen')}</div><div class="stat-card"><span>平均スコア</span><strong>${average}<small>点</small></strong>${icon('chart')}</div><div class="stat-card"><span>クリアしたお題</span><strong>${completedCount()}<small>/ ${scenarios.length}</small></strong>${icon('check')}</div></div><div class="history-heading"><h2>練習履歴</h2><select id="history-category" aria-label="記録のテーマ"><option value="all">すべてのテーマ</option>${categories.map(c => `<option value="${esc(c.id)}" ${state.recordCategory === c.id ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select></div>${filtered.length ? `<div class="history-list">${filtered.map(h => { const s = scenarios.find(s => s.id === h.scenarioId); return `<button class="history-row" data-record="${esc(h.id)}"><span class="history-score ${h.score >= 70 ? 'passed' : ''}">${h.score}<small>点</small></span><span class="history-info"><strong>${esc(s.title)}</strong><small>${dateLabel(h.date)} ・ ${h.mode === 'roleplay' ? 'ロールプレイ' : 'プロンプト練習'}</small></span><span class="history-result">${h.score >= 70 ? 'クリア' : '練習中'}</span>${icon('chevron')}</button>`; }).join('')}</div>` : `<div class="empty-state">${mascot(true)}<h2>${history.length ? 'このテーマの記録はまだありません' : '練習すると、ここに記録されます'}</h2><p>70点以上でお題をクリア。何度でも挑戦できます。</p><button class="primary-button" data-page="practice">練習する ${icon('arrow')}</button></div>`}<p class="record-note">最大100件をこのブラウザに保存。端末間での同期は行いません。</p>`;
}
function render() {
  stopRecording(); stopSpeaking(); if(aiRequestController){aiRequestVersion++;aiRequestController.abort();aiRequestController=null;state.busy=false;}
  $('#app').innerHTML = `${sidebar()}<div class="app-body">${header()}<main id="main" tabindex="-1">${state.page === 'practice' ? practice() : state.page === 'library' ? library() : historyPage()}</main><footer class="app-footer"><span>プロンプトラボ</span><span>スコアは練習の目安です ・ ルール採点</span></footer></div>`;
  $('#app').setAttribute('aria-busy','false');
  if (state.page === 'practice') { updateLive(); if (state.result) renderInlineResult(state.result); }
}
function formatTime(seconds) { return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`; }
function updateLive() {
  const text = $('#prompt-input')?.value ?? draft();
  const result = evaluatePrompt(text, scenario());
  $('#char-count') && ($('#char-count').textContent = `${text.length.toLocaleString()} / 8,000文字`);
  const btn = $('#submit-button'); if (btn) btn.disabled = text.trim().length < 10 || state.busy;
  $('#keyword-progress') && ($('#keyword-progress').textContent = `${result.matched.length} / ${scenario().keywordIds.length}`);
  $('#keyword-progress-bar') && ($('#keyword-progress-bar').style.width = `${result.matched.length / Math.max(scenario().keywordIds.length,1) *100}%`);
  document.querySelectorAll('[data-keyword-id]').forEach(el => el.classList.toggle('matched',result.matched.includes(el.dataset.keywordId)));
}
function saveDraft() { const input = $('#prompt-input'); if (!input) return; drafts[state.scenarioId] = input.value; persist('drafts',drafts); if ($('#draft-status')) $('#draft-status').textContent = storageOkay ? '保存済み' : '端末への保存に失敗'; updateLive(); }
function resetScenario(id) { state.scenarioId = id; state.result = null; state.roleIndex = 0; roleMessages = []; elapsed = 0; render(); }
function showDialog(title, body, wide = false) {
  if (!$('#dialog').open) currentDialogResult = null; const dialog = $('#dialog'); dialog.classList.toggle('wide',wide); dialog.innerHTML = `<div class="dialog-header"><h2 id="dialog-title">${title}</h2><button class="icon-button" data-action="close-dialog" aria-label="閉じる">${icon('close')}</button></div><div class="dialog-body">${body}</div>`;
  dialog.showModal();
}
function scoreContent(r) { return `<div class="score-summary"><div class="score-ring" style="--score:${r.score}"><div><strong>${r.score}</strong><span>/ 100</span></div></div><div><span class="label-orange">${r.score >= 70 ? 'お題クリア' : '今回のフィードバック'}</span><h3>${r.score >= 70 ? '具体的な指示が書けています' : 'もう一歩、条件を具体的に'}</h3><p>ルール採点 ・ 70点以上でクリア</p></div></div><div class="dimension-list">${r.dimensions.map(d => `<div><div class="dimension-label"><span>${esc(d.label)}</span><strong>${d.score} / ${d.max || 20}</strong></div><div class="dimension-track"><i style="width:${d.score/(d.max||20)*100}%"></i></div><p>${esc(d.feedback)}</p></div>`).join('')}</div><div class="feedback-columns"><section><h3>${icon('check')} できていること</h3>${r.strengths.map(t => `<p>${esc(t)}</p>`).join('')}</section><section><h3>${icon('pen')} 次に改善すること</h3>${r.improvements.map(t => `<p>${esc(t)}</p>`).join('')}</section></div><details class="improved-prompt"><summary>改善のためのプロンプト例 ${icon('chevron')}</summary><pre>${esc(r.improvedPrompt)}</pre><button class="secondary-button" data-action="copy-improved">${icon('copy')} コピー</button></details><p class="disclaimer">${esc(r.disclaimer || 'スコアは指示の具体性を確認するための目安です。成果物の品質を保証するものではありません。')}</p>`; }
function renderInlineResult(r) { const el = $('#feedback-inline'); if (!el) return; el.hidden = false; el.innerHTML = `<div class="section-heading"><h2>フィードバック</h2><span class="soft-badge">ルール採点</span></div>${scoreContent(r)}<div class="result-actions"><button class="secondary-button" data-action="retry">${icon('pen')} 書き直す</button><button class="primary-button" data-action="ai">${icon('spark')} AIコーチに相談</button></div><div id="ai-feedback" class="ai-feedback" hidden></div>`; }
async function submit() {
  if (state.busy) return; const text = $('#prompt-input')?.value.trim(); if (!text || text.length < 10) return toast('10文字以上で入力してみましょう。');
  saveDraft(); state.busy = true; $('#submit-button').disabled = true;
  const r = evaluatePrompt(text,scenario());
  const entry = { id: crypto.randomUUID(), date: new Date().toISOString(), scenarioId: scenario().id, mode: state.mode, score: r.score, prompt: text };
  history.unshift(entry); history = history.slice(0,100); persist('history',history); state.result = r;
  if (state.mode === 'roleplay') {
    roleMessages.push({ role: 'user', text });
    const followups = scenario().followups || [];
    const next = followups[state.roleIndex];
    roleMessages.push({ role: 'client', text: next?.question || 'ありがとうございます。条件を整理できました。この提案の確認方法も、最後に具体的に伝えてください。' });
    state.roleIndex += 1;
  }
  state.busy = false; render();
  $('#coach-bubble').textContent = r.score >= 70 ? 'お題クリア！条件が具体的になったね。別のお題にも挑戦してみよう。' : '書けたね！フィードバックで、次に足す条件を1つ選んでみよう。';
  $('#feedback-inline')?.focus({preventScroll:true});
  $('#feedback-inline')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  toast('フィードバックと練習記録を保存しました');
}
async function askAI() {
  if (state.busy) return;
  showDialog('AIコーチに相談', `<div class="ai-consent">${mascot(true)}<p>現在のお題と入力内容を<strong>Cloudflare Workers AI</strong>に送り、改善の助言を受け取ります。</p><p>実在の個人情報や機密情報は入力しないでください。</p><div class="dialog-actions"><button class="secondary-button" data-action="close-dialog">戻る</button><button class="primary-button" data-action="confirm-ai">送信して相談する ${icon('arrow')}</button></div></div>`);
}
async function sendAI() {
  $('#dialog').close(); const el = $('#ai-feedback'); if (!el) return;
  state.busy = true; el.hidden = false; el.innerHTML = '<div class="ai-pending" role="status"><div class="skeleton"></div><div class="skeleton"></div><span>AIコーチが確認しています…</span></div>';
  const requestVersion=++aiRequestVersion; const controller = aiRequestController = new AbortController(); const timeout = setTimeout(() => controller.abort(),25000);
  try {
    const response = await fetch('/api/coach', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({scenarioId:scenario().id,prompt:draft(),kind:state.mode === 'roleplay' ? 'roleplay' : 'review'}),signal:controller.signal });
    const data = await response.json().catch(()=>({error:'AIコーチのAPIに接続できません。公開設定を確認してください。'})); if(requestVersion!==aiRequestVersion)return; if (!response.ok) throw new Error(data.error || 'AIコーチに接続できませんでした。');
    el.innerHTML = `<strong>${icon('spark')} AIコーチ · Workers AI</strong><p>${esc(data.feedback)}</p>`;
  } catch (error) { if(requestVersion!==aiRequestVersion)return; el.innerHTML = `<strong>AIコーチを利用できません</strong><p>${esc(error.name === 'AbortError' ? '応答に時間がかかっています。時間をおいて再試行してください。' : error.message)}</p><button class="text-button" data-action="ai">もう一度試す ${icon('arrow')}</button>`; }
  finally { clearTimeout(timeout); if(requestVersion===aiRequestVersion){aiRequestController=null;state.busy = false; updateLive();} }
}
async function copy(text) { try { await navigator.clipboard.writeText(text); toast('コピーしました'); } catch { showDialog('コピーするテキスト',`<textarea class="copy-text" readonly aria-label="コピーするテキスト">${esc(text)}</textarea><p>テキストを選択し、コピーしてください。</p>`); $('.copy-text')?.select(); } }
function stopSpeaking() { if (state.speaking) window.speechSynthesis?.cancel(); state.speaking = false; document.querySelector('.mascot')?.classList.remove('speaking'); }
function speak() {
  if (state.speaking) return stopSpeaking();
  if (!('speechSynthesis' in window)) return toast('このブラウザは読み上げに対応していません。');
  const utterance = new SpeechSynthesisUtterance($('#coach-bubble')?.textContent || scenario().brief); utterance.lang = 'ja-JP'; utterance.rate = 1;
  state.speaking = true; document.querySelector('.mascot')?.classList.add('speaking');
  utterance.onend = stopSpeaking; utterance.onerror = event => { stopSpeaking(); if(!['canceled','interrupted'].includes(event.error)){console.warn('[PromptLab speech]',event.error);toast(event.error==='not-allowed'?'このサイトの音声再生を許可してから、もう一度押してください。':'この環境では読み上げを再生できません。コーチの説明はテキストで確認できます。');} }; try {speechSynthesis.speak(utterance);} catch {stopSpeaking();toast('読み上げを開始できませんでした。');}
}
function stopRecording() { speechController?.stop(); state.recording=false; }
function startRecording() {
  if (state.recording) { stopRecording(); return; }
  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Speech) return showDialog('音声入力について','<p>このブラウザはアプリ内の音声入力に対応していません。OSの音声入力を使うか、テキストで練習できます。</p>');
  showDialog('音声入力を開始', '<p>ブラウザにマイクの使用を許可すると、日本語の音声を文字に変換します。音声はブラウザ提供元の音声認識サービスに送信される場合があります。</p><p>固有名詞や機密情報は話さず、誤変換を確認してから提出してください。</p><button class="primary-button" data-action="confirm-mic">音声入力を始める</button>');
}
function record() {
  $('#dialog').close();
  stopRecording();
  const scenarioId = state.scenarioId;
  speechController = createSpeechController({
    Recognition: window.SpeechRecognition || window.webkitSpeechRecognition,
    onState(phase) {
      state.recording = phase !== 'idle';
      const button = $('#mic-button'), note = $('#speech-note');
      if(button) { button.classList.toggle('recording',state.recording); button.innerHTML=`${icon('mic')} ${state.recording?'停止する':'音声入力'}`; }
      if(note) { note.hidden=false; note.textContent=phase==='starting'?'マイクに接続しています…':phase==='listening'?'音声入力中です。停止後に誤変換を確認してください。':'音声入力を停止しました。誤変換を確認してください。'; }
    },
    onText(text) { const input=$('#prompt-input'); if(input) {input.value=text;saveDraft();} },
    onError(error) { toast(error==='not-allowed'?'マイクの許可がありません。テキスト入力で練習できます。':error==='start-failed'?'音声入力を開始できませんでした。':'音声を認識できませんでした。テキスト入力も利用できます。'); },
  });
  speechController.start(draft(),()=>state.scenarioId===scenarioId&&state.page==='practice');
}
function about() { showDialog('使い方・技術について', `<div class="about-content"><h3>練習の流れ</h3><ol><li>テーマとお題を選びます。</li><li>キラーワードの意味・使用例を確認し、プロンプトを書きます。</li><li>フィードバックを見て書き直します。70点以上でクリアです。</li></ol><h3>ロールプレイ</h3><p>依頼者の相談に提案すると、追加の質問が届きます。教材に沿った対話です。自由な助言は「AIコーチに相談」で利用できます。</p><h3>採点と保存</h3><p>5軸のルール採点をブラウザで実行。キラーワードの数だけでは高得点になりません。入力・履歴・保存ワードはこの端末のブラウザに保存します。サイトデータを消すと記録も消えるため、必要に応じて書き出してください。</p><h3>技術選定</h3><dl><dt>JavaScript ES Modules</dt><dd>追加の実行ライブラリを使わず、初期表示と動作を軽くするため。</dd><dt>CSS / SVG</dt><dd>キャラクター、スケルトン、操作アニメーションを軽量に実現。動きを減らすOS設定にも対応。</dd><dt>Cloudflare Workers + Static Assets</dt><dd>画面とAPIを同じ場所で配信し、構成と保守を簡単にするため。</dd><dt>Workers AI</dt><dd>別会社のAI用APIキーを使わず、Cloudflareの接続でコーチ機能を提供するため。無料枠・利用制限のあるサービスです。</dd><dt>Web Speech API</dt><dd>音声入力・読み上げに利用。対応ブラウザと権限に依存します。</dd><dt>キラーワードの収集</dt><dd>キラーワード集の「ワードを追加」から意味・例文・参考URLを保存できます。「このお題で練習」で出題画面に追加します。</dd><dt>localStorage</dt><dd>自分用の記録を端末に残すため。ログインとパスワードの管理を不要にしています。</dd><dt>Node.js標準テスト / GitHub</dt><dd>外部のテスト依存を減らし、検証と変更履歴を再現できるようにするため。</dd></dl><p class="disclaimer">CloudflareのAIへの送信は相談ボタンの確認後のみ。通常の採点は外部に送信しません。</p></div>`,true); }
function showWordForm(word) {
  const labels=['共通',...categories.map(c=>c.label)];
  showDialog(word?'ワードを編集':'ワードを追加',`<form id="word-form" data-edit-id="${esc(word?.id||'')}"><div id="word-errors" role="alert"></div><label>キラーワード<input aria-label="キラーワード" name="term" maxlength="80" required value="${esc(word?.term||'')}" placeholder="例：Progressive Disclosure"></label><label>テーマ<select aria-label="テーマ" name="category">${labels.map(label=>`<option ${word?.category===label?'selected':''}>${esc(label)}</option>`).join('')}</select></label><label>意味・使う場面<textarea aria-label="意味・使う場面" name="meaning" maxlength="600" required placeholder="どんな場面で使えるか、自分の言葉で記録">${esc(word?.meaning||'')}</textarea></label><label>プロンプトの例文<textarea aria-label="プロンプトの例文" name="example" maxlength="1200" required placeholder="実際にAIへ伝えるときの指示文">${esc(word?.example||'')}</textarea></label><label>参考URL（任意）<input aria-label="参考URL（任意）" name="source" type="url" value="${esc(word?.source||'')}" placeholder="https://..."></label><div class="dialog-actions"><button type="button" class="secondary-button" data-action="close-dialog">戻る</button><button type="submit" class="primary-button">ワードを保存 ${icon('check')}</button></div></form>`);
}
document.addEventListener('submit',event=>{
  if(event.target.id!=='word-form')return;event.preventDefault();const form=event.target;const data=Object.fromEntries(new FormData(form));const editId=form.dataset.editId||null;
  const checked=validateCustomWord(data,keywords,editId);
  if(!checked.ok){$('#word-errors').textContent=checked.errors.join(' ');return;}
  if(!editId&&customWords.length>=100){$('#word-errors').textContent='追加できるワードは100件までです。';return;}
  if(editId){const i=keywords.findIndex(k=>k.id===editId);if(i>=0)keywords[i]=checked.word;customWords=customWords.map(k=>k.id===editId?checked.word:k);}else{keywords.push(checked.word);customWords.push(checked.word);}
  persist('customWords',customWords);state.query=checked.word.term;state.onlyFavorites=false;$('#dialog').close();render();toast('ワードを保存しました');
});
document.addEventListener('input', event => {
  if(event.target.id==='prompt-input') {saveDraft(); return;}
  if(event.target.id==='keyword-search') { const cursor=event.target.selectionStart; state.query=event.target.value; const temp=document.createElement('div');temp.innerHTML=library();$('#library-results').replaceWith($('#library-results',temp)); const field=$('#keyword-search');field.focus(); if(field.type!=='search') field.setSelectionRange(cursor,cursor); }
});
document.addEventListener('change', event => {
  if(event.target.id==='level') {state.level=event.target.value; const list=scenarios.filter(s=>s.category===state.category&&(state.level==='すべて'||s.level===state.level)); if(list.length&&!list.some(s=>s.id===state.scenarioId))resetScenario(list[0].id);else render();}
  if(event.target.id==='history-category') {state.recordCategory=event.target.value;render();}
});
document.addEventListener('keydown',event=>{ if((event.metaKey||event.ctrlKey)&&event.key==='Enter'&&state.page==='practice'&&!$('#dialog').open){event.preventDefault();submit();} });
document.addEventListener('click',event=>{
  const button=event.target.closest('button,a.brand'); if(!button)return;
  if(button.dataset.page) {state.page=button.dataset.page;state.query='';render();window.scrollTo({top:0});return;}
  if(button.matches('a.brand')) {event.preventDefault();state.page='practice';render();return;}
  if(button.dataset.category) {state.category=button.dataset.category;state.level='すべて';resetScenario(scenarios.find(s=>s.category===state.category).id);return;}
  if(button.dataset.scenario) {resetScenario(button.dataset.scenario);return;}
  if(button.dataset.mode) {state.mode=button.dataset.mode;state.result=null;roleMessages=[];state.roleIndex=0;render();return;}
  if(button.dataset.insert) {const k=byId(button.dataset.insert);const input=$('#prompt-input');if(input){input.value=(input.value+(input.value?'\n':'')+k.example).slice(0,8000);saveDraft();input.focus();toast('例文を追加しました。お題に合わせて書き換えてみましょう。');}return;}
  if(button.dataset.favorite) {const id=button.dataset.favorite;favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];persist('favorites',favorites);button.classList.toggle('saved',favorites.includes(id));button.setAttribute('aria-pressed',String(favorites.includes(id)));button.setAttribute('aria-label',`${byId(id).term}を${favorites.includes(id)?'保存解除':'保存'}`);if(state.page==='library')render();toast(favorites.includes(id)?'ワードを保存しました':'ワードの保存を解除しました');return;}
  if(button.dataset.useKeyword){const s=scenario();const list=Array.isArray(scenarioExtras[s.id])?scenarioExtras[s.id]:[];scenarioExtras[s.id]=[...new Set([...list,button.dataset.useKeyword])];persist('scenarioExtras',scenarioExtras);state.page='practice';render();toast('今回のお題のキラーワードに追加しました');return;}
  if(button.dataset.editWord){showWordForm(byId(button.dataset.editWord));return;}
  if(button.dataset.copyKeyword) {copy(byId(button.dataset.copyKeyword).example);return;}
  if(button.dataset.record) {const h=history.find(h=>h.id===button.dataset.record);const recordResult=evaluatePrompt(h.prompt,scenarios.find(s=>s.id===h.scenarioId));currentDialogResult=recordResult;showDialog(esc(scenarios.find(s=>s.id===h.scenarioId).title),`<div class="record-prompt"><h3>提出したプロンプト</h3><pre>${esc(h.prompt)}</pre></div>${scoreContent(recordResult)}`,true);currentDialogResult=recordResult;return;}
  switch(button.dataset.action){
    case 'submit':submit();break;
    case 'add-word':showWordForm();break;
    case 'close-dialog':$('#dialog').close();break;
    case 'copy-draft':copy(draft());break;
    case 'copy-improved':copy(($('#dialog').open?currentDialogResult:state.result)?.improvedPrompt||'');break;
    case 'sample':showDialog('回答例',`<p class="disclaimer">ひとつの例です。自分の言葉で条件を変えて練習してみましょう。</p><pre class="sample-prompt">${esc(scenario().samplePrompt)}</pre><button class="secondary-button" data-action="copy-sample">${icon('copy')} 回答例をコピー</button>`,true);break;
    case 'copy-sample':copy(scenario().samplePrompt);break;
    case 'retry':$('#prompt-input')?.focus();$('#prompt-input')?.scrollIntoView({behavior:'smooth',block:'center'});break;
    case 'speak':speak();break;
    case 'mic':startRecording();break;
    case 'confirm-mic':record();break;
    case 'ai':askAI();break;
    case 'confirm-ai':sendAI();break;
    case 'favorites':state.onlyFavorites=!state.onlyFavorites;render();break;
    case 'about':about();break;
    case 'export':{const blob=new Blob([JSON.stringify({app:'プロンプトラボ',version:1,exportedAt:new Date().toISOString(),history,favorites,customWords,scenarioExtras,drafts},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`prompt-lab-${new Date().toLocaleDateString('sv-SE')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('練習記録を書き出しました');break;}
  }
});
window.addEventListener('pagehide',()=>{stopRecording();stopSpeaking();clearInterval(timerId);});
try { render(); } catch { $('#app').innerHTML='<main><h1>画面を表示できませんでした</h1><p>ページを再読み込みしてください。保存済みの練習内容は保持されます。</p></main>'; }
requestAnimationFrame(()=>{$('#loading').classList.add('loaded');setTimeout(()=>$('#loading').remove(),300);});
timerId=setInterval(()=>{const now=Date.now();if(state.page==='practice'&&!document.hidden&&draft().length)elapsed+=Math.min(Math.floor((now-lastTick)/1000),2);lastTick=now;if($('#practice-timer'))$('#practice-timer').textContent=formatTime(elapsed);},1000);
fetch('/api/health').then(r=>r.json()).then(data=>{state.aiConnected=Boolean(data.aiConnected);}).catch(()=>{});
