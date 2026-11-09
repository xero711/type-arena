export type Prompt = { id: string; text: string; reading: string; romaji: string[]; category: string };

export const prompts: Prompt[] = [
  { id: 'p1', text: '風を切り裂け', reading: 'かぜをきりさけ', romaji: ['kazewokirisake'], category: '冒険' },
  { id: 'p2', text: '星の彼方へ', reading: 'ほしのかなたへ', romaji: ['hoshinokanatahe', 'hoshinokanatae'], category: '宇宙' },
  { id: 'p3', text: '勝利をつかめ', reading: 'しょうりをつかめ', romaji: ['shouriwotsukame', 'syouriwotsukame', 'shoriwotsukame', 'syoriwotsukame', 'shouriwotukame', 'syouriwotukame'], category: 'バトル' },
  { id: 'p4', text: '静かな森の奥', reading: 'しずかなもりのおく', romaji: ['shizukanamorinooku', 'sizukanamorinooku'], category: '自然' },
  { id: 'p5', text: '光速の剣', reading: 'こうそくのけん', romaji: ['kousokunoken', 'koosokunoken'], category: '武器' },
  { id: 'p6', text: '未来を切り開く', reading: 'みらいをきりひらく', romaji: ['miraiwokirihiraku', 'miraiokirihiraku'], category: '冒険' },
  { id: 'p7', text: '炎の守護者', reading: 'ほのおのしゅごしゃ', romaji: ['honoonoshugosha', 'honoonosyugosya', 'honoonoshugosya', 'honoonosyugosha'], category: 'バトル' },
  { id: 'p8', text: '月明かりの道', reading: 'つきあかりのみち', romaji: ['tsukiakarinomichi', 'tukiakarinomiti', 'tsukiakarinomiti', 'tukiakarinomichi'], category: '自然' }
];
