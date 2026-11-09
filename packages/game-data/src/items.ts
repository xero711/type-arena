export const itemRarities = ['normal', 'rare', 'super_rare', 'hyper_rare', 'ultimate_rare'] as const;
export type ItemRarity = (typeof itemRarities)[number];
export type EquipmentSlot = 'armor' | 'weapon';
export type ArmorStyle = 'light' | 'leather' | 'mail' | 'plate' | 'robe';
export type WeaponStyle = 'sword' | 'dagger' | 'hammer' | 'staff' | 'bow';

export type EquipmentItem = {
  id: string;
  code: string;
  name: string;
  description: string;
  type: EquipmentSlot;
  rarity: ItemRarity;
  attack: number;
  defense: number;
  primary: string;
  secondary: string;
  accent: string;
  armorStyle?: ArmorStyle;
  weaponStyle?: WeaponStyle;
};

export const rarityInfo: Record<ItemRarity, { label: string; color: string; primary: string; secondary: string; accent: string }> = {
  normal: { label: 'ノーマル', color: '#c9d2df', primary: '#69867a', secondary: '#334f50', accent: '#d5c79b' },
  rare: { label: 'レア', color: '#70c9ff', primary: '#286d9a', secondary: '#193e71', accent: '#8ee5f3' },
  super_rare: { label: 'スーパーレア', color: '#c2a0ff', primary: '#624aa8', secondary: '#302d70', accent: '#f0ce72' },
  hyper_rare: { label: 'ハイパーレア', color: '#ff91ba', primary: '#a63d66', secondary: '#522747', accent: '#ffd07c' },
  ultimate_rare: { label: 'アルティメットレア', color: '#ffe579', primary: '#b47a31', secondary: '#604026', accent: '#fff0a4' },
};

const armorFamilies: { code: string; style: ArmorStyle; names: [string, string, string, string, string]; descriptions: string[] }[] = [
  { code: 'scout', style: 'light', names: ['旅人の胸当て', '蒼銅の軽鎧', '碧竜の軽鎧', '白銀の軽装甲', '創世の軽装甲'], descriptions: ['旅の始まりを守る胸当て。'] },
  { code: 'hide', style: 'leather', names: ['革職人の胴鎧', '砂漠猟師の革装', '夜羽の革鎧', '夜鴉の革鎧', '神話の革鎧'], descriptions: ['しなやかな革で動きやすい。'] },
  { code: 'chain', style: 'mail', names: ['銅縁の鎖帷子', '王都の鎖帷子', '星環の鎖帷子', '天蓋の鎖帷子', '星冠の鎖帷子'], descriptions: ['細かな鎖を編み上げた防具。'] },
  { code: 'guard', style: 'plate', names: ['野営兵の板金鎧', '青紋の騎士鎧', '蒼天騎士の鎧', '光耀の騎士鎧', '世界守りの鎧'], descriptions: ['正面からの攻撃に強い板金鎧。'] },
  { code: 'robe', style: 'robe', names: ['旅祈りのローブ', '星読みの衣', '精霊王の法衣', '天空の法衣', '永劫の法衣'], descriptions: ['魔力を織り込んだ軽やかな法衣。'] },
];

const weaponFamilies: { code: string; style: WeaponStyle; names: [string, string, string, string, string]; descriptions: string[] }[] = [
  { code: 'sword', style: 'sword', names: ['兵士の鉄剣', '蒼刃の騎士剣', '竜鱗の剣', '聖銀の剣', '創世の聖剣'], descriptions: ['まっすぐな刃を持つ片手剣。'] },
  { code: 'dagger', style: 'dagger', names: ['狩人の短剣', '蒼刃の短剣', '竜牙の双短剣', '星影の暗殺刃', '世界影の神短剣'], descriptions: ['素早く振れる短い刃。'] },
  { code: 'hammer', style: 'hammer', names: ['鍛冶屋の木槌', '青銅の戦鎚', '王砕きの戦鎚', '星落としの巨鎚', '天穹の神鎚'], descriptions: ['重い一撃を生む戦鎚。'] },
  { code: 'staff', style: 'staff', names: ['樫の枝杖', '月灯りの杖', '天文術師の杖', '星詠みの賢杖', '終焉を祓う杖'], descriptions: ['魔力を導く触媒の杖。'] },
  { code: 'bow', style: 'bow', names: ['狩人の短弓', '風追いの弓', '森王の弓', '天穹の弓', '夜明けの神弓'], descriptions: ['遠くの敵を狙うしなやかな弓。'] },
];

const rarityOrder: ItemRarity[] = [...itemRarities];

function buildItems(slot: EquipmentSlot): EquipmentItem[] {
  const families = slot === 'armor' ? armorFamilies : weaponFamilies;
  const styleBonuses = slot === 'armor' ? [0, 1, 2, 3, 1] : [1, 0, 0, 2, 3];
  return rarityOrder.flatMap((rarity, rarityIndex) => families.map((family, familyIndex) => {
    const code = `${slot}_${rarity}_${family.code}`;
    const palette = rarityInfo[rarity];
    const stat = 2 + rarityIndex * (rarityIndex + 2) + styleBonuses[familyIndex];
    const description = family.descriptions[0];
    return {
      id: code,
      code,
      name: family.names[rarityIndex],
      description,
      type: slot,
      rarity,
      attack: slot === 'weapon' ? stat : 0,
      defense: slot === 'armor' ? stat : 0,
      primary: palette.primary,
      secondary: palette.secondary,
      accent: palette.accent,
      ...(slot === 'armor' ? { armorStyle: family.style as ArmorStyle } : { weaponStyle: family.style as WeaponStyle }),
    };
  }));
}

export const armorItems = buildItems('armor');
export const weaponItems = buildItems('weapon');
export const equipmentItems = [...armorItems, ...weaponItems];

export function findArmor(id: string): EquipmentItem | undefined {
  return armorItems.find((item) => item.id === id);
}

export function findWeapon(id: string): EquipmentItem | undefined {
  return weaponItems.find((item) => item.id === id);
}

export function getRarityLabel(rarity: ItemRarity): string {
  return rarityInfo[rarity].label;
}
