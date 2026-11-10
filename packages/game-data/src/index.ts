export type Prompt = { id: string; text: string; reading: string; romaji: string[]; category: string };

const kanaRomaji: Record<string, string[]> = {
  あ:['a'],い:['i'],う:['u'],え:['e'],お:['o'],か:['ka'],き:['ki'],く:['ku'],け:['ke'],こ:['ko'],さ:['sa'],し:['shi','si'],す:['su'],せ:['se'],そ:['so'],た:['ta'],ち:['chi','ti'],つ:['tsu','tu'],て:['te'],と:['to'],な:['na'],に:['ni'],ぬ:['nu'],ね:['ne'],の:['no'],は:['ha'],ひ:['hi'],ふ:['fu','hu'],へ:['he'],ほ:['ho'],ま:['ma'],み:['mi'],む:['mu'],め:['me'],も:['mo'],や:['ya'],ゆ:['yu'],よ:['yo'],ら:['ra'],り:['ri'],る:['ru'],れ:['re'],ろ:['ro'],わ:['wa'],を:['wo'],ん:['n','nn'],が:['ga'],ぎ:['gi'],ぐ:['gu'],げ:['ge'],ご:['go'],ざ:['za'],じ:['ji','zi'],ず:['zu'],ぜ:['ze'],ぞ:['zo'],だ:['da'],ぢ:['ji','di'],づ:['zu','du'],で:['de'],ど:['do'],ば:['ba'],び:['bi'],ぶ:['bu'],べ:['be'],ぼ:['bo'],ぱ:['pa'],ぴ:['pi'],ぷ:['pu'],ぺ:['pe'],ぽ:['po'],きゃ:['kya'],きゅ:['kyu'],きょ:['kyo'],しゃ:['sha','sya'],しゅ:['shu','syu'],しょ:['sho','syo'],ちゃ:['cha','tya','cya'],ちゅ:['chu','tyu','cyu'],ちょ:['cho','tyo','cyo'],にゃ:['nya'],にゅ:['nyu'],にょ:['nyo'],ひゃ:['hya'],ひゅ:['hyu'],ひょ:['hyo'],みゃ:['mya'],みゅ:['myu'],みょ:['myo'],りゃ:['rya'],りゅ:['ryu'],りょ:['ryo'],ぎゃ:['gya'],ぎゅ:['gyu'],ぎょ:['gyo'],じゃ:['ja','jya','zya'],じゅ:['ju','jyu','zyu'],じょ:['jo','jyo','zyo'],びゃ:['bya'],びゅ:['byu'],びょ:['byo'],ぴゃ:['pya'],ぴゅ:['pyu'],ぴょ:['pyo'],ふぁ:['fa'],ふぃ:['fi'],ふぇ:['fe'],ふぉ:['fo'],てぃ:['thi','texi'],でぃ:['dhi','dexi'],うぃ:['wi'],うぇ:['we'],うぉ:['who'],ー:['-']
};

function readingVariants(reading: string): string[] {
  let variants = [''];
  for (let i = 0; i < reading.length;) {
    if (reading[i] === 'っ') {
      const next = readingVariants(reading.slice(i + 1))[0] ?? '';
      const consonant = next[0];
      const choices = consonant && !'aeiou'.includes(consonant) ? [consonant, 'xtu', 'ltu'] : ['xtu', 'ltu'];
      variants = variants.flatMap((prefix) => choices.map((choice) => prefix + choice)); i++; continue;
    }
    const kana = reading.slice(i, i + 2);
    const key = kanaRomaji[kana] ? kana : reading[i];
    const choices = kanaRomaji[key] ?? [key];
    variants = variants.flatMap((prefix) => choices.map((choice) => prefix + choice));
    i += key.length;
  }
  return [...new Set(variants)];
}

