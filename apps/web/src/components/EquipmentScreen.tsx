import { useMemo, useState, type CSSProperties } from 'react';
import { ArrowLeft, Check, Shield, Sparkles, Swords } from 'lucide-react';
import { armorItems, itemRarities, rarityInfo, weaponItems, type EquipmentItem, type ItemRarity } from '@type-arena/game-data';
import { resolveHeroAppearance, type EquipmentLoadout } from '../game/hero-appearance';
import HeroSprite from './HeroSprite';

type Props = {
  loadout: EquipmentLoadout;
  returnToBattle: boolean;
  onEquipArmor: (itemId: string) => void;
  onEquipWeapon: (itemId: string) => void;
  onBack: () => void;
};

type FilterRarity = ItemRarity | 'all';

function statLabel(item: EquipmentItem) {
  return item.type === 'weapon' ? `ATK ${item.attack}` : `DEF ${item.defense}`;
}

export default function EquipmentScreen({ loadout, returnToBattle, onEquipArmor, onEquipWeapon, onBack }: Props) {
  const [slot, setSlot] = useState<'armor' | 'weapon'>('armor');
  const [rarity, setRarity] = useState<FilterRarity>('all');
  const appearance = resolveHeroAppearance(loadout.armorId, loadout.weaponId);
  const items = slot === 'armor' ? armorItems : weaponItems;
  const equippedId = slot === 'armor' ? loadout.armorId : loadout.weaponId;
  const filteredItems = useMemo(() => items.filter((item) => rarity === 'all' || item.rarity === rarity), [items, rarity]);

  const equip = (item: EquipmentItem) => {
    if (item.type === 'armor') onEquipArmor(item.id);
    else onEquipWeapon(item.id);
  };

  return <main className="equipment-page">
    <div className="equipment-page-head">
      <button className="secondary-button" onClick={onBack}><ArrowLeft size={15} /> {returnToBattle ? 'バトルへ戻る' : 'ホームへ戻る'}</button>
      <div><span className="section-kicker">HERO EQUIPMENT</span><h1>装備をえらぶ</h1></div>
      <span className="equipment-count"><Sparkles size={14} /> 50 ITEMS</span>
    </div>

    <div className="equipment-workbench">
      <section className="equipment-preview-panel" aria-label="現在の勇者の装備">
        <div className="equipment-preview-label">CURRENT LOADOUT <i>勇者</i></div>
        <div className="equipment-preview-figure"><HeroSprite armor={appearance.armor} weapon={appearance.weapon} className="equipment-hero-art" /></div>
        <div className="equipment-equipped-lines">
          <div><Shield size={14} /><span>防具</span><b>{appearance.armor.name}</b><em>{rarityInfo[appearance.armor.rarity].label}</em></div>
          <div><Swords size={14} /><span>武器</span><b>{appearance.weapon.name}</b><em>{rarityInfo[appearance.weapon.rarity].label}</em></div>
        </div>
        <p className="equipment-preview-note">装備を選ぶと勇者の姿にすぐ反映されます。</p>
      </section>

      <section className="equipment-catalog" aria-label="装備アイテム一覧">
        <div className="equipment-slot-tabs">
          <button className={slot === 'armor' ? 'active' : ''} onClick={() => { setSlot('armor'); setRarity('all'); }}><Shield size={15} /> 防具 <small>25</small></button>
          <button className={slot === 'weapon' ? 'active' : ''} onClick={() => { setSlot('weapon'); setRarity('all'); }}><Swords size={15} /> 武器 <small>25</small></button>
        </div>
        <div className="equipment-rarity-filters" aria-label="レアリティで絞り込み">
          <button className={rarity === 'all' ? 'active' : ''} onClick={() => setRarity('all')}>すべて</button>
          {itemRarities.map((value) => <button key={value} className={rarity === value ? 'active' : ''} style={{ '--rarity-color': rarityInfo[value].color } as CSSProperties} onClick={() => setRarity(value)}>{rarityInfo[value].label}</button>)}
        </div>
        <div className="equipment-items-grid">
          {filteredItems.map((item) => {
            const isEquipped = equippedId === item.id;
            return <button key={item.id} className={`equipment-item-card ${isEquipped ? 'equipped' : ''}`} style={{ '--rarity-color': rarityInfo[item.rarity].color } as CSSProperties} onClick={() => equip(item)} aria-pressed={isEquipped}>
              <span className="equipment-item-rarity">{rarityInfo[item.rarity].label}</span>
              <b>{item.name}</b>
              <span className="equipment-item-description">{item.description}</span>
              <span className="equipment-item-footer"><i>{statLabel(item)}</i>{isEquipped ? <em><Check size={12} /> 装備中</em> : <em>装備する</em>}</span>
            </button>;
          })}
        </div>
      </section>
    </div>
  </main>;
}
