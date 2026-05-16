## Summary

<!-- 1〜3 行で何を/なぜ -->

## Type

- [ ] feat — 新機能
- [ ] fix — バグ修正
- [ ] refactor — 振る舞い不変
- [ ] docs / chore / ci

## Verification

- [ ] frontend: `npm run build` と `tsc --noEmit` が通る
- [ ] backend: `ruff check` / `mypy app` / `pytest -q` が通る
- [ ] スクリーンショット / 動作確認動画（UI 変更時）

## Risk / Rollback

<!-- 影響範囲、ロールバック手順 -->

## Checklist

- [ ] CHANGELOG / docs 更新が必要なら反映済
- [ ] 認証/認可/DB スキーマ/並列処理を触っているなら `/codex:adversarial-review` を実施
- [ ] Critical / High 指摘は同 PR で解消
