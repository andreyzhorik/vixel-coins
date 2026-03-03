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
    body: JSON.stringify({ username, coins: 0, bestRank: 'Vixel' }),
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
