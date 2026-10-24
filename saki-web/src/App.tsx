import { AuthScreen } from '@/components/AuthScreen';
import { LegalPage } from '@/components/LegalPage';
import { ServerWakeBanner } from '@/components/ServerWakeBanner';
import { Toaster } from '@/components/Toaster';
import { Workspace } from '@/components/Workspace';
import { useAuthStore } from '@/store/authStore';

export default function App() {
  const token = useAuthStore((s) => s.token);
  // Public legal pages, reachable signed in or out (the host rewrites every path to index.html).
  const path = window.location.pathname.replace(/\/+$/, '');
  if (path === '/privacy' || path === '/terms') {
    return <LegalPage kind={path === '/privacy' ? 'privacy' : 'terms'} />;
  }
  return (
    <>
      {token ? <Workspace key={token} /> : <AuthScreen />}
      <ServerWakeBanner />
      <Toaster />
    </>
  );
}
