import { AuthScreen } from '@/components/AuthScreen';
import { ServerWakeBanner } from '@/components/ServerWakeBanner';
import { Toaster } from '@/components/Toaster';
import { Workspace } from '@/components/Workspace';
import { useAuthStore } from '@/store/authStore';

export default function App() {
  const token = useAuthStore((s) => s.token);
  return (
    <>
      {token ? <Workspace key={token} /> : <AuthScreen />}
      <ServerWakeBanner />
      <Toaster />
    </>
  );
}
