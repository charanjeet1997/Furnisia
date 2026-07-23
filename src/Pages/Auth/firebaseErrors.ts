// Firebase throws error codes like "auth/invalid-credential" — translate the common ones so
// the login/register forms don't surface raw SDK error strings to the user.
const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/invalid-email': 'That email address looks invalid.',
  'auth/user-not-found': 'No account found with that email.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/email-already-in-use': 'An account with that email already exists.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  'auth/network-request-failed': 'Network error — check your connection and try again.',
};

export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code && MESSAGES[code]) return MESSAGES[code];
  return 'Something went wrong. Please try again.';
}
