import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { auth } from '../firebase';

/** Matches the Firebase password policy (Authentication → Settings → Password policy). */
const MIN_PASSWORD = 10;

export function Login() {
  const [mode, setMode] = useState<'signin' | 'create'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (mode === 'create') await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      setError(
        code.includes('invalid-credential') || code.includes('wrong-password')
          ? 'Wrong email or password.'
          : code.includes('email-already-in-use')
            ? 'That email already has a household. Sign in instead.'
            : code.includes('weak-password') || code.includes('password-does-not-meet-requirements')
              ? `Use a password of at least ${MIN_PASSWORD} characters.`
              : code.includes('too-many-requests')
                ? 'Too many tries. Wait a few minutes, or reset the password.'
                : (err as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    setError('');
    setNotice('');
    if (!email) {
      setError('Enter the household email first, then choose "Forgot password?".');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
    } catch {
      // Same message either way, so this can't be used to find out which emails have accounts.
    }
    setNotice(`If ${email} has a household, a reset link is on its way. Check spam too.`);
  }

  return (
    <div className="center">
      <form className="card-panel login" onSubmit={submit}>
        <h1>Choretation</h1>
        <p className="hint">One shared login for the whole household. Everyone signs in with the same email and password.</p>
        <label>
          Household email
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
            required
            minLength={mode === 'create' ? MIN_PASSWORD : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {mode === 'create' && <p className="hint">At least {MIN_PASSWORD} characters. Everyone in the house will share it.</p>}
        {error && <p className="error">{error}</p>}
        {notice && <p className="notice">{notice}</p>}
        <button className="primary" disabled={busy}>
          {mode === 'create' ? 'Create household' : 'Sign in'}
        </button>
        {mode === 'signin' && (
          <button type="button" className="link" onClick={resetPassword}>
            Forgot password?
          </button>
        )}
        <button type="button" className="link" onClick={() => setMode(mode === 'create' ? 'signin' : 'create')}>
          {mode === 'create' ? 'Already set up? Sign in' : 'New here? Create a household'}
        </button>
      </form>
    </div>
  );
}