export const balancedPrompts: Prompt[] = [
  { id: 'p1', text: '風を切り裂け', reading: 'かぜをきりさけ', romaji: ['kazewokirisake'], category: '冒険' },
  { id: 'p2', text: '星の彼方へ', reading: 'ほしのかなたへ', romaji: ['hoshinokanatahe', 'hoshinokanatae'], category: '宇宙' },
  { id: 'p3', text: '勝利をつかめ', reading: 'しょうりをつかめ', romaji: ['shouriwotsukame', 'syouriwotsukame', 'shoriwotsukame', 'syoriwotsukame', 'shouriwotukame', 'syouriwotukame'], category: 'バトル' },
  { id: 'p4', text: '静かな森の奥', reading: 'しずかなもりのおく', romaji: ['shizukanamorinooku', 'sizukanamorinooku'], category: '自然' },
  { id: 'p5', text: '光速の剣', reading: 'こうそくのけん', romaji: ['kousokunoken', 'koosokunoken'], category: '武器' },
  { id: 'p6', text: '未来を切り開く', reading: 'みらいをきりひらく', romaji: ['miraiwokirihiraku', 'miraiokirihiraku'], category: '冒険' },
  { id: 'p7', text: '炎の守護者', reading: 'ほのおのしゅごしゃ', romaji: ['honoonoshugosha', 'honoonosyugosya', 'honoonoshugosya', 'honoonosyugosha'], category: 'バトル' },
  { id: 'p8', text: '月明かりの道', reading: 'つきあかりのみち', romaji: ['tsukiakarinomichi', 'tukiakarinomiti', 'tsukiakarinomiti', 'tukiakarinomichi'], category: '自然' }
];

export const INITIAL_RATING = 500;
export const PLACEMENT_MATCHES = 5;

export const rankTiers = [
  { min: 0, name: 'ルーキー' },
  { min: 250, name: 'ブロンズ' },
  { min: 500, name: 'シルバー' },
  { min: 750, name: 'ゴールド' },
  { min: 1000, name: 'プラチナ' },
  { min: 1250, name: 'プロ' },
  { min: 1500, name: 'タイプマスター' },
  { min: 1750, name: 'タイプキング' },
] as const;

/** Rating thresholds are lower-inclusive; placements have no rank yet. */
export function rankName(rating: number, placementMatches: number, leaderboardPosition?: number | null): string {
  if (placementMatches < PLACEMENT_MATCHES) return '未認定';
  const tier = [...rankTiers].reverse().find((entry) => rating >= entry.min) ?? rankTiers[0];
  return tier.name === 'タイプキング' && leaderboardPosition != null ? `${tier.name} #${leaderboardPosition}` : tier.name;
}

