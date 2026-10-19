import { useState, type FormEvent, type ReactNode } from 'react';
import { Eye, EyeOff, FileCode2, Languages, Loader2, Mic, Smartphone } from 'lucide-react';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { SakiLogo } from '@/components/SakiLogo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ApiError, errorMessage } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

type Mode = 'login' | 'register';

const DEFAULT_LANGUAGE = 'si-LK' as const;

const FEATURES = [
  { icon: Mic, title: 'Ask out loud', text: 'Talk to Saki in Sinhala or English. It answers aloud.' },
  { icon: FileCode2, title: 'Code in your editor', text: 'Complete, working code lands straight in the editor.' },
  { icon: Languages, title: 'Built for Sri Lankan developers', text: 'Understands Sinhala mixed with technical English.' },
  { icon: Smartphone, title: 'Use your phone as a mic', text: 'Pair the mobile app and talk from across the room.' },
];

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
    <main className="flex min-h-full">
      {/* Brand panel */}
      <section className="relative hidden w-[46%] max-w-[640px] flex-col justify-between overflow-hidden bg-ink-800 p-12 text-ink-100 lg:flex dark:bg-[#0b0f17] dark:text-white">
        <div className="pointer-events-none absolute -top-40 -right-40 h-80 w-80 rounded-full bg-[#2dd4bf]/20 blur-3xl dark:bg-[#2dd4bf]/15" />
        <div className="pointer-events-none absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-[#8b5cf6]/15 blur-3xl dark:bg-[#8b5cf6]/25" />

        <div className="relative flex items-center gap-3">
          <SakiLogo size={40} />
          <span className="text-xl font-semibold tracking-tight">Saki AI</span>
        </div>

        <div className="relative">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight">
            Your voice coding
            <br />
            assistant, in <span className="bg-gradient-to-r from-saki-300 to-iris-400 bg-clip-text text-transparent">Sinhala</span> and English.
          </h1>
          <p className="mt-4 max-w-md text-base text-ink-300 dark:text-white/70">
            Ask a question, hear a clear answer, and get complete code in your editor.
          </p>
          <ul className="mt-10 space-y-5">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-850 text-saki-400 shadow-sm dark:bg-white/10 dark:text-[#2dd4bf] dark:shadow-none">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-sm text-ink-400 dark:text-white/60">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-ink-400 dark:text-white/40">Saki is AI and can make mistakes. Please double-check responses.</p>
      </section>

      {/* Form */}
      <section className="relative flex flex-1 items-center justify-center px-5 py-12 sm:px-8">
        <ThemeToggle className="icon-btn absolute top-4 right-4" />
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <SakiLogo size={34} />
            <span className="text-lg font-semibold tracking-tight">Saki AI</span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">{registering ? 'Create your account' : 'Welcome back'}</h2>
          <p className="mt-1.5 text-sm text-ink-400">
            {registering ? 'Start coding with Saki in under a minute.' : 'Sign in to continue to Saki.'}
          </p>

          <GoogleSignInButton mode={mode} preferredLanguage={DEFAULT_LANGUAGE} onError={setError} />

          <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
            {registering && (
              <Field label="Full name" error={fieldErrors.fullName}>
                <input
                  className="field"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  placeholder="Nimal Perera"
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
            <Field
              label="Password"
              error={fieldErrors.password}
              hint={registering ? 'At least 8 characters.' : undefined}
            >
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

            <button type="submit" className="btn-primary w-full py-3" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {registering ? 'Create account' : 'Sign in'}
            </button>
          </form>

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
      </section>
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
