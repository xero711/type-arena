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
