import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { authApi } from '@/api/sakiApi';
import { errorMessage } from '@/lib/apiClient';
import { loadGoogleIdentity } from '@/lib/googleIdentity';
import { useAuthStore } from '@/store/authStore';
import type { SakiLanguage } from '@/types/api';

interface Props {
  mode: 'login' | 'register';
  preferredLanguage: SakiLanguage;
  onError: (message: string) => void;
}

/** Height of Google's "large" button, matched by our visible button so the click area lines up. */
const BUTTON_HEIGHT = 40;

/**
 * "Continue with Google", styled to match Saki in light and dark themes. Google's own
 * button (which runs the secure sign-in popup and returns an ID token) sits invisibly on
 * top and receives the click; our button underneath is what people see. Renders nothing
 * unless the backend has GOOGLE_CLIENT_ID set.
 */
export function GoogleSignInButton({ mode, preferredLanguage, onError }: Props) {
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const container = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  // Latest values for Google's long-lived callback, which is registered once.
  const latest = useRef({ preferredLanguage, onError, loginWithGoogle });
  latest.current = { preferredLanguage, onError, loginWithGoogle };

  useEffect(() => {
    let cancelled = false;
    authApi
      .providers()
      .then((p) => !cancelled && setClientId(p.googleEnabled ? p.googleClientId : null))
      .catch(() => !cancelled && setClientId(null));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!clientId || !container.current) return;
    let cancelled = false;
    const parent = container.current;

    const render = (gsi: Awaited<ReturnType<typeof loadGoogleIdentity>>) => {
      parent.replaceChildren();
      gsi.renderButton(parent, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: 'continue_with',
        logo_alignment: 'center',
        // Google caps the width at 400 px; cover our whole button.
        width: Math.max(200, Math.min(parent.clientWidth || 360, 400)),
      });
      setReady(true);
    };

    let cleanup = () => {};
    loadGoogleIdentity()
      .then((gsi) => {
        if (cancelled) return;
        gsi.initialize({
          client_id: clientId,
          ux_mode: 'popup',
          cancel_on_tap_outside: true,
          callback: async ({ credential }) => {
            const { preferredLanguage: language, onError: report, loginWithGoogle: signIn } = latest.current;
            setSigningIn(true);
            try {
              await signIn({ idToken: credential, preferredLanguage: language });
            } catch (e) {
              report(errorMessage(e));
            } finally {
              setSigningIn(false);
            }
          },
        });
        render(gsi);
        // Keep the invisible click target as wide as our button (e.g. on resize / rotation).
        const observer = new ResizeObserver(() => !cancelled && render(gsi));
        observer.observe(parent);
        cleanup = () => observer.disconnect();
      })
      .catch((e: unknown) => !cancelled && latest.current.onError(errorMessage(e)));

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [clientId, mode]);

  if (!clientId) return null;

  return (
    <div className="mt-6">
      <div className="group relative" style={{ height: BUTTON_HEIGHT }}>
        <div
          aria-hidden="true"
          className="pointer-events-none flex h-full w-full items-center justify-center gap-3 rounded-xl border border-ink-700 bg-ink-850 text-sm font-semibold text-ink-100 shadow-sm transition group-focus-within:ring-2 group-focus-within:ring-saki-500/40 group-hover:border-ink-600 group-hover:bg-ink-800"
        >
          {signingIn ? <Loader2 className="h-[18px] w-[18px] animate-spin text-ink-300" /> : <GoogleMark />}
          {signingIn ? 'Signing in…' : 'Continue with Google'}
        </div>
        {/* Google's real button: nearly transparent but on top, so it receives the click. */}
        <div
          ref={container}
          className={`absolute inset-0 flex items-center justify-center overflow-hidden rounded-xl opacity-[0.01] ${
            ready && !signingIn ? '' : 'pointer-events-none'
          }`}
        />
      </div>
      <div className="mt-6 flex items-center gap-3 text-xs text-ink-400">
        <span className="h-px flex-1 bg-ink-700" />
        or continue with email
        <span className="h-px flex-1 bg-ink-700" />
      </div>
    </div>
  );
}

/** Google's four-color "G" (brand guidelines), drawn without a background circle. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
