import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { auth } from '../firebase';

export function Login() {
  const [mode, setMode] = useState<'signin' | 'create'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
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
            : code.includes('weak-password')
              ? 'Password must be at least 6 characters.'
              : (err as Error).message,
      );
    } finally {
      setBusy(false);
    }
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
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>
          {mode === 'create' ? 'Create household' : 'Sign in'}
        </button>
        <button type="button" className="link" onClick={() => setMode(mode === 'create' ? 'signin' : 'create')}>
          {mode === 'create' ? 'Already set up? Sign in' : 'New here? Create a household'}
        </button>
      </form>
    </div>
  );
}
