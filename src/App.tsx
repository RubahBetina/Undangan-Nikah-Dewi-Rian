import { useCallback, useEffect, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { GuestInvitation } from './components/GuestInvitation.tsx';
import {
  DEFAULT_CAMERA_STOPS,
  DEFAULT_ELEMENTS,
  DEFAULT_SETTINGS,
  DEFAULT_WISHES,
} from './data/defaultSeed.ts';
import { isSupabaseConfigured } from './lib/supabase.ts';
import { dataService } from './services/dataService.ts';
import type { InvitationBundle, WishEntry } from './types/wedding.ts';

function isAdminRoute(): boolean {
  const path = window.location.pathname.replace(/\/+$/, '');
  const hash = window.location.hash.replace(/\/+$/, '');
  return path === '/admin' || hash === '#/admin';
}

export default function App() {
  const [adminRoute, setAdminRoute] = useState<boolean>(() => isAdminRoute());
  const [bundle, setBundle] = useState<InvitationBundle>({
    settings: DEFAULT_SETTINGS,
    elements: DEFAULT_ELEMENTS,
    cameraStops: DEFAULT_CAMERA_STOPS,
    wishes: DEFAULT_WISHES,
  });
  const [loaded, setLoaded] = useState(false);
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  const navigateToAdmin = useCallback(() => {
    window.history.pushState({}, '', '/admin');
    setAdminRoute(true);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const onQuotaExceeded = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  useEffect(() => {
    const syncRoute = () => setAdminRoute(isAdminRoute());
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        if (isAdminRoute()) {
          window.history.pushState({}, '', '/');
          setAdminRoute(false);
        } else {
          navigateToAdmin();
        }
      }
    };
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [navigateToAdmin]);

  useEffect(() => {
    let mounted = true;
    dataService
      .getInvitationBundle()
      .then((data) => {
        if (mounted) {
          setBundle(data);
        }
      })
      .catch(() => {
        // Keep graceful default floral seed if backend request fails
      })
      .finally(() => {
        if (mounted) setLoaded(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleWishAdded = (wish: WishEntry) => {
    setBundle((prev) => ({
      ...prev,
      wishes: [wish, ...prev.wishes],
    }));
  };

  const quotaBanner = gmpQuotaExceeded ? (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
      <span>
        Google Maps Platform quota reached. If you are the app owner, visit{' '}
        <a
          href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-semibold text-amber-950 hover:text-amber-800"
        >
          maps developer site
        </a>{' '}
        for instructions to update your account.
      </span>
    </div>
  ) : null;

  if (!loaded && adminRoute) {
    return (
      <>
        {quotaBanner}
        <div className="min-h-screen bg-[#FBF8F6] flex items-center justify-center text-xs text-[#6E5D63]">
          Memuat Atelier Fleur...
        </div>
      </>
    );
  }

  if (adminRoute) {
    return (
      <>
        {quotaBanner}
        <AdminDashboard bundle={bundle} onBundleChange={setBundle} />
      </>
    );
  }

  return (
    <>
      {quotaBanner}
      <GuestInvitation
        bundle={bundle}
        bundleReady={loaded || !isSupabaseConfigured}
        onWishAdded={handleWishAdded}
        onSecretAdminTrigger={navigateToAdmin}
      />
    </>
  );
}
