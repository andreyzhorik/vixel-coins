const API_BASE = 'https://6907fcb5b49bea95fbf20cbc.mockapi.io/users';
const STORAGE_KEYS = {
  userId: 'vixelUserId',
  username: 'vixelUsername',
};

const RANK_ORDER = ['Vixel', 'Wynix', 'Xivil', 'Yarel', 'Zyxel'];
const RANK_COLORS = {
  Vixel: '#D32F2F',
  Wynix: '#FF9800',
  Xivil: '#2196F3',
  Yarel: '#9C27B0',
  Zyxel: '#FFC107',
};

const RANK_BONUSES = {
  Vixel: 'None',
  Wynix: 'Click Reward +5%',
  Xivil: 'Crystal Chance +5%',
  Yarel: 'Crate Coin Bonus +10%',
  Zyxel: 'Gambling Payout +10%',
};

const SHOP_EFFECT_KEYS = {
  clickerSkin: 'vixelClickerSkin',
  clickBonusUntil: 'vixelClickBonusUntil',
  coinMultiplierUntil: 'vixelCoinMultiplierUntil',
  gambleBoostCharges: 'vixelGambleBoostCharges',
  theme: 'vixelTheme',
};

function getSession() {
  return {
    userId: localStorage.getItem(STORAGE_KEYS.userId),
    username: localStorage.getItem(STORAGE_KEYS.username),
  };
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.userId);
  localStorage.removeItem(STORAGE_KEYS.username);
}

function saveSession(user) {
  localStorage.setItem(STORAGE_KEYS.userId, String(user.id));
  localStorage.setItem(STORAGE_KEYS.username, user.username);
}

function hasLockedUsername() {
  const session = getSession();
  return Boolean(session.userId && session.username);
}

function normalizeRank(rank) {
  return RANK_ORDER.includes(rank) ? rank : 'Vixel';
}

function getRankTier(rank) {
  const index = RANK_ORDER.indexOf(normalizeRank(rank));
  return index >= 0 ? index : 0;
}

function getBestRank(currentRank, candidateRank) {
  return getRankTier(candidateRank) > getRankTier(currentRank) ? normalizeRank(candidateRank) : normalizeRank(currentRank);
}

function getRankColor(rank) {
  return RANK_COLORS[normalizeRank(rank)] || RANK_COLORS.Vixel;
}

function getActiveRank(user) {
  return normalizeRank(user?.activeRank || user?.bestRank || 'Vixel');
}

function getUnlockedRanks(bestRank) {
  const bestTier = getRankTier(bestRank);
  return RANK_ORDER.filter((_, index) => index <= bestTier);
}

function getShopEffect(key, fallback = 0) {
  const value = localStorage.getItem(key);
  return value == null ? fallback : Number(value) || fallback;
}

function setShopEffect(key, value) {
  localStorage.setItem(key, String(value));
}

function isTimedEffectActive(key, now = Date.now()) {
  return getShopEffect(key, 0) > now;
}

function activateTimedEffect(key, durationMs) {
  const now = Date.now();
  const currentEnd = getShopEffect(key, 0);
  const nextEnd = Math.max(currentEnd, now) + durationMs;
  setShopEffect(key, nextEnd);
  return nextEnd;
}

function getClickShopMultiplier(now = Date.now()) {
  let multiplier = 1;
  if (isTimedEffectActive(SHOP_EFFECT_KEYS.clickBonusUntil, now)) multiplier *= 1.5;
  if (isTimedEffectActive(SHOP_EFFECT_KEYS.coinMultiplierUntil, now)) multiplier *= 1.25;
  return multiplier;
}

function addGambleBoostCharge(amount = 1) {
  const next = getShopEffect(SHOP_EFFECT_KEYS.gambleBoostCharges, 0) + amount;
  setShopEffect(SHOP_EFFECT_KEYS.gambleBoostCharges, next);
  return next;
}

