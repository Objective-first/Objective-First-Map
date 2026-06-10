const HLL_MAPS = [
  { id: "carentan", name: "Carentan", image: "/maps/Carentan_NoGrid.webp", aliases: ["carentan", "car_"] },
  { id: "driel", name: "Driel", image: "/maps/Driel_NoGrid.webp", aliases: ["driel", "drl_"] },
  { id: "el-alamein", name: "El Alamein", image: "/maps/ElAlamein_NoGrid.webp", aliases: ["elalamein", "ela_"] },
  { id: "elsenborn-ridge", name: "Elsenborn Ridge", image: "/maps/Elsenborn_NoGrid.webp", aliases: ["elsenbornridge", "elsenborn"] },
  { id: "foy", name: "Foy", image: "/maps/Foy_NoGrid.webp", aliases: ["foy"] },
  { id: "hill-400", name: "Hill 400", image: "/maps/Hill400_NoGrid.webp", aliases: ["hill400", "hil_"] },
  { id: "hurtgen-forest", name: "Hurtgen Forest", image: "/maps/HurtgenV2_NoGrid.webp", aliases: ["hurtgenforest", "hurtgen"] },
  { id: "juno-beach", name: "Juno Beach", image: "/maps/junobeach.png", aliases: ["juno", "junobeach"] },
  { id: "kharkov", name: "Kharkov", image: "/maps/Kharkov_NoGrid.webp", aliases: ["kharkov"] },
  { id: "kursk", name: "Kursk", image: "/maps/Kursk_NoGrid.webp", aliases: ["kursk"] },
  { id: "marvie", name: "Marvie", image: "/maps/marvie.png", aliases: ["marvie"] },
  { id: "mortain", name: "Mortain", image: "/maps/Mortain_NoGrid.webp", aliases: ["mortain"] },
  { id: "omaha-beach", name: "Omaha Beach", image: "/maps/Omaha_NoGrid.webp", aliases: ["omahabeach", "omaha"] },
  { id: "purple-heart-lane", name: "Purple Heart Lane", image: "/maps/PHL_NoGrid.webp", aliases: ["purpleheartlane", "phl_"] },
  { id: "remagen", name: "Remagen", image: "/maps/Remagen_NoGrid.webp", aliases: ["remagen"] },
  { id: "sainte-marie-du-mont", name: "Sainte-Marie-du-Mont", image: "/maps/SMDMV2_NoGrid.webp", aliases: ["stmariedumont", "smdm_"] },
  { id: "sainte-mere-eglise", name: "Sainte-Mere-Eglise", image: "/maps/SME_NoGrid.webp", aliases: ["stmereeglise", "sme_"] },
  { id: "smolensk", name: "Smolensk", image: "/maps/Smolensk_NoGrid.webp", aliases: ["smolensk"] },
  { id: "stalingrad", name: "Stalingrad", image: "/maps/Stalingrad_NoGrid.webp", aliases: ["stalingrad"] },
  { id: "tobruk", name: "Tobruk", image: "/maps/Tobruk_NoGrid.webp", aliases: ["tobruk"] },
  { id: "utah-beach", name: "Utah Beach", image: "/maps/Utah_NoGrid.webp", aliases: ["utahbeach", "utah"] }
];

function normalizeMapId(value) {
  if (!value) return null;
  const raw = String(value)
    .trim()
    .replace(/_RESTART$/i, "")
    .replace(/_(warfare|offensive_us|offensive_ger|offensive_uk|off_us|off_ger|off_uk)(?:_|$).*/i, "");
  const lowered = raw.toLowerCase();
  const compact = lowered.replace(/[^a-z0-9]/g, "");

  return HLL_MAPS.find((map) => {
    if (map.id === lowered) return true;
    if (map.id.replace(/[^a-z0-9]/g, "") === compact) return true;
    if (map.name.toLowerCase() === lowered) return true;
    return map.aliases.some((alias) => {
      const aliasLower = alias.toLowerCase();
      return lowered.includes(aliasLower) || compact.includes(aliasLower.replace(/[^a-z0-9]/g, ""));
    });
  })?.id || null;
}

function mapById(id) {
  return HLL_MAPS.find((map) => map.id === id) || null;
}

module.exports = {
  HLL_MAPS,
  mapById,
  normalizeMapId
};
