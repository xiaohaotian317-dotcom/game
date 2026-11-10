// Reuse the approved illustrations for native, practice and campaign loads.
const FIRE_THEMES = new Set(['lava','ash']);
const GARDEN_THEMES = new Set(['garden','root','venom','spore']);
export function loadingSceneForTheme(theme) {
  return FIRE_THEMES.has(theme) ? 'lava' : GARDEN_THEMES.has(theme) ? 'garden' : 'moon';
}
export function loadingArt(scene = 'moon') {
  const key = ['moon','lava','garden'].includes(scene) ? scene : 'moon';
  return `assets/loading/${key}-loading-v1.png`;
}
