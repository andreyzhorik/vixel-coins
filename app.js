const API_BASE = 'https://6907fcb5b49bea95fbf20cbc.mockapi.io/users';
const STORAGE_KEYS = {
  userId: 'vixelUserId',
  username: 'vixelUsername',
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
    body: JSON.stringify({ username, coins: 0 }),
  });
}

async function getUserById(id) {
  return fetchJson(`${API_BASE}/${id}`);
}

async function updateCoins(userId, coins) {
  return fetchJson(`${API_BASE}/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coins }),
  });
}

async function ensureUser(required = false) {
  const session = getSession();
  if (session.userId && session.username) {
    try {
      return await getUserById(session.userId);
    } catch (_) {
      clearSession();
    }
  }

  if (required) {
    window.location.href = 'index.html';
  }

  return null;
}

async function setUsername(username) {
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
    item.textContent = `#${index + 1} ${u.username} — ${Number(u.coins || 0)} coins`;
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
      // Keep running; transient API issues should not break the UI.
    }
  };

  const timer = setInterval(tick, intervalMs);
  tick();

  return () => {
    active = false;
    clearInterval(timer);
  };
}
