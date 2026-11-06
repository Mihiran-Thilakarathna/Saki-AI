import { useState, type FormEvent, type ReactNode } from 'react';
import { Eye, EyeOff, FileCode2, Loader2, Mic, ShieldCheck } from 'lucide-react';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { SakiGreeting } from '@/components/SakiGreeting';
import { SakiLogo } from '@/components/SakiLogo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ApiError, errorMessage } from '@/lib/apiClient';
import { SAKI_BOT_PREVIEW, SAKI_BOT_SIZES, SAKI_BOT_SRCSET } from '@/lib/sakiBot';
import { useAuthStore } from '@/store/authStore';

type Mode = 'login' | 'register';

const DEFAULT_LANGUAGE = 'si-LK' as const;

/** Short highlights under the form. */
const HIGHLIGHTS = [
  { icon: Mic, text: 'Ask by voice' },
  { icon: FileCode2, text: 'Code in your editor' },
  { icon: ShieldCheck, text: 'Private and secure' },
];

/** Sign in / create account: Saki's robot on the left (large screens), the form on the right. */
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
  const [botLoaded, setBotLoaded] = useState(false);

  return (
    <main className="flex min-h-full">
      {/* Brand side: Saki and what it does. Follows the light / dark theme. */}
      <section className="auth-brand relative hidden w-[54%] flex-col overflow-hidden text-ink-100 lg:flex">
        <div className="bg-brand-mesh pointer-events-none absolute inset-x-[-10%] bottom-[-25%] h-[70%] opacity-30 blur-3xl" />
        <div className="auth-grid pointer-events-none absolute inset-0" />

        <div className="relative flex items-center gap-2.5 p-8">
          <SakiLogo size={34} />
          <span className="text-lg font-semibold tracking-tight">Saki AI</span>
        </div>

        <div className="relative z-10 px-12 pt-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-850/70 px-3 py-1 text-xs font-medium text-ink-300 backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Saki is online
          </span>
          <h2 className="mt-5 text-[2rem] leading-[1.15] font-semibold tracking-tight xl:text-[2.5rem]">
            Your AI coding assistant,
            <br />
            fluent in <span className="text-brand">Sinhala</span> and English.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-ink-300">
            Ask a question by voice or text,
            <br />
            hear a clear explanation, and get complete code in your editor.
          </p>
        </div>

        {/* Saki stands on the bottom edge of the panel, so the cut-off waist stays hidden. */}
        <div className="relative mt-4 min-h-0 flex-1">
          <div className="pointer-events-none absolute bottom-0 left-1/2 h-[85%] w-[80%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(34,200,245,0.24),rgba(106,76,255,0.12)_45%,transparent_70%)] blur-2xl" />
          <div className="absolute inset-x-0 bottom-0 flex h-full justify-center">
            <div className="relative h-full max-h-[680px] min-h-[320px] self-end" style={{ aspectRatio: '871 / 1000' }}>
              {/* A blurred preview shows instantly; the robot fades in over it once loaded. */}
              <div
                aria-hidden="true"
                className={`absolute inset-0 bg-contain bg-bottom bg-no-repeat blur-xl transition-opacity duration-500 ${
                  botLoaded ? 'opacity-0' : 'opacity-70'
                }`}
                style={{ backgroundImage: `url(${SAKI_BOT_PREVIEW})` }}
              />
              <img
                src="/saki-bot-700.webp"
                srcSet={SAKI_BOT_SRCSET}
                sizes={SAKI_BOT_SIZES}
                alt="Saki, the Saki AI robot"
                width={871}
                height={1000}
                draggable={false}
                fetchPriority="high"
                // Lazy: phones hide this panel, so they never download the robot (large screens get it
                // early from the preload in index.html).
                loading="lazy"
                decoding="async"
                ref={(img) => {
                  if (img?.complete && img.naturalWidth > 0) setBotLoaded(true);
                }}
                onLoad={() => setBotLoaded(true)}
                className={`saki-bot relative h-full w-full select-none object-contain object-bottom transition-opacity duration-500 ${
                  botLoaded ? 'opacity-100' : 'opacity-0'
                }`}
              />
              <SakiGreeting className="absolute top-[17%] left-[72%]" />
            </div>
          </div>
        </div>
      </section>

      {/* Form side */}
      <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-5 pt-12 pb-20">
        {/* Soft brand glow and a faint dot pattern, so the form side does not feel empty. */}
        <div className="bg-brand-mesh pointer-events-none absolute top-[-12%] left-1/2 h-[46%] w-[min(760px,120%)] -translate-x-1/2 opacity-25 blur-3xl lg:top-[-22%] lg:left-[65%] lg:w-[90%] lg:opacity-[0.16] dark:opacity-30 lg:dark:opacity-20" />
        <div className="auth-dots pointer-events-none absolute inset-0" />
        <ThemeToggle className="icon-btn absolute top-4 right-4" />

        <div className="relative w-full max-w-[380px] animate-fade-in">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="lg:hidden">
              <SakiLogo size={68} />
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight lg:mt-0 lg:text-3xl">
              {registering ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="mt-1.5 text-sm text-ink-400">
              {registering ? 'Start coding with Saki in a minute.' : 'Sign in to continue to Saki.'}
            </p>
          </div>

          <div className="card mt-8 p-6 shadow-2xl shadow-black/5 sm:p-7 dark:shadow-black/40">
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

          <ul className="mt-10 grid grid-cols-3 gap-2 border-t border-ink-700 pt-6">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex flex-col items-center gap-2 text-center text-xs text-ink-400">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-ink-700 bg-ink-850 text-saki-400">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <footer className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-4 px-6 py-5 text-xs text-ink-400">
          <span>© {new Date().getFullYear()} Saki AI</span>
          <span className="h-3 w-px bg-ink-700" aria-hidden="true" />
          <a href="/terms" className="hover:text-ink-200">Terms</a>
          <a href="/privacy" className="hover:text-ink-200">Privacy</a>
        </footer>
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
