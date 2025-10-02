# テクスチャ不足チェックリスト

- [ ] `kirdy` — `src/game/characters/Kirdy.ts` の `createKirdy` / `AbilitySystem` で参照される基礎スプライト。`public/assets/images` に実ファイルがなく、能力切り替え時の `setTexture('kirdy', frame)` が失敗する。
- [ ] `kirdy-run` — `src/game/characters/Kirdy.ts` のアニメーション登録で参照されるが、対応PNGやスプライトシートが未配置。
- [ ] `kirdy-jump` — 同上。ジャンプ時アニメーション用に参照されるがアセット欠品。
- [ ] `kirdy-hover` — 同上。ホバリング時アニメーション用だがアセット欠品。
- [ ] `kirdy-inhale` — 同上。吸い込みアニメーション用テクスチャが存在しない。
- [ ] `kirdy-swallow` — 同上。飲み込みアニメーション用テクスチャが未配置。
- [ ] `kirdy-spit` — 同上。吐き出しアニメーション用テクスチャが未配置。
- [ ] `fire-attack` — `src/game/mechanics/AbilitySystem.ts` の火炎能力投射体生成で参照されるが、画像アセット未登録。
- [ ] `ice-attack` — 同モジュールの氷能力投射体テクスチャが未登録。
- [ ] `sword-slash` — 同モジュールのソード能力斬撃エフェクトテクスチャが未登録。
- [ ] `star-bullet` — `src/game/mechanics/SwallowSystem.ts` のスター弾再利用プールで参照されるが、対応スプライトが欠品。
- [ ] `wabble-bee` — `src/game/enemies/index.ts` の Wabble Bee 敵生成で使用するスプライトが存在しない。
- [ ] `dronto-durt` — 同モジュールの Dronto Durt 敵スプライトが未配置。
