/** Web Speech APIの非同期イベントを、画面やお題の切替後に反映しないための制御。 */
export function createSpeechController({ Recognition, onText, onState, onError, maxLength = 8000 }) {
  let recognition = null;
  let generation = 0;
  let phase = 'idle';
  function release(abort, notify) {
    generation++;
    const instance = recognition;
    recognition = null;
    const active = phase !== 'idle';
    phase = 'idle';
    if (instance) {
      instance.onstart = instance.onresult = instance.onerror = instance.onend = null;
      if (abort) { try { instance.abort(); } catch {} }
    }
    if (active && notify) onState?.('idle');
  }
  return {
    get phase() { return phase; },
    stop() { release(true, true); },
    start(baseText = '', isCurrent = () => true) {
      release(true, false);
      const session = generation;
      const current = () => session === generation && isCurrent();
      phase = 'starting';
      onState?.(phase);
      try {
        if (typeof Recognition !== 'function') throw new Error('unsupported');
        const instance = recognition = new Recognition();
        instance.lang = 'ja-JP';
        instance.continuous = true;
        instance.interimResults = true;
        instance.onstart = () => {
          if (!current()) return;
          phase = 'listening';
          onState?.(phase);
        };
        instance.onresult = event => {
          if (!current()) return;
          // resultsはセッション全体のスナップショット。最終結果が再通知されても重複追加しない。
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0]?.transcript || '';
          onText?.((String(baseText) + (baseText ? '\n' : '') + transcript).slice(0, maxLength));
        };
        instance.onerror = event => {
          if (!current()) return;
          release(true, true);
          onError?.(event.error || 'unknown');
        };
        instance.onend = () => { if (current()) release(false, true); };
        instance.start();
      } catch (error) {
        release(true, true);
        onError?.(error.message === 'unsupported' ? 'unsupported' : 'start-failed');
      }
    },
  };
}
