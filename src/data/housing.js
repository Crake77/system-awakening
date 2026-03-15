// Housing, beds, and residence upgrades

export const HOUSING = [
  { name: "Cardboard Box", icon: "📦", cost: 0, mats: {}, restMult: 1.0, rent: 0 },
  { name: "Tent", icon: "⛺", cost: 40, mats: { leather: 3 }, restMult: 1.5, rent: 15 },
  { name: "Shack", icon: "🏚️", cost: 200, mats: { iron: 5, leather: 5 }, restMult: 2.0, rent: 40 },
  { name: "Apartment", icon: "🏢", cost: 800, mats: { iron: 8, bone: 5 }, restMult: 3.0, rent: 100 },
  { name: "House", icon: "🏠", cost: 3000, mats: { crystal: 5, iron: 10 }, restMult: 4.0, rent: 250 },
  { name: "Manor", icon: "🏰", cost: 12000, mats: { manastone: 5, crystal: 8 }, restMult: 5.0, rent: 600 },
];

export const BEDS = [
  { name: "Floor", cost: 0, mats: {}, restBonus: 0 },
  { name: "Bedroll", cost: 25, mats: { leather: 2 }, restBonus: 1 },
  { name: "Cot", cost: 80, mats: { iron: 2, leather: 3 }, restBonus: 2 },
  { name: "Bed", cost: 300, mats: { iron: 4, bone: 3 }, restBonus: 4 },
  { name: "Nice Bed", cost: 1200, mats: { crystal: 3 }, restBonus: 8 },
  { name: "Enchanted Bed", cost: 5000, mats: { manastone: 4 }, restBonus: 15 },
];

export const RESIDENCE_UPGRADES = [
  { id: "medMat", name: "Meditation Mat", icon: "🧘", cost: 120, mats: { leather: 4, bone: 2 }, desc: "+20% processing speed", field: "medMat" },
  { id: "storage1", name: "Storage Chest", icon: "📦", cost: 80, mats: { iron: 3 }, desc: "+50 material cap", field: "storage1" },
  { id: "storage2", name: "Large Chest", icon: "📦", cost: 400, mats: { iron: 6, bone: 4 }, desc: "+100 material cap", field: "storage2" },
  { id: "herbGarden", name: "Herb Garden", icon: "🌿", cost: 600, mats: { bone: 5, crystal: 2 }, desc: "+1 HP/s resting", field: "herbGarden" },
];
