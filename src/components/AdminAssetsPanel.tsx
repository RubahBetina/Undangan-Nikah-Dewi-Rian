import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Check, Grid2x2, Layers, RefreshCw, Search, Trash2, Upload, X } from 'lucide-react';
import { dataService } from '../services/dataService.ts';
import type {
  AssetCategory,
  CanvasElement,
  MediaAsset,
  WeddingSettings,
} from '../types/wedding.ts';

interface SlotTarget {
  key: string;
  slotType: 'gate' | 'smoke' | 'element';
  targetId: string;
  badge: string;
  label: string;
  url: string;
  defaultCategory: AssetCategory;
  chapterIndex: number;
}

interface AdminAssetsPanelProps {
  assets: MediaAsset[];
  elements?: CanvasElement[];
  settings?: WeddingSettings;
  onAssetsChange: (next: MediaAsset[]) => void;
  onAddToCanvas: (asset: MediaAsset) => void;
  onReplaceSlotAsset?: (
    slotType: 'gate' | 'smoke' | 'element',
    targetId: string,
    asset: MediaAsset,
  ) => Promise<void>;
}

const CATEGORIES: Array<{ value: AssetCategory | 'all'; label: string }> = [
  { value: 'all', label: 'Semua' },
  { value: 'floral', label: 'Bunga Floral' },
  { value: 'foliage', label: 'Daun & Sulur' },
  { value: 'frame', label: 'Bingkai' },
  { value: 'couple', label: 'Foto Mempelai' },
  { value: 'venue', label: 'Lokasi' },
  { value: 'backdrop', label: 'Latar Arch' },
];

