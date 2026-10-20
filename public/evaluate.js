import { keywords } from './catalog.js';

const normalize = (value) => String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const has = (text, pattern) => pattern.test(text);

/** 端末内のルール評価。意味理解や成果物の品質を保証するAI採点ではありません。 */
export function evaluatePrompt(input, scenario, allKeywords = keywords) {
  const text = normalize(input).slice(0, 16000);
  const expected = (scenario?.keywordIds ?? []).filter((id) => allKeywords.some((item) => item.id === id));
  const matched = expected.filter((id) => {
    const keyword = allKeywords.find((item) => item.id === id);
    return [keyword.term, ...(keyword.aliases ?? [])].some((term) => text.includes(normalize(term)));
  });
  const missing = expected.filter((id) => !matched.includes(id));
  // 指示を伴わない用語の羅列や、同じ文章の繰返しに加点しない。
  const knownTerms = new Set(allKeywords.flatMap((item) => [item.term, ...(item.aliases ?? [])]).map(normalize));
  const prose = text.split(/[、,;；。！？!?\n]/).map((part) => part.trim()).filter((part) => part && !knownTerms.has(part));
  const unique = [...new Set(prose)].join('。');
  const requests = (unique.match(/(?:してください|して下さい|してほしい|したい|作って|まとめて|示して|付けて|含めて|書いて|出して|すること|にする|とする|ください)/g) ?? []).length;
  const directive = requests > 0 || /(?:目的|対象|出力|制約|検証|要件)\s*[:：]/.test(unique);
  const substantive = unique.replace(/[\s、,・\/|:：。]/g, '').length >= 35 && directive;
  const scoreBy = (checks) => substantive ? checks.reduce((sum, [pattern, points]) => sum + (has(unique, pattern) ? points : 0), 0) : 0;
  const axisDefinitions = [
    { label: '目的', checks: [[/(作成|制作|開発|作って|作りたい|作る|まとめ|整理|説明|練習|相手を|仕様書)/, 8], [/(メモ|アプリ|ページ|サイト|スライド|資料|議事録|手順書|仕様書|実行計画|ロールプレイ|ヒアリング|メール|投稿|動画|絵コンテ|構成案|faq|リスト|研修)/, 6], [/(ため|目的|最優先|改善|できる|伝わる|減ら|残す|得る|説明する|案内する|練習)/, 6]], feedback: '何を作り、何をできるようにしたいかを一文で伝えましょう。' },
    { label: '対象・背景', checks: [[/(向け|対象は|対象者|読み手|聞き手|利用者|使う社員|担当者|受講者)/, 8], [/(初めて|初心者|新人|職員|社員|部門長|社外|社内|事務|総務|会社員|個人|欠席|研修|架空)/, 6], [/(pc|スマホ|モバイル|現状|素材|データ|月末|毎月|仕事|会議|30秒|5分|15分|週\d|初参加)/, 6]], feedback: '誰が、どの場面で使うかと、元になる情報を書きましょう。' },
    { label: '出力形式', checks: [[/(出力|形式|構成|画面|配置|見出し|絵コンテ|本文|件名|表に|表と|表形式|一覧|スライド)/, 8], [/(\d+\s*(?:枚|字|項目|見出し|画面|件|手順|秒|分|往復)|表形式|箇条書き|左に|右に|markdown)/, 6], [/(順|分け|以内|まで|各|項目|一覧|確認画面|列は|形式に|見出しに|見出しで)/, 6]], feedback: '表・見出し・画面などの完成形と、量や順序を指定しましょう。' },
    { label: '制約・こだわり', checks: [[/(不要|しない|せず|含めない|限定|最優先|制約|のみ|以内|までに|だけ|減らす設定)/, 8], [/(未確認|推測|失敗|エラー|例外|個人情報|架空|キャッチコピー|口調|丁寧|上書き|google|減らす設定|合格条件)/, 6], [/(再試行|確認|条件|期限|範囲|\d+|最優先|担当|出典|根拠|読みやす|トーン)/, 6]], feedback: '優先したい体験と、してほしくないことを具体的に指定しましょう。' },
    { label: '検証', checks: [[/(テスト|検証|照合|合格条件|成功基準|判定基準|最後に.{0,45}確認|確認してください)/, 8], [/(ブラウザ|手計算|元の|元メモ|元データ|元の資料|元のメモ|素材|測定|合計|文字数|日付|無音|公開前|運用前|テストは|架空データ)/, 6], [/(残る|一致|誤り|矛盾|含まれ|収まる|範囲内|合う|防げ|拒否|誤差|以内|禁止情報|合格|漏れ|伝わる|たどれる)/, 6]], feedback: 'どの操作や資料で、何ができれば合格かを書きましょう。' },
  ];
  const dimensions = axisDefinitions.map((axis) => {
    const score = scoreBy(axis.checks);
    return { label: axis.label, score, max: 20, feedback: score >= 18 ? `${axis.label}の具体的な指示を確認できました。` : axis.feedback };
  });
  let score = dimensions.reduce((sum, item) => sum + item.score, 0);
  // 一行だけにすべての用語を入れても、依頼としての厚みがなければ上限を設ける。
  if (requests < 2) {
    score = Math.min(score, 50);
  }
  // スコアは内訳の合計と常に一致させる。
  if (score < dimensions.reduce((sum, item) => sum + item.score, 0)) {
    const ratio = score / dimensions.reduce((sum, item) => sum + item.score, 0);
    dimensions.forEach((item) => { item.score = Math.floor(item.score * ratio); });
    score = dimensions.reduce((sum, item) => sum + item.score, 0);
  }
  const strengths = dimensions.filter((item) => item.score >= 18).map((item) => item.feedback);
  const improvements = dimensions.filter((item) => item.score < 18).sort((a, b) => a.score - b.score).map((item) => item.feedback);
  if (text && !substantive) improvements.unshift('キラーワードを並べるだけでなく、誰に何を作ってほしいかを文章で書きましょう。');
  const additions = [];
  if (dimensions[0].score < 18) additions.push(`目的：${scenario?.title ?? '作りたい成果物'}を作成してください。達成したいことを具体的に補ってください。`);
  if (dimensions[1].score < 18) additions.push(`対象：${scenario?.client ?? '使う人と利用場面を指定してください。'}`);
  if (dimensions[2].score < 18) additions.push('出力形式：見出し・項目・画面などの完成形と分量を指定してください。');
  if (dimensions[3].score < 18) additions.push(`制約：${scenario?.requirements?.join('。') ?? '最優先にすることと避けたいことを指定してください。'}`);
  if (dimensions[4].score < 18) additions.push('検証：期待する結果を決め、元の情報との照合や実際の操作で確認してください。');
  return {
    score, matched, missing, dimensions, strengths,
    improvements: improvements.length ? improvements : ['具体的な内容は、依頼先や実際の成果物で確かめてみましょう。'],
    improvedPrompt: [String(input ?? '').trim().slice(0, 16000), ...additions].filter(Boolean).join('\n\n'),
    disclaimer: '端末内のルールによる練習用の目安です。キラーワードの一致と指示の具体性を確認します。事実の正しさや成果物の品質は判定しません。',
  };
}
