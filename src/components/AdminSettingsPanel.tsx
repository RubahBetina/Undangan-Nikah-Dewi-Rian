import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Minus, Music, Plus, RotateCcw, Save, Trash2, Type, Upload } from 'lucide-react';
import {
  DEFAULT_TYPOGRAPHY,
  FONT_OPTIONS,
  TYPOGRAPHY_SLOT_META,
  getFontCssFamily,
  mergeTypography,
} from '../lib/typography.ts';
import { dataService } from '../services/dataService.ts';
import type {
  GiftAccount,
  InvitationFontId,
  MediaAsset,
  TypographySettings,
  WeddingSettings,
} from '../types/wedding.ts';
import { VenuePlacePicker, type SelectedPlaceResult } from './VenuePlacePicker.tsx';

interface AdminSettingsPanelProps {
  settings: WeddingSettings;
  assets: MediaAsset[];
  onSave: (next: WeddingSettings) => Promise<void>;
  saving: boolean;
}

const PASTEL_SKY_PRESETS = [
  { label: 'Pearl Ivory', hex: '#FBF8F6' },
  { label: 'Blush Whisper', hex: '#FAF2F4' },
  { label: 'Sage Mist', hex: '#F3F6F2' },
  { label: 'Lavender Cloud', hex: '#F6F3FA' },
];

