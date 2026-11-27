import { useCallback, useEffect, useMemo, useState } from 'react';
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
  const [initialCache] = useState<InvitationBundle | null>(() =>
    dataService.getCachedInvitationBundle(),
  );
  const [bundle, setBundle] = useState<InvitationBundle>(
    () =>
      initialCache ?? {
        settings: DEFAULT_SETTINGS,
        elements: DEFAULT_ELEMENTS,
        cameraStops: DEFAULT_CAMERA_STOPS,
        wishes: DEFAULT_WISHES,
      },
  );
  const [loaded, setLoaded] = useState<boolean>(
    () => Boolean(initialCache) || !isSupabaseConfigured,
  );

  const guestNameFromUrl = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('to')?.trim() || '';
  }, []);

  const navigateToAdmin = useCallback(() => {
    window.history.pushState({}, '', '/admin');
    setAdminRoute(true);
    window.scrollTo({ top: 0 });
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
        // Keep cached or default seed only if backend request fails
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

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#FBF8F6] flex flex-col items-center justify-center px-6 text-center select-none">
        <div className="w-8 h-8 rounded-full border-2 border-[#E7C6CE] border-t-[#C47D8E] animate-spin mb-4" />
        {guestNameFromUrl && (
          <p className="font-display text-lg italic text-[#6E5D63] mb-1">
            Kepada Yth. {guestNameFromUrl}
          </p>
        )}
        <p className="text-xs tracking-[0.18em] uppercase text-[#8F4A5B] font-medium">
          Mempersiapkan Undangan...
        </p>
      </div>
    );
  }

  if (adminRoute) {
    return <AdminDashboard bundle={bundle} onBundleChange={setBundle} />;
  }

  return (
    <GuestInvitation
      bundle={bundle}
      bundleReady={loaded || !isSupabaseConfigured}
      onWishAdded={handleWishAdded}
      onSecretAdminTrigger={navigateToAdmin}
    />
  );
}
