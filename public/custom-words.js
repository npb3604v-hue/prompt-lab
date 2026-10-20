const normalizeTerm = (value) => value.normalize('NFKC').trim().toLocaleLowerCase('ja-JP');

/** 入力データの検証のみを行う。HTMLエスケープは描画時に行う。 */
export function validateCustomWord(input, existingWords = [], editingId = null) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['キラーワードの入力形式が正しくありません。'] };
  }
  if (editingId !== null && (typeof editingId !== 'string' || !editingId.trim())) {
    return { ok: false, errors: ['編集するワードのIDが正しくありません。'] };
  }
  const limits = [
    ['term', 'キラーワード', 80],
    ['meaning', '意味・使い方', 600],
    ['example', '使用例', 1200],
    ['category', 'カテゴリ', 40],
  ];
  const values = {};
  for (const [key, label, max] of limits) {
    if (typeof input[key] !== 'string' || !input[key].trim()) {
      errors.push(`${label}を入力してください。`);
    } else {
      values[key] = input[key].trim();
      if (values[key].length > max) errors.push(`${label}は${max}文字以内で入力してください。`);
    }
  }
  let source;
  if (input.source !== undefined && input.source !== null && input.source !== '') {
    if (typeof input.source !== 'string') {
      errors.push('参考URLはhttpまたはhttpsのURLで入力してください。');
    } else if (input.source.trim()) {
      try {
        const url = new URL(input.source.trim());
        if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error('invalid');
        source = url.href;
      } catch {
        errors.push('参考URLはhttpまたはhttpsのURLで入力してください。');
      }
    }
  }
  if (values.term && Array.isArray(existingWords) && existingWords.some((word) =>
    word && typeof word.term === 'string' && word.id !== editingId && normalizeTerm(word.term) === normalizeTerm(values.term)
  )) errors.push('同じキラーワードがすでに登録されています。');
  if (errors.length) return { ok: false, errors };
  const word = {
    id: editingId || `custom-${crypto.randomUUID()}`,
    term: values.term,
    category: values.category,
    meaning: values.meaning,
    example: values.example,
    aliases: [],
    ...(source ? { source } : {}),
    custom: true,
  };
  return { ok: true, errors: [], word };
}
