import { useState, type FormEvent, type ReactNode } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { SakiLogo } from '@/components/SakiLogo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ApiError, errorMessage } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

type Mode = 'login' | 'register';

const DEFAULT_LANGUAGE = 'si-LK' as const;

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

  return (
    <main className="flex min-h-full">
      {/* Brand side: always dark, so Saki and the glow read well in both themes. */}
      <section className="relative hidden w-[54%] flex-col overflow-hidden bg-[#050816] text-white lg:flex">
        <div className="bg-brand-mesh pointer-events-none absolute inset-x-[-10%] bottom-[-25%] h-[70%] opacity-30 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          }}
        />

        <div className="relative flex items-center gap-2.5 p-8">
          <SakiLogo size={34} />
          <span className="text-lg font-semibold tracking-tight">Saki AI</span>
        </div>

        <div className="relative z-10 px-12 pt-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70 backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#34e27a]" />
            Saki is online
          </span>
          <h2 className="mt-5 text-[2.6rem] leading-[1.15] font-semibold tracking-tight">
            Code by voice,
            <br />
            in <span className="text-brand">Sinhala</span> and English.
          </h2>
          <p className="mt-3 text-base text-white/60">Ask out loud. Hear the answer. Get the code.</p>
        </div>

        {/* Saki, standing at the bottom of the panel. */}
        <div className="relative mt-8 min-h-0 flex-1">
          <div className="pointer-events-none absolute bottom-[8%] left-1/2 h-[80%] w-[80%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(34,200,245,0.26),rgba(106,76,255,0.14)_45%,transparent_70%)] blur-2xl" />
          <div className="absolute inset-x-0 bottom-0 flex h-full justify-center">
            <div className="relative h-full max-h-[600px] min-h-[320px] self-end" style={{ aspectRatio: '806 / 1000' }}>
              <img
                src="/saki-bot.webp"
                alt="Saki, the Saki AI robot"
                width={806}
                height={1000}
                draggable={false}
                className="saki-bot-float h-full w-full select-none object-contain object-bottom"
              />
              <span className="saki-bot-chip absolute top-[27%] left-[78%] inline-flex items-center gap-2 rounded-2xl rounded-bl-sm border border-white/10 bg-[#0c1126]/85 px-3.5 py-2 text-sm font-medium whitespace-nowrap text-white/90 shadow-xl backdrop-blur">
                <span className="flex h-3.5 items-end gap-[2px]" aria-hidden="true">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className="h-3.5 w-[3px] origin-bottom animate-bar rounded-full bg-[#22c8f5]"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </span>
                Hi, I’m Saki!
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Form side */}
      <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-5 py-12">
        {/* Soft brand glow behind the logo (small screens). */}
        <div className="bg-brand-mesh pointer-events-none absolute top-[-12%] left-1/2 h-[46%] w-[min(760px,120%)] -translate-x-1/2 opacity-25 blur-3xl lg:hidden dark:opacity-30" />
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
