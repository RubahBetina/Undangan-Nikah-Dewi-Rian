import { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Layers,
  LogOut,
  Settings,
  Users,
} from 'lucide-react';
import schemaSqlRaw from '../../supabase/schema.sql?raw';
import { DEFAULT_CAMERA_STOPS, DEFAULT_ELEMENTS } from '../data/defaultSeed.ts';
import { AdminAssetsPanel } from './AdminAssetsPanel.tsx';
import { AdminAuth } from './AdminAuth.tsx';
import { AdminCanvasStudio } from './AdminCanvasStudio.tsx';
import { AdminRsvpPanel } from './AdminRsvpPanel.tsx';
import { AdminSettingsPanel } from './AdminSettingsPanel.tsx';
import { dataService } from '../services/dataService.ts';
import type {
  AdminUser,
  CameraStop,
  CanvasElement,
  InvitationBundle,
  MediaAsset,
  RsvpEntry,
  WeddingSettings,
  WishEntry,
} from '../types/wedding.ts';

type AdminTab = 'canvas' | 'assets' | 'settings' | 'rsvps';

interface AdminDashboardProps {
  bundle: InvitationBundle;
  onBundleChange: (next: InvitationBundle) => void;
}

export function AdminDashboard({
  bundle,
  onBundleChange,
}: AdminDashboardProps) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('canvas');

  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [rsvps, setRsvps] = useState<RsvpEntry[]>([]);
  const [wishes, setWishes] = useState<WishEntry[]>(bundle.wishes);
  const [elements, setElements] = useState<CanvasElement[]>(bundle.elements);
  const [cameraStops, setCameraStops] = useState<CameraStop[]>(bundle.cameraStops);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    bundle.elements[0]?.id || null,
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    setElements(bundle.elements);
    setCameraStops(bundle.cameraStops);
    setWishes(bundle.wishes);
  }, [bundle]);

  useEffect(() => {
    let mounted = true;
    dataService
      .getCurrentUser()
      .then((u) => {
        if (mounted) setUser(u);
      })
      .finally(() => {
        if (mounted) setCheckingAuth(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    Promise.all([
      dataService.getAssets(),
      dataService.getAdminRsvps(),
      dataService.checkSchemaReady(),
    ])
      .then(([assetList, rsvpData, ready]) => {
        if (!mounted) return;
        setAssets(assetList);
        setRsvps(rsvpData.rsvps);
        setWishes(rsvpData.wishes);
        setSchemaMissing(!ready);
      })
      .catch(() => {
        // Ignore transient errors
      });
    return () => {
      mounted = false;
    };
  }, [user]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  };

  const handleLogout = async () => {
    await dataService.logout();
    setUser(null);
  };

  const handleSaveCanvas = async () => {
    setSaving(true);
    try {
      const saved = await dataService.saveCanvas(elements, cameraStops);
      onBundleChange({
        ...bundle,
        elements: saved.elements,
        cameraStops: saved.cameraStops,
      });
      showToast('Komposisi kedalaman 3D berhasil disimpan.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan kanvas.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetCanvas = async () => {
    setSaving(true);
    try {
      const saved = await dataService.saveCanvas(
        DEFAULT_ELEMENTS,
        DEFAULT_CAMERA_STOPS,
      );
      setElements(saved.elements);
      setCameraStops(saved.cameraStops);
      onBundleChange({
        ...bundle,
        elements: saved.elements,
        cameraStops: saved.cameraStops,
      });
      showToast('Komposisi & jalur kamera dikembalikan ke setelan pabrik.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal mereset kanvas.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopySql = () => {
    void navigator.clipboard?.writeText(schemaSqlRaw);
    setCopiedSql(true);
    showToast('Script supabase/schema.sql disalin. Tempel di SQL Editor Supabase.');
    window.setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleSaveSettings = async (nextSettings: WeddingSettings) => {
    setSaving(true);
    try {
      const saved = await dataService.updateSettings(nextSettings);
      onBundleChange({ ...bundle, settings: saved });
      showToast('Detail undangan berhasil diperbarui.');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Gagal menyimpan detail undangan.';
      showToast(msg);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleAddAssetToCanvas = (asset: MediaAsset) => {
    const newEl: CanvasElement = {
      id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      assetId: asset.id,
      label: asset.name,
      url: asset.url,
      x: 0,
      y: 0,
      z: -3.5,
      scale: 3.4,
      rotX: 0,
      rotY: 0,
      rotZ: 0,
      opacity: 0.98,
      removeWhiteBg: !asset.hasAlpha && asset.category !== 'backdrop',
      swayAmplitude: 0.025,
      swaySpeed: 0.85,
      floatAmplitude: 0.04,
      chapterIndex: 0,
      sortOrder: elements.length + 1,
      visible: true,
    };
    const next = [...elements, newEl];
    setElements(next);
    setSelectedElementId(newEl.id);
    setActiveTab('canvas');
    showToast(`"${asset.name}" ditambahkan ke Kanvas 3D.`);
  };

  const handleReplaceSlotAsset = async (
    slotType: 'gate' | 'smoke' | 'element',
    targetId: string,
    asset: MediaAsset,
  ) => {
    setSaving(true);
    try {
      if (slotType === 'gate') {
        const saved = await dataService.updateSettings({
          ...bundle.settings,
          gateImageUrl: asset.url,
        });
        onBundleChange({ ...bundle, settings: saved });
        showToast('Gambar gerbang pembuka & penutup berhasil diganti.');
        return;
      }

      if (slotType === 'smoke') {
        const saved = await dataService.updateSettings({
          ...bundle.settings,
          smokeImageUrl: asset.url,
        });
        onBundleChange({ ...bundle, settings: saved });
        showToast('Gambar elemen asap alas teks berhasil diganti.');
        return;
      }

      const nextElements = elements.map((el) =>
        el.id === targetId
          ? {
              ...el,
              assetId: asset.id,
              url: asset.url,
              removeWhiteBg: asset.hasAlpha ? false : el.removeWhiteBg,
            }
          : el,
      );
      const saved = await dataService.saveCanvas(nextElements, cameraStops);
      setElements(saved.elements);
      setCameraStops(saved.cameraStops);
      onBundleChange({
        ...bundle,
        elements: saved.elements,
        cameraStops: saved.cameraStops,
      });
      showToast('Gambar elemen berhasil diganti dan disimpan.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal mengganti gambar.');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRsvp = async (
    id: string,
    patch: Partial<
      Pick<RsvpEntry, 'guestName' | 'attendance' | 'guestCount' | 'sessionChoice' | 'message'>
    >,
  ) => {
    try {
      const updated = await dataService.updateRsvp(id, patch);
      setRsvps((prev) => prev.map((r) => (r.id === id ? updated : r)));
      showToast('Data RSVP diperbarui.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal memperbarui RSVP.');
      throw err;
    }
  };

  const handleDeleteRsvp = async (id: string) => {
    try {
      await dataService.deleteRsvp(id);
      setRsvps((prev) => prev.filter((r) => r.id !== id));
      showToast('Data RSVP dihapus.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menghapus RSVP.');
    }
  };

  const handleUpdateWish = async (
    id: string,
    patch: Partial<Pick<WishEntry, 'guestName' | 'message'>>,
  ) => {
    try {
      const updated = await dataService.updateWish(id, patch);
      const nextWishes = wishes.map((w) => (w.id === id ? updated : w));
      setWishes(nextWishes);
      onBundleChange({ ...bundle, wishes: nextWishes });
      showToast('Ucapan tamu diperbarui.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal memperbarui ucapan.');
      throw err;
    }
  };

  const handleDeleteWish = async (id: string) => {
    try {
      await dataService.deleteWish(id);
      const nextWishes = wishes.filter((w) => w.id !== id);
      setWishes(nextWishes);
      onBundleChange({ ...bundle, wishes: nextWishes });
      showToast('Ucapan tamu dihapus.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menghapus ucapan.');
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#FBF8F6] flex items-center justify-center text-xs text-[#6E5D63]">
        Memeriksa sesi pengelola...
      </div>
    );
  }

  if (!user) {
    return <AdminAuth onAuthenticated={(u) => setUser(u)} />;
  }

  const navItems: Array<{ id: AdminTab; label: string; icon: typeof Layers }> = [
    { id: 'canvas', label: 'Studio Kanvas 3D', icon: Layers },
    { id: 'assets', label: 'Pustaka Aset Gambar', icon: ImageIcon },
    { id: 'settings', label: 'Detail Undangan', icon: Settings },
    { id: 'rsvps', label: 'Tamu, RSVP & Doa', icon: Users },
  ];

  const activeLabel =
    navItems.find((item) => item.id === activeTab)?.label || 'Studio';

  return (
    <div className="min-h-screen bg-[#FBF8F6] text-[#3A2D32] flex flex-col lg:flex-row">
      {/* Left Workspace Sidebar (240px) */}
      <aside className="w-full lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-[#E6DFDB] bg-white px-5 py-6 flex flex-col justify-between">
        <div>
          <div className="mb-8 px-2">
            <h1 className="font-display text-2xl font-semibold text-[#3A2D32]">
              Atelier Fleur
            </h1>
            <p className="text-[11px] text-[#6E5D63] mt-0.5">
              Panel Admin
              <span className="mx-1.5" aria-hidden="true">
                ·
              </span>
              {dataService.getBackendMode() === 'supabase'
                ? 'Supabase'
                : 'Lokal Server'}
            </p>
          </div>

          <nav aria-label="Menu Admin" className="space-y-1">
            {navItems.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[#FBF1F3] text-[#3A2D32]'
                      : 'text-[#6E5D63] hover:text-[#3A2D32] hover:bg-[#FBF8F6]'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      active ? 'text-[#C47D8E]' : 'text-[#6E5D63]'
                    }`}
                  />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="hidden lg:block pt-6 border-t border-[#EFE8E4]">
          <p className="text-xs font-medium text-[#3A2D32] truncate px-2">
            {user.name}
          </p>
          <p className="text-[11px] text-[#6E5D63] truncate px-2 mb-3">
            {user.email}
          </p>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-[#6E5D63] hover:text-[#8F3A4E] hover:bg-[#FBF8F6] transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on Left + Actions on Right */}
        <header className="border-b border-[#E6DFDB] bg-white px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs text-[#6E5D63] flex items-center gap-2">
            <span>Studio Admin</span>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-[#3A2D32]">{activeLabel}</span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#DFD6D1] bg-white px-3.5 py-2 text-xs font-medium text-[#3A2D32] hover:bg-[#FBF8F6] transition-colors whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#6B8E78]" />
              <span>Lihat Halaman Tamu</span>
            </a>

            <button
              type="button"
              onClick={() => void handleLogout()}
              className="lg:hidden inline-flex items-center gap-1.5 rounded-xl border border-[#DFD6D1] px-3 py-2 text-xs font-medium text-[#6E5D63] cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </header>

        {schemaMissing && (
          <div className="mx-6 mt-4 rounded-xl border border-[#E7C6CE] bg-[#FBECEF] px-4 py-3 text-xs text-[#8F3A4E] flex flex-wrap items-center justify-between gap-3 leading-relaxed">
            <div>
              <strong>Tabel Supabase belum dibuat:</strong> Perubahan Anda tetap otomatis tersimpan ke server aplikasi agar semua fitur tetap berjalan normal. Untuk sinkron langsung ke proyek Supabase Anda, salin &amp; jalankan SQL ini di <strong>Supabase Dashboard &rarr; SQL Editor</strong>.
            </div>
            <button
              type="button"
              onClick={handleCopySql}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#8F3A4E] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[#7A2F42] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSql ? 'SQL Tersalin' : 'Salin Script SQL'}</span>
            </button>
          </div>
        )}

        {toast && (
          <div className="mx-6 mt-4 rounded-xl border border-[#CFE0D4] bg-[#ECF2ED] px-4 py-2.5 text-xs font-medium text-[#3B5B47]">
            {toast}
          </div>
        )}

        <main className="p-6 max-w-[1440px] w-full mx-auto">
          {activeTab === 'canvas' && (
            <AdminCanvasStudio
              elements={elements}
              cameraStops={cameraStops}
              assets={assets}
              skyColorHex={bundle.settings.skyColorHex}
              selectedElementId={selectedElementId}
              onSelectElement={setSelectedElementId}
              onElementsChange={setElements}
              onCameraStopsChange={setCameraStops}
              onSaveCanvas={handleSaveCanvas}
              onResetCanvas={handleResetCanvas}
              onReplaceElementAsset={handleReplaceSlotAsset}
              onAssetsChange={setAssets}
              saving={saving}
            />
          )}

          {activeTab === 'assets' && (
            <AdminAssetsPanel
              assets={assets}
              elements={elements}
              settings={bundle.settings}
              onAssetsChange={setAssets}
              onAddToCanvas={handleAddAssetToCanvas}
              onReplaceSlotAsset={handleReplaceSlotAsset}
            />
          )}

          {activeTab === 'settings' && (
            <AdminSettingsPanel
              settings={bundle.settings}
              assets={assets}
              onSave={handleSaveSettings}
              saving={saving}
            />
          )}

          {activeTab === 'rsvps' && (
            <AdminRsvpPanel
              rsvps={rsvps}
              wishes={wishes}
              onUpdateRsvp={handleUpdateRsvp}
              onDeleteRsvp={handleDeleteRsvp}
              onUpdateWish={handleUpdateWish}
              onDeleteWish={handleDeleteWish}
            />
          )}
        </main>
      </div>
    </div>
  );
}
