import { useCallback, useEffect, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { GuestInvitation } from './components/GuestInvitation.tsx';
import {
  DEFAULT_CAMERA_STOPS,
  DEFAULT_ELEMENTS,
  DEFAULT_SETTINGS,
  DEFAULT_WISHES,
} from './data/defaultSeed.ts';
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

  if (!loaded && adminRoute) {
    return (
      <div className="min-h-screen bg-[#FBF8F6] flex items-center justify-center text-xs text-[#6E5D63]">
        Memuat Atelier Fleur...
      </div>
    );
  }

  if (adminRoute) {
    return <AdminDashboard bundle={bundle} onBundleChange={setBundle} />;
  }

  return (
    <GuestInvitation
      bundle={bundle}
      onWishAdded={handleWishAdded}
      onSecretAdminTrigger={navigateToAdmin}
    />
  );
}
