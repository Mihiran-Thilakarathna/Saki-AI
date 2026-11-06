import { useState, type FormEvent, type ReactNode } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { SakiLogo } from '@/components/SakiLogo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ApiError, errorMessage } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

type Mode = 'login' | 'register';

const DEFAULT_LANGUAGE = 'si-LK' as const;

/** Sign in / create account: a single centered card with the logo, Google and email sign-in. */
export function AuthScreen() {
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const [mode, setMode] = useState<Mode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setFieldErrors({});
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      if (mode === 'login') await login({ email, password });
      // Saki detects Sinhala or English per question; this is only the fallback for unclear audio.
      else await register({ fullName, email, password, preferredLanguage: DEFAULT_LANGUAGE });
    } catch (e) {
      if (e instanceof ApiError) setFieldErrors(e.fieldErrors);
      setError(
        e instanceof ApiError && e.status === 401 ? 'Incorrect email or password. Please try again.' : errorMessage(e),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const registering = mode === 'register';

  return (
    <main className="relative flex min-h-full flex-col items-center justify-center overflow-hidden px-5 py-12">
      {/* Soft brand glow behind the logo. */}
      <div className="bg-brand-mesh pointer-events-none absolute top-[-12%] left-1/2 h-[46%] w-[min(760px,120%)] -translate-x-1/2 opacity-25 blur-3xl dark:opacity-30" />
      <ThemeToggle className="icon-btn absolute top-4 right-4" />

      <div className="relative w-full max-w-[380px] animate-fade-in">
        <div className="flex flex-col items-center text-center">
          <SakiLogo size={68} />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            {registering ? 'Create your account' : 'Welcome to Saki'}
          </h1>
          <p className="mt-1.5 text-sm text-ink-400">Your voice coding companion, in Sinhala and English.</p>
        </div>

        <div className="card mt-8 p-6 shadow-xl shadow-black/5 sm:p-7 dark:shadow-black/30">
          <GoogleSignInButton mode={mode} preferredLanguage={DEFAULT_LANGUAGE} onError={setError} />

          <form className="space-y-4" onSubmit={onSubmit} noValidate>
            {registering && (
              <Field label="Name" error={fieldErrors.fullName}>
                <input
                  className="field"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </Field>
            )}
            <Field label="Email" error={fieldErrors.email}>
              <input
                className="field"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </Field>
            <Field label="Password" error={fieldErrors.password} hint={registering ? 'At least 8 characters' : undefined}>
              <div className="relative">
                <input
                  className="field pr-11"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={registering ? 'new-password' : 'current-password'}
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-400 hover:text-ink-100"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            {error && (
              <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-500">
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary w-full py-2.5" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {registering ? 'Create account' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-ink-400">
          {registering ? 'Already have an account?' : 'New to Saki?'}{' '}
          <button
            type="button"
            onClick={() => switchMode(registering ? 'login' : 'register')}
            className="font-semibold text-saki-400 hover:text-saki-500"
          >
            {registering ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      </div>

      <footer className="relative mt-10 flex gap-4 text-xs text-ink-400">
        <a href="/terms" className="hover:text-ink-200">Terms</a>
        <a href="/privacy" className="hover:text-ink-200">Privacy</a>
      </footer>
    </main>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-200">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-rose-500">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-xs text-ink-400">{hint}</span>
      )}
    </label>
  );
}
