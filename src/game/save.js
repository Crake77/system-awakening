// Save/Load system using localStorage

const SAVE_KEY = "system_awakening_save";
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

export function saveGame(state) {
  try {
    const saveData = JSON.stringify(state);
    localStorage.setItem(SAVE_KEY, saveData);
    return true;
  } catch (e) {
    console.error("Failed to save:", e);
    return false;
  }
}

export function loadGame() {
  try {
    const data = localStorage.getItem(SAVE_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch (e) {
    console.error("Failed to load:", e);
    return null;
  }
}

export function deleteSave() {
  localStorage.removeItem(SAVE_KEY);
}

export function hasSave() {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export { AUTO_SAVE_INTERVAL };