export function AdminSettingsPanel({
  settings,
  assets,
  onSave,
  saving,
}: AdminSettingsPanelProps) {
  const [form, setForm] = useState<WeddingSettings>(() => ({
    ...settings,
    typography: mergeTypography(settings.typography),
  }));
  const [savedNotice, setSavedNotice] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const musicInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setForm({
      ...settings,
      typography: mergeTypography(settings.typography),
    });
  }, [settings]);

  const updateTypographySlot = (
    key: keyof TypographySettings,
    patch: { font?: InvitationFontId; size?: number },
  ) => {
    setForm((prev) => {
      const current = mergeTypography(prev.typography);
      return {
        ...prev,
        typography: {
          ...current,
          [key]: {
            ...current[key],
            ...patch,
          },
        },
      };
    });
  };

  const handleMusicFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMusic(true);
    setErrorMsg(null);
    try {
      const uploaded = await dataService.uploadMusic(file, form.musicTitle);
      const nextForm: WeddingSettings = {
        ...form,
        musicEnabled: true,
        musicUrl: uploaded.url,
        musicTitle: uploaded.title,
      };
      setForm(nextForm);
      await onSave(nextForm);
      setSavedNotice(true);
      window.setTimeout(() => setSavedNotice(false), 3000);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal mengunggah file musik.',
      );
    } finally {
      setUploadingMusic(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSavedNotice(false);
    setErrorMsg(null);
    const brideFirst = form.brideFullName.trim().split(/\s+/)[0] || 'Mempelai Wanita';
    const groomFirst = form.groomFullName.trim().split(/\s+/)[0] || 'Mempelai Pria';
    const payload: WeddingSettings = {
      ...form,
      coupleHeadline: `${groomFirst} & ${brideFirst}`,
      giftBankName: form.giftAccounts?.[0]?.bankName ?? form.giftBankName,
      giftAccountNumber: form.giftAccounts?.[0]?.accountNumber ?? form.giftAccountNumber,
      giftAccountHolder: form.giftAccounts?.[0]?.accountHolder ?? form.giftAccountHolder,
    };
    try {
      await onSave(payload);
      setSavedNotice(true);
      window.setTimeout(() => setSavedNotice(false), 3000);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal menyimpan pengaturan undangan.',
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Header Save Bar */}
      <div className="rounded-2xl border border-[#E6DFDB] bg-white p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#EFE8E4]">
          <div>
            <h2 className="font-display text-2xl font-medium text-[#3A2D32]">
              Pengaturan Tulisan &amp; Elemen Tiap Adegan
            </h2>
            <p className="text-xs text-[#6E5D63] mt-0.5">
              Edit seluruh teks pada gelembung/elemen asap dan pilih gambar gerbang maupun alas asap dari Pustaka Aset.
            </p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#C47D8E] px-5 py-2.5 text-xs font-medium text-white hover:bg-[#B46B7D] disabled:opacity-60 transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
          </button>
        </div>

        {savedNotice && (
          <p className="text-xs rounded-lg bg-[#ECF2ED] text-[#3B5B47] px-3.5 py-2.5">
            Perubahan tulisan, elemen, dan musik undangan berhasil disimpan.
          </p>
        )}

        {errorMsg && (
          <p className="text-xs rounded-lg bg-[#FBECEF] text-[#8F3A4E] px-3.5 py-2.5">
            {errorMsg}
          </p>
        )}

        {/* Gate & Smoke Element Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 shrink-0 rounded-xl border border-[#DFD6D1] bg-[#FBF8F6] overflow-hidden flex items-center justify-center p-1">
              <img
                src={form.gateImageUrl}
                alt="Gerbang Pembuka & Penutup"
                referrerPolicy="no-referrer"
                className="max-w-full max-h-full object-contain"
              />
            </div>
            <div className="min-w-0 flex-1">
              <label className="block text-xs font-medium text-[#3A2D32] mb-1.5">
                Gambar Gerbang Pembuka &amp; Penutup
              </label>
              <select
                value={form.gateImageUrl}
                onChange={(e) => setForm({ ...form, gateImageUrl: e.target.value })}
                className="w-full rounded-xl border border-[#DFD6D1] bg-[#FBF8F6] px-3 py-2 text-xs"
              >
                {assets.map((a) => (
                  <option key={a.id} value={a.url}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 shrink-0 rounded-xl border border-[#DFD6D1] bg-[#FBF8F6] overflow-hidden flex items-center justify-center p-1">
              <img
                src={form.smokeImageUrl}
                alt="Elemen Asap Alas Teks"
                referrerPolicy="no-referrer"
                className="max-w-full max-h-full object-contain"
              />
            </div>
            <div className="min-w-0 flex-1">
              <label className="block text-xs font-medium text-[#3A2D32] mb-1.5">
                Gambar Elemen Asap (Alas Teks)
              </label>
              <select
                value={form.smokeImageUrl}
                onChange={(e) => setForm({ ...form, smokeImageUrl: e.target.value })}
                className="w-full rounded-xl border border-[#DFD6D1] bg-[#FBF8F6] px-3 py-2 text-xs"
              >
                {assets.map((a) => (
                  <option key={a.id} value={a.url}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-[#3A2D32] mb-1.5">
              Warna Atmosfer Kanvas 3D
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {PASTEL_SKY_PRESETS.map((p) => (
                <button
                  key={p.hex}
                  type="button"
                  onClick={() => setForm({ ...form, skyColorHex: p.hex })}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors cursor-pointer ${
                    form.skyColorHex === p.hex
                      ? 'border-[#C47D8E] bg-[#FBF1F3] text-[#3A2D32] font-medium'
                      : 'border-[#DFD6D1] bg-white text-[#6E5D63]'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-[#D6CBC6]"
                    style={{ backgroundColor: p.hex }}
                  />
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Musik Latar Undangan */}
      <div className="rounded-2xl border border-[#E6DFDB] bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#EFE8E4]">
          <div className="flex items-center gap-2.5">
            <Music className="w-5 h-5 text-[#C47D8E]" />
            <div>
              <h3 className="font-display text-2xl font-medium text-[#3A2D32]">
                Musik Latar Undangan
              </h3>
              <p className="text-xs text-[#6E5D63]">
                Unggah file MP3 / M4A / WAV (maks 15 MB) atau tempel tautan audio. Kosongkan untuk memakai melodi harpa instrumental bawaan.
              </p>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-medium text-[#3A2D32] cursor-pointer">
            <input
              type="checkbox"
              checked={form.musicEnabled}
              onChange={(e) => setForm({ ...form, musicEnabled: e.target.checked })}
              className="h-4 w-4 accent-[#C47D8E] rounded cursor-pointer"
            />
            <span>Putar otomatis saat gerbang dibuka</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-[#3A2D32] mb-1.5">
              Judul Lagu
            </label>
            <input
              type="text"
              value={form.musicTitle}
              onChange={(e) => setForm({ ...form, musicTitle: e.target.value })}
              placeholder="Mis. Lagu Pernikahan Kami"
              className="w-full rounded-xl border border-[#DFD6D1] bg-[#FBF8F6] px-3.5 py-2 text-xs"
            />
          </div>

          <div className="md:col-span-5">
            <label className="block text-xs font-medium text-[#3A2D32] mb-1.5">
              Tautan File Audio (MP3/M4A/OGG)
            </label>
            <input
              type="text"
              value={form.musicUrl}
              onChange={(e) => setForm({ ...form, musicUrl: e.target.value })}
              placeholder="Otomatis terisi setelah unggah MP3, atau tempel URL..."
              className="w-full rounded-xl border border-[#DFD6D1] bg-[#FBF8F6] px-3.5 py-2 text-xs font-mono"
            />
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
            <input
              ref={musicInputRef}
              type="file"
              accept="audio/*,.mp3,.m4a,.wav,.ogg"
              onChange={(e) => void handleMusicFile(e)}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploadingMusic}
              onClick={() => musicInputRef.current?.click()}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#6B8E78] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#5A7B67] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{uploadingMusic ? 'Mengunggah...' : 'Unggah MP3'}</span>
            </button>

            {form.musicUrl && (
              <button
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    musicUrl: '',
                    musicTitle: 'Melodi Taman Pastel (Instrumental)',
                  })
                }
                title="Kembali ke instrumental bawaan"
                className="inline-flex items-center justify-center rounded-xl border border-[#DFD6D1] bg-white p-2 text-[#6E5D63] hover:text-[#3A2D32] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {form.musicUrl && (
          <div className="pt-2">
            <audio controls src={form.musicUrl} className="w-full h-9" />
          </div>
        )}
      </div>

      {/* Scene 1 & 2: Pengantin & Ayat Doa */}
      <div className="rounded-2xl border border-[#E6DFDB] bg-white p-6 space-y-5">
        <h3 className="font-display text-2xl font-medium text-[#3A2D32] pb-3 border-b border-[#EFE8E4]">
          Adegan 1 &amp; 2: Nama Pengantin &amp; Ayat / Doa Jalanan Taman
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[#EFE8E4] bg-[#FBF8F6] p-4 space-y-3">
            <p className="text-xs font-semibold text-[#6B8E78]">Mempelai Pria (Sisi Kiri)</p>
            <div>
              <label className="block text-xs font-medium text-[#3A2D32] mb-1">
                Nama Lengkap Mempelai Pria
              </label>
              <input
                type="text"
                value={form.groomFullName}
                onChange={(e) => setForm({ ...form, groomFullName: e.target.value })}
                placeholder="Mis. Dimas Arya Pratama"
                className="w-full rounded-xl border border-[#DFD6D1] bg-white px-3.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3A2D32] mb-1">
                Putra Dari (Orang Tua Mempelai Pria)
              </label>
              <input
                type="text"
                value={form.groomParents}
                onChange={(e) => setForm({ ...form, groomParents: e.target.value })}
                placeholder="Mis. Putra kedua dari Bapak Bambang Pratama & Ibu Sari Dewi"
                className="w-full rounded-xl border border-[#DFD6D1] bg-white px-3.5 py-2 text-xs"
              />
            </div>
          </div>

          <div className="rounded-xl border border-[#EFE8E4] bg-[#FBF8F6] p-4 space-y-3">
            <p className="text-xs font-semibold text-[#C47D8E]">Mempelai Wanita (Sisi Kanan)</p>
            <div>
              <label className="block text-xs font-medium text-[#3A2D32] mb-1">
                Nama Lengkap Mempelai Wanita
              </label>
              <input
                type="text"
                value={form.brideFullName}
                onChange={(e) => setForm({ ...form, brideFullName: e.target.value })}
                placeholder="Mis. Amara Kirana Putri"
                className="w-full rounded-xl border border-[#DFD6D1] bg-white px-3.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3A2D32] mb-1">
                Putri Dari (Orang Tua Mempelai Wanita)
              </label>
              <input
                type="text"
                value={form.brideParents}
                onChange={(e) => setForm({ ...form, brideParents: e.target.value })}
                placeholder="Mis. Putri pertama dari Bapak Hendra Wijaya & Ibu Ratna Kusuma"
                className="w-full rounded-xl border border-[#DFD6D1] bg-white px-3.5 py-2 text-xs"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-medium text-[#3A2D32] mb-1.5">
              Sumber Ayat / Judul Doa (Adegan Jalanan)
            </label>
            <input
              type="text"
              value={form.verseTitle}
              onChange={(e) => setForm({ ...form, verseTitle: e.target.value })}
              className="w-full rounded-xl border border-[#DFD6D1] bg-[#FBF8F6] px-3.5 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-[#3A2D32] mb-1.5">
              Isi Ayat / Doa Berpasang-pasangan
            </label>
            <textarea
              rows={2}
              value={form.verseQuote}
              onChange={(e) => setForm({ ...form, verseQuote: e.target.value })}
              className="w-full rounded-xl border border-[#DFD6D1] bg-[#FBF8F6] px-3.5 py-2 text-sm resize-none"
            />
          </div>
        </div>
      </div>

      {/* Scene 3 & 4: Gazebo Jadwal & Rumah Kaca Alamat */}
      <div className="rounded-2xl border border-[#E6DFDB] bg-white p-6 space-y-5">
        <h3 className="font-display text-2xl font-medium text-[#3A2D32] pb-3 border-b border-[#EFE8E4]">
          Adegan 3 &amp; 4: Gazebo (Akad &amp; Resepsi) &amp; Rumah Kaca (Alamat &amp; Maps)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#3A2D32] mb-1.5">
              Teks Tanggal Acara
            </label>
            <input
              type="text"
              value={form.displayDateText}
              onChange={(e) => setForm({ ...form, displayDateText: e.target.value })}
              className="w-full rounded-xl border border-[#DFD6D1] bg-[#FBF8F6] px-3.5 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#3A2D32] mb-1.5">
              Waktu Hitung Mundur (ISO)
            </label>
            <input
              type="text"
              value={form.weddingDateIso}
              onChange={(e) => setForm({ ...form, weddingDateIso: e.target.value })}
              className="w-full rounded-xl border border-[#DFD6D1] bg-[#FBF8F6] px-3.5 py-2 text-xs font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#3A2D32] mb-1.5">
              Jam Akad &amp; Jam Resepsi
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={form.akadTime}
                onChange={(e) => setForm({ ...form, akadTime: e.target.value })}
                placeholder="Jam Akad"
                className="rounded-xl border border-[#DFD6D1] bg-[#FBF8F6] px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={form.resepsiTime}
                onChange={(e) => setForm({ ...form, resepsiTime: e.target.value })}
                placeholder="Jam Resepsi"
                className="rounded-xl border border-[#DFD6D1] bg-[#FBF8F6] px-3 py-2 text-xs"
              />
            </div>
          </div>
        </div>

        <VenuePlacePicker
          settings={form}
          onSelectPlace={(place: SelectedPlaceResult) => {
            setForm((prev) => ({
              ...prev,
              akadVenue: place.venueName,
              akadAddress: place.address,
              resepsiVenue: place.venueName,
              resepsiAddress: place.address,
              mapsUrl: place.mapsUrl,
              venueLat: place.lat,
              venueLng: place.lng,
              venuePlaceId: place.placeId,
            }));
          }}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#3A2D32] mb-1.5">
              Nama Gedung / Rumah Acara
            </label>
            <input
              type="text"
              value={form.akadVenue}
              onChange={(e) => setForm({ ...form, akadVenue: e.target.value })}
              className="w-full rounded-xl border border-[#DFD6D1] bg-[#FBF8F6] px-3.5 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#3A2D32] mb-1.5">
              Alamat Lengkap
            </label>
            <input
              type="text"
              value={form.akadAddress}
              onChange={(e) => setForm({ ...form, akadAddress: e.target.value })}
              className="w-full rounded-xl border border-[#DFD6D1] bg-[#FBF8F6] px-3.5 py-2 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#3A2D32] mb-1.5">
              Link Google Maps
            </label>
            <input
              type="url"
              value={form.mapsUrl}
              onChange={(e) => setForm({ ...form, mapsUrl: e.target.value })}
              className="w-full rounded-xl border border-[#DFD6D1] bg-[#FBF8F6] px-3.5 py-2 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Scene 5 & 6: Gift & Sky Closing Thanks */}
      <div className="rounded-2xl border border-[#E6DFDB] bg-white p-6 space-y-5">
        <h3 className="font-display text-2xl font-medium text-[#3A2D32] pb-3 border-b border-[#EFE8E4]">
          Adegan 5 &amp; 6: Taman Kado (Wedding Gift) &amp; Langit Terima Kasih
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#3A2D32] mb-1.5">
              Judul Gift
            </label>
            <input
              type="text"
              value={form.giftTitle}
              onChange={(e) => setForm({ ...form, giftTitle: e.target.value })}
              className="w-full rounded-xl border border-[#DFD6D1] bg-[#FBF8F6] px-3.5 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-[#3A2D32] mb-1.5">
              Pesan Pengantar Tanda Kasih
            </label>
            <input
              type="text"
              value={form.giftMessage}
              onChange={(e) => setForm({ ...form, giftMessage: e.target.value })}
              className="w-full rounded-xl border border-[#DFD6D1] bg-[#FBF8F6] px-3.5 py-2 text-xs"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-[#3A2D32]">
                Daftar Rekening / Dompet Digital Tanda Kasih
              </p>
              <p className="text-[11px] text-[#6E5D63]">
                Tambahkan rekening mempelai pria &amp; wanita atau tekan tombol + untuk menambah rekening lainnya.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const current =
                  form.giftAccounts && form.giftAccounts.length > 0
                    ? form.giftAccounts
                    : [
                        {
                          id: 'gift-1',
                          label: 'Mempelai Pria',
                          bankName: form.giftBankName,
                          accountNumber: form.giftAccountNumber,
                          accountHolder: form.giftAccountHolder,
                        },
                      ];
                const nextAccount: GiftAccount = {
                  id: `gift-${Date.now()}`,
                  label:
                    current.length === 1 ? 'Mempelai Wanita' : `Rekening ${current.length + 1}`,
                  bankName: '',
                  accountNumber: '',
                  accountHolder: '',
                };
                setForm({
                  ...form,
                  giftAccounts: [...current, nextAccount],
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#6B8E78] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#5A7B67] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Rekening</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(form.giftAccounts && form.giftAccounts.length > 0
              ? form.giftAccounts
              : [
                  {
                    id: 'gift-1',
                    label: 'Mempelai Pria',
                    bankName: form.giftBankName,
                    accountNumber: form.giftAccountNumber,
                    accountHolder: form.giftAccountHolder,
                  },
                ]
            ).map((acc, index, list) => {
              const updateAccount = (patch: Partial<GiftAccount>) => {
                const updated = list.map((item) =>
                  item.id === acc.id ? { ...item, ...patch } : item,
                );
                setForm({
                  ...form,
                  giftAccounts: updated,
                  giftBankName: updated[0]?.bankName ?? form.giftBankName,
                  giftAccountNumber: updated[0]?.accountNumber ?? form.giftAccountNumber,
                  giftAccountHolder: updated[0]?.accountHolder ?? form.giftAccountHolder,
                });
              };

              const removeAccount = () => {
                const updated = list.filter((item) => item.id !== acc.id);
                setForm({
                  ...form,
                  giftAccounts: updated,
                  giftBankName: updated[0]?.bankName ?? '',
                  giftAccountNumber: updated[0]?.accountNumber ?? '',
                  giftAccountHolder: updated[0]?.accountHolder ?? '',
                });
              };

              return (
                <div
                  key={acc.id}
                  className="rounded-xl border border-[#EFE8E4] bg-[#FBF8F6] p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#C47D8E]">
                      Rekening #{index + 1}
                    </span>
                    {list.length > 1 && (
                      <button
                        type="button"
                        onClick={removeAccount}
                        aria-label={`Hapus rekening ${index + 1}`}
                        className="p-1.5 rounded-lg text-[#8F3A4E] hover:bg-[#FBECEF] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-[#3A2D32] mb-1">
                        Keterangan (Mis. Mempelai Pria)
                      </label>
                      <input
                        type="text"
                        value={acc.label || ''}
                        onChange={(e) => updateAccount({ label: e.target.value })}
                        placeholder="Mempelai Pria / Wanita"
                        className="w-full rounded-xl border border-[#DFD6D1] bg-white px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#3A2D32] mb-1">
                        Nama Bank / E-Wallet
                      </label>
                      <input
                        type="text"
                        value={acc.bankName}
                        onChange={(e) => updateAccount({ bankName: e.target.value })}
                        placeholder="Mis. Bank Mandiri / BCA"
                        className="w-full rounded-xl border border-[#DFD6D1] bg-white px-3 py-2 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-[#3A2D32] mb-1">
                        Nomor Rekening
                      </label>
                      <input
                        type="text"
                        value={acc.accountNumber}
                        onChange={(e) => updateAccount({ accountNumber: e.target.value })}
                        placeholder="Nomor rekening"
                        className="w-full rounded-xl border border-[#DFD6D1] bg-white px-3 py-2 text-xs font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#3A2D32] mb-1">
                        Atas Nama
                      </label>
                      <input
                        type="text"
                        value={acc.accountHolder}
                        onChange={(e) => updateAccount({ accountHolder: e.target.value })}
                        placeholder="a.n. Nama Pemilik"
                        className="w-full rounded-xl border border-[#DFD6D1] bg-white px-3 py-2 text-xs"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-[#EFE8E4]">
          <div>
            <label className="block text-xs font-medium text-[#3A2D32] mb-1.5">
              Judul Penutup (Adegan Langit)
            </label>
            <input
              type="text"
              value={form.closingThanksTitle}
              onChange={(e) =>
                setForm({ ...form, closingThanksTitle: e.target.value })
              }
              className="w-full rounded-xl border border-[#DFD6D1] bg-[#FBF8F6] px-3.5 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-[#3A2D32] mb-1.5">
              Ucapan Terima Kasih Penutup
            </label>
            <textarea
              rows={2}
              value={form.closingThanksMessage}
              onChange={(e) =>
                setForm({ ...form, closingThanksMessage: e.target.value })
              }
              className="w-full rounded-xl border border-[#DFD6D1] bg-[#FBF8F6] px-3.5 py-2 text-sm resize-none"
            />
          </div>
        </div>
      </div>

      {/* Pengaturan Jenis Font & Ukuran Setiap Tulisan */}
      <div className="rounded-2xl border border-[#E6DFDB] bg-white p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#EFE8E4]">
          <div className="flex items-center gap-2.5">
            <Type className="w-5 h-5 text-[#C47D8E]" />
            <div>
              <h3 className="font-display text-2xl font-medium text-[#3A2D32]">
                Tipografi: Jenis Font &amp; Ukuran Setiap Tulisan
              </h3>
              <p className="text-xs text-[#6E5D63]">
                Atur gaya huruf (Kaligrafi, Serif, atau Sans) dan ukuran (px) masing-masing bagian teks sesuai selera Anda.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  typography: { ...DEFAULT_TYPOGRAPHY },
                }))
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#DFD6D1] bg-[#FBF8F6] px-3 py-2 text-xs font-medium text-[#6E5D63] hover:text-[#3A2D32] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Font Bawaan</span>
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#C47D8E] px-4 py-2 text-xs font-medium text-white hover:bg-[#B46B7D] disabled:opacity-60 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Semua'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {TYPOGRAPHY_SLOT_META.map((slotMeta) => {
            const activeTypo = mergeTypography(form.typography)[slotMeta.key];
            const previewSize = Math.min(34, Math.max(11, activeTypo.size));
            const dynamicSample =
              slotMeta.key === 'coupleNames' || slotMeta.key === 'gateCouple'
                ? `${form.groomFullName || 'Mempelai Pria'} & ${form.brideFullName || 'Mempelai Wanita'}`
                : slotMeta.key === 'closingTitle'
                  ? form.closingThanksTitle || slotMeta.sampleText
                  : slotMeta.sampleText;

            return (
              <div
                key={slotMeta.key}
                className="rounded-xl border border-[#EFE8E4] bg-[#FBF8F6] p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-[#3A2D32]">
                      {slotMeta.label}
                    </p>
                    <span className="inline-block text-[10px] font-medium text-[#6B8E78] mt-0.5">
                      {slotMeta.sceneTag}
                    </span>
                  </div>
                  <span className="rounded-lg bg-white border border-[#E6DFDB] px-2 py-0.5 text-[11px] font-mono font-semibold text-[#3A2D32] tabular-nums">
                    {activeTypo.size} px
                  </span>
                </div>

                {/* Live Typography Preview */}
                <div className="rounded-xl border border-[#E6DFDB] bg-white px-3.5 py-2.5 min-h-[52px] flex items-center justify-center text-center overflow-hidden">
                  <span
                    style={{
                      fontFamily: getFontCssFamily(activeTypo.font),
                      fontSize: `${previewSize}px`,
                    }}
                    className="font-bold text-[#3A2D32] leading-tight break-words"
                  >
                    {dynamicSample}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                  <div className="sm:col-span-6">
                    <label className="block text-[10px] font-medium text-[#6E5D63] mb-1">
                      Jenis Font
                    </label>
                    <select
                      value={activeTypo.font}
                      onChange={(e) =>
                        updateTypographySlot(slotMeta.key, {
                          font: e.target.value as InvitationFontId,
                        })
                      }
                      className="w-full rounded-xl border border-[#DFD6D1] bg-white px-2.5 py-1.5 text-xs text-[#3A2D32]"
                    >
                      {(['Kaligrafi', 'Serif Elegan', 'Sans Modern'] as const).map(
                        (cat) => (
                          <optgroup key={cat} label={cat}>
                            {FONT_OPTIONS.filter((f) => f.category === cat).map(
                              (opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label}
                                </option>
                              ),
                            )}
                          </optgroup>
                        ),
                      )}
                    </select>
                  </div>

                  <div className="sm:col-span-6">
                    <label className="block text-[10px] font-medium text-[#6E5D63] mb-1">
                      Ukuran HP ({slotMeta.minSize}–{slotMeta.maxSize} px)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          updateTypographySlot(slotMeta.key, {
                            size: Math.max(slotMeta.minSize, activeTypo.size - 1),
                          })
                        }
                        aria-label={`Perkecil ukuran ${slotMeta.label}`}
                        className="p-1.5 rounded-lg border border-[#DFD6D1] bg-white text-[#3A2D32] hover:bg-[#FBF8F6] cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="range"
                        min={slotMeta.minSize}
                        max={slotMeta.maxSize}
                        step={1}
                        value={activeTypo.size}
                        onChange={(e) =>
                          updateTypographySlot(slotMeta.key, {
                            size: Number(e.target.value),
                          })
                        }
                        className="flex-1 accent-[#C47D8E] cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateTypographySlot(slotMeta.key, {
                            size: Math.min(slotMeta.maxSize, activeTypo.size + 1),
                          })
                        }
                        aria-label={`Perbesar ukuran ${slotMeta.label}`}
                        className="p-1.5 rounded-lg border border-[#DFD6D1] bg-white text-[#3A2D32] hover:bg-[#FBF8F6] cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </form>
  );
}
