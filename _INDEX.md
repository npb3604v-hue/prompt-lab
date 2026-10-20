---
title: プロンプトラボ
tags: [プロダクト, プロンプト訓練]
created: 2026-10-20
updated: 2026-10-21
---

# プロンプトラボ

PC向けのテーマ別プロンプト練習アプリ。キラーワード、ロールプレイ、入力改善、練習履歴を扱う。

- [公開アプリ](https://prompt-lab.n-pb360-4v.workers.dev/)
- [GitHub](https://github.com/npb3604v-hue/prompt-lab)
- 検証完了（2026-10-21）：自動38件合格、全18題の本番ブラウザ操作、実Workers AI、利用者端末での音声入力・読み上げを確認。[検証記録](docs/検証記録.md)

- `public/` : フロントエンドと教材
- `src/` : Cloudflare Workerとローカル実行環境
- `tests/` : 採点・APIの自動検証
- `docs/` : 技術選定・操作検証の記録
- `README.md` : 実行・公開手順