export function AdminAssetsPanel({
  assets,
  elements = [],
  settings,
  onAssetsChange,
  onAddToCanvas,
  onReplaceSlotAsset,
}: AdminAssetsPanelProps) {
  const [filterCat, setFilterCat] = useState<AssetCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [uploadCategory, setUploadCategory] = useState<AssetCategory>('floral');
  const [customName, setCustomName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null,
  );
  const [slotFilter, setSlotFilter] = useState<'all' | number>('all');
  const [busySlotKey, setBusySlotKey] = useState<string | null>(null);
  const [pickerSlot, setPickerSlot] = useState<SlotTarget | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const slotFileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingSlotRef = useRef<SlotTarget | null>(null);

  const slots: SlotTarget[] = [
    ...(settings
      ? [
          {
            key: 'slot-gate',
            slotType: 'gate' as const,
            targetId: 'gate',
            badge: 'Gerbang Pembuka & Penutup',
            label: 'Gambar Gerbang Floral',
            url: settings.gateImageUrl,
            defaultCategory: 'frame' as AssetCategory,
            chapterIndex: -1,
          },
          {
            key: 'slot-smoke',
            slotType: 'smoke' as const,
            targetId: 'smoke',
            badge: 'Alas Tulisan (Asap)',
            label: 'Gambar Elemen Asap Pastel',
            url: settings.smokeImageUrl,
            defaultCategory: 'frame' as AssetCategory,
            chapterIndex: -1,
          },
        ]
      : []),
    ...[...elements]
      .sort((a, b) => a.chapterIndex - b.chapterIndex || a.sortOrder - b.sortOrder)
      .map((el) => ({
        key: `slot-${el.id}`,
        slotType: 'element' as const,
        targetId: el.id,
        badge: `Adegan ${el.chapterIndex + 1}`,
        label: el.label,
        url: el.url,
        defaultCategory: (el.label.toLowerCase().includes('pengantin')
          ? 'couple'
          : el.removeWhiteBg
            ? 'floral'
            : 'backdrop') as AssetCategory,
        chapterIndex: el.chapterIndex,
      })),
  ];

  const visibleSlots = slots.filter(
    (s) => slotFilter === 'all' || s.chapterIndex === slotFilter,
  );

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setFeedback(null);
    try {
      const uploaded: MediaAsset[] = [];
      for (const file of Array.from(files)) {
        const label =
          files.length === 1 && customName.trim()
            ? customName.trim()
            : file.name.replace(/\.[^.]+$/, '');
        const asset = await dataService.uploadAsset(file, label, uploadCategory);
        uploaded.push(asset);
      }
      onAssetsChange([...uploaded, ...assets]);
      setCustomName('');
      setFeedback({
        type: 'ok',
        text: `${uploaded.length} aset gambar berhasil diunggah ke Pustaka.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal mengunggah aset.',
      });
    } finally {
      setUploading(false);
    }
  };

  const triggerSlotUpload = (slot: SlotTarget) => {
    pendingSlotRef.current = slot;
    slotFileInputRef.current?.click();
  };

  const handleSlotFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const slot = pendingSlotRef.current;
    e.target.value = '';
    if (!file || !slot || !onReplaceSlotAsset) return;

    setBusySlotKey(slot.key);
    setFeedback(null);
    try {
      const label = `${slot.label} (${file.name.replace(/\.[^.]+$/, '')})`;
      const uploaded = await dataService.uploadAsset(file, label, slot.defaultCategory);
      onAssetsChange([uploaded, ...assets]);
      await onReplaceSlotAsset(slot.slotType, slot.targetId, uploaded);
      setFeedback({
        type: 'ok',
        text: `Gambar "${slot.label}" berhasil diganti dan disimpan.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal mengganti gambar elemen.',
      });
    } finally {
      setBusySlotKey(null);
      pendingSlotRef.current = null;
    }
  };

  const handlePickLibraryAsset = async (asset: MediaAsset) => {
    if (!pickerSlot || !onReplaceSlotAsset) return;
    const slot = pickerSlot;
    setPickerSlot(null);
    setBusySlotKey(slot.key);
    setFeedback(null);
    try {
      await onReplaceSlotAsset(slot.slotType, slot.targetId, asset);
      setFeedback({
        type: 'ok',
        text: `Gambar "${slot.label}" berhasil diganti dengan "${asset.name}".`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal mengganti gambar elemen.',
      });
    } finally {
      setBusySlotKey(null);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    void handleFiles(e.dataTransfer.files);
  };

  const handleDelete = async (asset: MediaAsset) => {
    try {
      await dataService.deleteAsset(asset);
      onAssetsChange(assets.filter((a) => a.id !== asset.id));
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menghapus aset.',
      });
    }
  };

  const filtered = assets.filter((a) => {
    const matchCat = filterCat === 'all' || a.category === filterCat;
    const matchSearch =
      !search.trim() ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.category.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Hidden input for 1-click slot upload & replace */}
      <input
        ref={slotFileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={(e) => void handleSlotFileChange(e)}
        className="hidden"
      />

      {/* Section 1: 1-Click Replace Existing Elements (Most intuitive entry point) */}
      {onReplaceSlotAsset && slots.length > 0 && (
        <section className="rounded-2xl border border-[#E6DFDB] bg-white p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-medium text-[#3A2D32]">
                Ganti Gambar Elemen yang Sudah Ada
              </h2>
              <p className="text-xs text-[#6E5D63] mt-0.5">
                Klik <strong>Upload &amp; Ganti</strong> pada gambar di bawah untuk langsung menukar foto/PNG pengantin, gerbang, asap, gazebo, atau bunga dengan gambar Anda — ukuran dan posisi otomatis menyesuaikan.
              </p>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto p-1 rounded-xl bg-[#F4EEEC]">
              {[
                { value: 'all' as const, label: 'Semua' },
                { value: -1, label: 'Gerbang & Asap' },
                { value: 0, label: 'Adegan 1' },
                { value: 1, label: 'Adegan 2' },
                { value: 2, label: 'Adegan 3' },
                { value: 3, label: 'Adegan 4' },
                { value: 4, label: 'Adegan 5' },
                { value: 5, label: 'Adegan 6' },
              ].map((tab) => (
                <button
                  key={String(tab.value)}
                  type="button"
                  onClick={() => setSlotFilter(tab.value)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    slotFilter === tab.value
                      ? 'bg-white text-[#3A2D32] shadow-xs'
                      : 'text-[#6E5D63] hover:text-[#3A2D32]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {feedback && (
            <p
              className={`text-xs rounded-lg px-3.5 py-2.5 ${
                feedback.type === 'ok'
                  ? 'bg-[#ECF2ED] text-[#3B5B47]'
                  : 'bg-[#FBECEF] text-[#8F3A4E]'
              }`}
            >
              {feedback.text}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[460px] overflow-y-auto pr-1">
            {visibleSlots.map((slot) => {
              const isBusy = busySlotKey === slot.key;
              return (
                <div
                  key={slot.key}
                  className="rounded-xl border border-[#E6DFDB] bg-[#FBF8F6] p-3 flex items-center gap-3"
                >
                  <div className="w-16 h-16 shrink-0 rounded-lg bg-white border border-[#EFE8E4] overflow-hidden flex items-center justify-center p-1">
                    <img
                      src={slot.url}
                      alt={slot.label}
                      referrerPolicy="no-referrer"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-[#6B8E78]">
                        {slot.badge}
                      </span>
                      <p className="text-xs font-semibold text-[#3A2D32] truncate">
                        {slot.label}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => triggerSlotUpload(slot)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#C47D8E] px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-[#B46B7D] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <RefreshCw className={`w-3 h-3 ${isBusy ? 'animate-spin' : ''}`} />
                        <span>{isBusy ? 'Menyimpan...' : 'Upload & Ganti'}</span>
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setPickerSlot(slot)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#DFD6D1] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#3A2D32] hover:bg-[#F4EEEC] transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Grid2x2 className="w-3 h-3 text-[#6E5D63]" />
                        <span>Pilih</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Upload Dropzone for adding new assets to library */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`rounded-2xl border border-dashed p-6 transition-colors ${
          dragActive
            ? 'border-[#C47D8E] bg-[#FBF1F3]'
            : 'border-[#D6CBC6] bg-white'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-medium text-[#3A2D32]">
              Unggah Elemen Floral &amp; Foto Baru ke Pustaka
            </h2>
            <p className="text-xs text-[#6E5D63] mt-1">
              Mendukung PNG transparan, WebP, SVG, atau JPG (maks 8 MB). JPG berlatar putih bisa otomatis dipotong menjadi lapisan 3D transparan.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[#6E5D63] mb-1">
                Nama Aset (Opsional)
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Mis. Mawar Blush Kanan"
                className="rounded-xl border border-[#DFD6D1] bg-[#FBF8F6] px-3 py-2 text-xs text-[#3A2D32] w-44 focus:border-[#C47D8E] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#6E5D63] mb-1">
                Kategori
              </label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value as AssetCategory)}
                className="rounded-xl border border-[#DFD6D1] bg-[#FBF8F6] px-3 py-2 text-xs text-[#3A2D32] focus:border-[#C47D8E] focus:outline-none"
              >
                {CATEGORIES.filter((c) => c.value !== 'all').map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              multiple
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                void handleFiles(e.target.files)
              }
              className="hidden"
            />

            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#6B8E78] px-4 py-2 text-xs font-medium text-white hover:bg-[#5A7B67] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{uploading ? 'Mengunggah...' : 'Unggah ke Pustaka'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1 overflow-x-auto p-1 rounded-xl bg-[#F2ECE9]">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setFilterCat(cat.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filterCat === cat.value
                  ? 'bg-white text-[#3A2D32] shadow-xs'
                  : 'text-[#6E5D63] hover:text-[#3A2D32]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-[#6E5D63] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari aset gambar..."
            className="w-full rounded-xl border border-[#DFD6D1] bg-white pl-9 pr-3 py-2 text-xs text-[#3A2D32] focus:border-[#C47D8E] focus:outline-none"
          />
        </div>
      </div>

      {/* Assets Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#E6DFDB] bg-white py-14 text-center">
          <p className="text-sm text-[#6E5D63]">
            Belum ada aset yang cocok dengan filter ini.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {filtered.map((asset) => (
            <article
              key={asset.id}
              className="rounded-2xl border border-[#E6DFDB] bg-white overflow-hidden flex flex-col"
            >
              <div className="aspect-[4/3] bg-[#FBF8F6] relative overflow-hidden flex items-center justify-center p-2">
                <img
                  src={asset.url}
                  alt={asset.name}
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#3A2D32] truncate">
                    {asset.name}
                  </h3>
                  <p className="text-[11px] text-[#6E5D63] mt-0.5 capitalize">
                    {asset.category}
                    <span className="mx-1.5" aria-hidden="true">
                      ·
                    </span>
                    {asset.hasAlpha ? 'Transparan' : 'Kertas/Foto'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onAddToCanvas(asset)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#6B8E78] px-3 py-2 text-xs font-medium text-white hover:bg-[#5A7B67] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Tambah Layer Baru</span>
                  </button>
                  {!asset.isSystem && (
                    <button
                      type="button"
                      onClick={() => void handleDelete(asset)}
                      aria-label={`Hapus ${asset.name}`}
                      className="rounded-lg border border-[#E6DFDB] p-2 text-[#6E5D63] hover:text-[#8F3A4E] hover:border-[#E5B8C2] transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Visual Library Picker Modal for Slot Replacement */}
      {pickerSlot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3A2D32]/45"
          role="dialog"
          aria-modal="true"
          aria-label={`Pilih gambar pengganti untuk ${pickerSlot.label}`}
        >
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-[#E6DFDB] bg-white overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-[#EFE8E4] flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B8E78]">
                  {pickerSlot.badge}
                </p>
                <h3 className="font-display text-xl font-semibold text-[#3A2D32]">
                  Pilih Pengganti: {pickerSlot.label}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPickerSlot(null)}
                aria-label="Tutup pemilih gambar"
                className="p-1.5 rounded-lg text-[#6E5D63] hover:text-[#3A2D32] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-3">
              {assets.map((asset) => {
                const isCurrent = asset.url === pickerSlot.url;
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => void handlePickLibraryAsset(asset)}
                    className={`rounded-xl border p-2.5 text-left transition-colors cursor-pointer ${
                      isCurrent
                        ? 'border-[#C47D8E] bg-[#FBF1F3]'
                        : 'border-[#E6DFDB] bg-[#FBF8F6] hover:border-[#C47D8E]'
                    }`}
                  >
                    <div className="aspect-[4/3] bg-white rounded-lg overflow-hidden flex items-center justify-center p-1 mb-2 relative">
                      <img
                        src={asset.url}
                        alt={asset.name}
                        referrerPolicy="no-referrer"
                        className="max-w-full max-h-full object-contain"
                      />
                      {isCurrent && (
                        <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#C47D8E] text-white flex items-center justify-center">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-[#3A2D32] truncate">
                      {asset.name}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
