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

/**
 * Renders Google's own "Sign in with Google" button when the backend has GOOGLE_CLIENT_ID
 * set; renders nothing otherwise, so the password form keeps working on its own.
 */
export function GoogleSignInButton({ mode, preferredLanguage, onError }: Props) {
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const container = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState<string | null>(null);
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
        parent.replaceChildren();
        gsi.renderButton(parent, {
          type: 'standard',
          theme: document.documentElement.dataset.theme === 'light' ? 'outline' : 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          logo_alignment: 'center',
          width: Math.min(parent.clientWidth || 360, 400),
        });
      })
      .catch((e: unknown) => !cancelled && latest.current.onError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [clientId, mode]);

  if (!clientId) return null;

  return (
    <div className="mt-6">
      <div className="relative flex min-h-11 justify-center">
        <div ref={container} className="flex w-full justify-center" />
        {signingIn && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-ink-850/80">
            <Loader2 className="h-5 w-5 animate-spin text-saki-400" />
          </div>
        )}
      </div>
      <div className="mt-6 flex items-center gap-3 text-xs text-ink-400">
        <span className="h-px flex-1 bg-ink-700" />
        or continue with email
        <span className="h-px flex-1 bg-ink-700" />
      </div>
    </div>
  );
}
