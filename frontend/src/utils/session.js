export const SESSION_EXPIRED = 'finance-session-expired';

export function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function expireSession(requestToken) {
  // A delayed response from an old session must not log out a new session.
  if (!requestToken || localStorage.getItem('token') !== requestToken) return;
  clearSession();
  window.dispatchEvent(new Event(SESSION_EXPIRED));
}