export type CharacterId = 'balanced' | 'long' | 'word' | 'mage-long' | 'mage-word';
export type GrowthStat = 'attack' | 'defense' | 'magicAttack' | 'magicDefense';
export type GrowthLevels = Record<GrowthStat, number>;
export const MAX_GROWTH_LEVEL = 10;
export const MAX_MP = 30;
export const SPELL_COST = 10;
export const SPELL_COOLDOWN_MS = 2500;
export const MP_ON_COMPLETE = 3;
export type CharacterDefinition = {
  name: string; description: string; damageMultiplier: number; price: number;
  promptType: 'balanced' | 'long' | 'word'; attackType: 'physical' | 'magic';
  baseMagicAttack: number; baseMagicDefense: number;
};
export const characters: Record<CharacterId, CharacterDefinition> = {
  balanced: { name: '勇者', description: 'バランスのよい問題とダメージ', damageMultiplier: 1, price: 3000, promptType: 'balanced', attackType: 'physical', baseMagicAttack: 12, baseMagicDefense: 2 },
  long: { name: '炎の戦士', description: '長文を打ち切ると大ダメージ', damageMultiplier: 1.8, price: 3000, promptType: 'long', attackType: 'physical', baseMagicAttack: 12, baseMagicDefense: 2 },
  word: { name: '疾風の剣士', description: '単語だけ出題されるがダメージは低い', damageMultiplier: 0.55, price: 3000, promptType: 'word', attackType: 'physical', baseMagicAttack: 12, baseMagicDefense: 2 },
  'mage-long': { name: '星詠みの魔導士', description: '長文を打ち切ると強力な魔法攻撃', damageMultiplier: 1.8, price: 3000, promptType: 'long', attackType: 'magic', baseMagicAttack: 22, baseMagicDefense: 8 },
  'mage-word': { name: '閃光の魔術師', description: '単語だけの魔法攻撃。威力は低め', damageMultiplier: 0.55, price: 3000, promptType: 'word', attackType: 'magic', baseMagicAttack: 22, baseMagicDefense: 8 },
};
export function isCharacterId(value: unknown): value is CharacterId {
  return typeof value === 'string' && Object.hasOwn(characters, value);
}
export function characterDamage(base: number, character: CharacterId): number {
  return Math.max(1, Math.round(base * characters[character].damageMultiplier));
}
export function magicAttackValue(character: CharacterId, level = 0): number {
  return characters[character].baseMagicAttack + level * 2;
}
export function magicDefenseValue(character: CharacterId, level = 0): number {
  return characters[character].baseMagicDefense + level;
}
export function mitigateMagic(power: number, defense: number): number {
  return Math.max(1, Math.round(power - defense * 0.6));
}
/** Completed prompts use a character's attack type; spell casts always deal magic damage. */
export function promptDamage(base: number, character: CharacterId, attackLevel: number, magicAttackLevel: number, targetDefense: number, targetMagicDefense: number): number {
  if (characters[character].attackType === 'magic') {
    const power = characterDamage(base + magicAttackValue(character, magicAttackLevel) - 12, character);
    return mitigateMagic(power, targetMagicDefense);
  }
  return Math.max(1, characterDamage(base + attackLevel * 2, character) - targetDefense);
}
export function spellDamage(character: CharacterId, magicAttackLevel: number, targetMagicDefense: number): number {
  return mitigateMagic(12 + magicAttackValue(character, magicAttackLevel) / 2, targetMagicDefense);
}
const longPrompts: Prompt[] = [
  { id: 'long1', text: '青い空を見上げて未来への道を進もう', reading: 'あおいそらをみあげてみらいへのみちをすすもう', romaji: ['aoisorawomiagetemiraihenomichiwosusumou'], category: '長文' },
  { id: 'long2', text: '仲間と力を合わせて大きな夢をかなえよう', reading: 'なかまとちからをあわせておおきなゆめをかなえよう', romaji: ['nakamatochikarawoawaseteookinayumewokanaeyou'], category: '長文' },
  { id: 'long3', text: '静かな森を抜けると光の海が広がる', reading: 'しずかなもりをぬけるとひかりのうみがひろがる', romaji: ['shizukanamoriwonukerutohikarinoumigahirogaru', 'sizukanamoriwonukerutohikarinoumigahirogaru'], category: '長文' },
  { id: 'long4', text: '新しい世界へ向かって勇気を出して進む', reading: 'あたらしいせかいへむかってゆうきをだしてすすむ', romaji: ['atarashiisekaihemukatteyuukiwodashitesusumu', 'atarasiisekaihemukatteyuukiwodasitesusumu'], category: '長文' },
];
const wordPrompts: Prompt[] = [
  { id: 'word1', text: '空', reading: 'そら', romaji: ['sora'], category: '単語' },
  { id: 'word2', text: '剣', reading: 'けん', romaji: ['ken'], category: '単語' },
  { id: 'word3', text: '光', reading: 'ひかり', romaji: ['hikari'], category: '単語' },
  { id: 'word4', text: '勇気', reading: 'ゆうき', romaji: ['yuuki'], category: '単語' },
  { id: 'word5', text: '魔法', reading: 'まほう', romaji: ['mahou'], category: '単語' },
  { id: 'word6', text: '星', reading: 'ほし', romaji: ['hoshi', 'hosi'], category: '単語' },
  { id: 'word7', text: '未来', reading: 'みらい', romaji: ['mirai'], category: '単語' },
  { id: 'word8', text: '風', reading: 'かぜ', romaji: ['kaze'], category: '単語' },
];
export const prompts: Prompt[] = [...balancedPrompts, ...longPrompts, ...wordPrompts];
export function promptsForCharacter(character: CharacterId): Prompt[] {
  const type = characters[character].promptType;
  return type === 'long' ? longPrompts : type === 'word' ? wordPrompts : balancedPrompts;
}

for (const prompt of prompts) prompt.romaji = [...new Set([...prompt.romaji, ...readingVariants(prompt.reading)])];

/** Fisher-Yates shuffle; returns a new array. */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export { armorItems, equipmentItems, findArmor, findWeapon, getRarityLabel, itemRarities, rarityInfo, weaponItems } from './items.js';
export type { ArmorStyle, EquipmentItem, EquipmentSlot, ItemRarity, WeaponStyle } from './items.js';
