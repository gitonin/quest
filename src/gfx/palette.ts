/**
 * Art-direction palettes.
 *
 * Colours are grouped by subject so the whole game can be re-skinned from this
 * one file. They follow the reference art: dark violet-tinted steel for the
 * knight, saturated blues for the princess, silver/blue for the wizard, and the
 * three world palettes (lush forest, cursed stone, deep space).
 */

export const KNIGHT = {
  steelDark: '#26263a',
  steel: '#454560',
  steelLit: '#6d6d8c',
  steelHi: '#a3a3c4',
  trim: '#6a3fb5',
  trimLit: '#9a6ce8',
  cloth: '#2a1a44',
  blade: '#c8cfe0',
  bladeHi: '#f2f5ff',
  bladeDark: '#7d8496',
  gold: '#d9a441',
  eye: '#c05bff',
} as const;

export const PRINCESS = {
  hairDark: '#1e3f9e',
  hair: '#2f63d8',
  hairLit: '#5b9bf5',
  hairHi: '#a8d4ff',
  dressDark: '#b9c2e2',
  dress: '#e8edfb',
  dressHi: '#ffffff',
  trim: '#7b5ad6',
  gold: '#f0c04a',
  skin: '#f4c9a3',
  skinDark: '#cf9a72',
  gem: '#63d8ff',
  magic: '#8fe3ff',
} as const;

export const WIZARD = {
  robeDark: '#8b93a8',
  robe: '#c3cad9',
  robeHi: '#eef2fb',
  trim: '#e0b642',
  accent: '#3b6bd8',
  skin: '#f0c49c',
  staff: '#6b4a2a',
  staffLit: '#9a6f42',
  gem: '#59b6ff',
  magic: '#9ad8ff',
  shadow: '#5c6379',
} as const;

export const PLANT = {
  bulbDark: '#1d4a1f',
  bulb: '#2f7a33',
  bulbLit: '#57ab4a',
  bulbHi: '#8fd76a',
  mouth: '#5c1122',
  mouthDeep: '#33060f',
  tooth: '#f4f0dc',
  tentacle: '#3f8f3a',
  tentacleTip: '#c0392b',
  spit: '#8fd76a',
} as const;

export const FURBALL = {
  furDark: '#4a2c17',
  fur: '#7a4a24',
  furLit: '#a06a34',
  furHi: '#c99154',
  mouth: '#5c1122',
  mouthDeep: '#2c0710',
  tooth: '#fdf6e3',
  tongue: '#c0506a',
} as const;

export const VOID = {
  core: '#05030a',
  ring1: '#2a0d4a',
  ring2: '#4b1a80',
  ring3: '#7b34c4',
  ring4: '#b06cf5',
  spark: '#e9c6ff',
  debris: '#6b6070',
} as const;

export const FOREST = {
  grassDark: '#1f5c2a',
  grass: '#2f8c3a',
  grassLit: '#4cb44a',
  grassHi: '#7fd45c',
  dirtDark: '#7a5a30',
  dirt: '#b08a4e',
  dirtLit: '#d9b978',
  waterDark: '#14567a',
  water: '#1f86b8',
  waterLit: '#4fc3e8',
  waterHi: '#b6f0ff',
  trunkDark: '#3d2716',
  trunk: '#5e3d22',
  trunkLit: '#845a33',
  leafDark: '#175226',
  leaf: '#237a31',
  leafLit: '#39a642',
  leafHi: '#6fd05a',
  stoneDark: '#4d4a44',
  stone: '#77736a',
  stoneLit: '#a39d90',
  flower: '#ffe9f2',
  flowerAlt: '#ffd166',
} as const;

export const CASTLE = {
  stoneDark: '#221d2e',
  stone: '#39334a',
  stoneLit: '#4f4863',
  stoneHi: '#6b6383',
  mortar: '#171324',
  floorDark: '#2c2638',
  floor: '#463d52',
  floorLit: '#5d5169',
  carpetDark: '#5a1524',
  carpet: '#8c2033',
  carpetLit: '#b03247',
  bannerDark: '#5c1020',
  banner: '#8e1c2e',
  gold: '#c9963c',
  flame: '#ffb03a',
  flameHi: '#ffe6a1',
  flameCore: '#fff6d8',
  mist: '#4a2f6e',
  voidPit: '#0d0a16',
} as const;

export const SPACE = {
  voidDeep: '#05030f',
  void: '#0a0720',
  glassDark: '#2b3f8c',
  glass: '#4460c8',
  glassLit: '#6f8ef0',
  glassHi: '#b9d0ff',
  edgeGold: '#d9a441',
  edgeGoldLit: '#f5d98a',
  crystal: '#57c8ff',
  crystalHi: '#d6f4ff',
  crystalDark: '#2a6ab0',
  runeA: '#b06cf5',
  runeB: '#57e0ff',
  star: '#ffffff',
} as const;

export const UI = {
  panel: '#141024',
  panelLit: '#241d3d',
  border: '#c9a227',
  borderDark: '#7d6318',
  text: '#f4f0e4',
  textDim: '#a9a3bd',
  hp: '#d64550',
  hpDark: '#5c1a22',
  mp: '#4a9ff5',
  mpDark: '#1a3a5c',
  xp: '#f0c04a',
  shadow: '#07050f',
} as const;