function consumeGambleBoostCharge() {
  const current = getShopEffect(SHOP_EFFECT_KEYS.gambleBoostCharges, 0);
  if (current <= 0) return false;
  setShopEffect(SHOP_EFFECT_KEYS.gambleBoostCharges, current - 1);
  return true;
}

function applySavedTheme() {
  const theme = localStorage.getItem(SHOP_EFFECT_KEYS.theme) || 'default';
  document.body.classList.toggle('theme-arcade', theme === 'arcade');
}

function applyClickerSkin(buttonEl) {
  if (!buttonEl) return;
  const skin = localStorage.getItem(SHOP_EFFECT_KEYS.clickerSkin) || 'default';
  buttonEl.classList.toggle('skin-neon', skin === 'neon');
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  return response.json();
}

async function findUserByUsername(username) {
  const users = await fetchJson(`${API_BASE}?username=${encodeURIComponent(username)}`);
  return users[0] ?? null;
}

async function createUser(username) {
  return fetchJson(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, coins: 0, bestRank: 'Vixel', activeRank: 'Vixel' }),
  });
}

async function getUserById(id) {
  return fetchJson(`${API_BASE}/${id}`);
}

async function updateUser(userId, updates) {
  return fetchJson(`${API_BASE}/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

async function updateCoins(userId, coins) {
  const user = await getUserById(userId);
  return updateUser(userId, {
    username: user.username,
    coins,
    bestRank: normalizeRank(user.bestRank),
    activeRank: getActiveRank(user),
  });
}

async function ensureUser(required = false) {
  const session = getSession();
  if (session.userId && session.username) {
    try {
      return await getUserById(session.userId);
    } catch (_) {
      if (required) {
        window.location.href = 'index.html';
      }
      return null;
    }
  }

  if (required) {
    window.location.href = 'index.html';
  }

  return null;
}

async function setUsername(username) {
  if (hasLockedUsername()) {
    throw new Error('Username is already locked for this browser.');
  }

  const clean = username.trim();
  if (!clean) {
    throw new Error('Username is required.');
  }

  let user = await findUserByUsername(clean);
  if (!user) {
    user = await createUser(clean);
  }

  saveSession(user);
  return user;
}

function renderUserInfo(user, usernameEl, coinsEl) {
  usernameEl.textContent = user.username;
  coinsEl.textContent = Number(user.coins || 0);
}

async function loadLeaderboard(listEl, currentUsername = '') {
  const users = await fetchJson(API_BASE);
  users.sort((a, b) => Number(b.coins || 0) - Number(a.coins || 0));

  listEl.innerHTML = '';
  const topUsers = users.slice(0, 10);

  if (!topUsers.length) {
    const item = document.createElement('li');
    item.textContent = 'No players yet.';
    listEl.appendChild(item);
    return;
  }

  topUsers.forEach((u, index) => {
    const item = document.createElement('li');
    const isCurrent = currentUsername && currentUsername.toLowerCase() === String(u.username).toLowerCase();
    const rank = normalizeRank(u.bestRank);
    const rankPill = `<span class="rank-pill" style="--rank-color:${getRankColor(rank)}">${rank}</span>`;
    item.innerHTML = `#${index + 1} ${u.username} — ${Number(u.coins || 0)} coins ${rankPill}`;
    if (isCurrent) item.classList.add('current-user-row');
    listEl.appendChild(item);
  });
}

function startUserCoinSync(userId, onUpdate, intervalMs = 2000) {
  let active = true;

  const tick = async () => {
    if (!active) return;
    try {
      const latestUser = await getUserById(userId);
      onUpdate(latestUser);
    } catch (_) {
      // Keep running for transient API issues.
    }
  };

  const timer = setInterval(tick, intervalMs);
  tick();

  return () => {
    active = false;
    clearInterval(timer);
  };
}

if (document.body) {
  applySavedTheme();
} else {
  window.addEventListener('DOMContentLoaded', applySavedTheme, { once: true });
}
