import { useState } from 'react';
import { Check, Download, Pencil, Search, Trash2, X } from 'lucide-react';
import type { RsvpEntry, WishEntry } from '../types/wedding.ts';

interface AdminRsvpPanelProps {
  rsvps: RsvpEntry[];
  wishes: WishEntry[];
  onUpdateRsvp: (
    id: string,
    patch: Partial<
      Pick<RsvpEntry, 'guestName' | 'attendance' | 'guestCount' | 'sessionChoice' | 'message'>
    >,
  ) => Promise<void>;
  onDeleteRsvp: (id: string) => Promise<void>;
  onUpdateWish: (
    id: string,
    patch: Partial<Pick<WishEntry, 'guestName' | 'message'>>,
  ) => Promise<void>;
  onDeleteWish: (id: string) => Promise<void>;
}

const ATTENDANCE_LABELS: Record<RsvpEntry['attendance'], string> = {
  hadir: 'Hadir',
  ragu: 'Menyesuaikan',
  tidak_hadir: 'Tidak Hadir',
};

const SESSION_LABELS: Record<RsvpEntry['sessionChoice'], string> = {
  akad_resepsi: 'Akad & Resepsi',
  akad_only: 'Akad Saja',
  resepsi_only: 'Resepsi Saja',
};

export function AdminRsvpPanel({
  rsvps,
  wishes,
  onUpdateRsvp,
  onDeleteRsvp,
  onUpdateWish,
  onDeleteWish,
}: AdminRsvpPanelProps) {
  const [filter, setFilter] = useState<'all' | RsvpEntry['attendance']>('all');
  const [search, setSearch] = useState('');

  // Inline edit state for RSVP rows
  const [editingRsvpId, setEditingRsvpId] = useState<string | null>(null);
  const [rsvpDraft, setRsvpDraft] = useState<{
    guestName: string;
    attendance: RsvpEntry['attendance'];
    guestCount: number;
    sessionChoice: RsvpEntry['sessionChoice'];
    message: string;
  }>({
    guestName: '',
    attendance: 'hadir',
    guestCount: 1,
    sessionChoice: 'akad_resepsi',
    message: '',
  });
  const [savingRsvpId, setSavingRsvpId] = useState<string | null>(null);

  // Inline edit state for Wish items
  const [editingWishId, setEditingWishId] = useState<string | null>(null);
  const [wishDraft, setWishDraft] = useState<{ guestName: string; message: string }>({
    guestName: '',
    message: '',
  });
  const [savingWishId, setSavingWishId] = useState<string | null>(null);

  const attendingList = rsvps.filter((r) => r.attendance === 'hadir');
  const totalSeats = attendingList.reduce((acc, r) => acc + r.guestCount, 0);

  const filteredRsvps = rsvps.filter((r) => {
    const matchFilter = filter === 'all' || r.attendance === filter;
    const matchSearch =
      !search.trim() ||
      r.guestName.toLowerCase().includes(search.toLowerCase()) ||
      r.message.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const startEditRsvp = (r: RsvpEntry) => {
    setEditingRsvpId(r.id);
    setRsvpDraft({
      guestName: r.guestName,
      attendance: r.attendance,
      guestCount: r.guestCount,
      sessionChoice: r.sessionChoice,
      message: r.message,
    });
  };

  const handleSaveRsvp = async (id: string) => {
    if (!rsvpDraft.guestName.trim()) return;
    setSavingRsvpId(id);
    try {
      await onUpdateRsvp(id, {
        guestName: rsvpDraft.guestName.trim(),
        attendance: rsvpDraft.attendance,
        guestCount: rsvpDraft.guestCount,
        sessionChoice: rsvpDraft.sessionChoice,
        message: rsvpDraft.message.trim(),
      });
      setEditingRsvpId(null);
    } finally {
      setSavingRsvpId(null);
    }
  };

  const startEditWish = (w: WishEntry) => {
    setEditingWishId(w.id);
    setWishDraft({ guestName: w.guestName, message: w.message });
  };

  const handleSaveWish = async (id: string) => {
    if (!wishDraft.guestName.trim() || !wishDraft.message.trim()) return;
    setSavingWishId(id);
    try {
      await onUpdateWish(id, {
        guestName: wishDraft.guestName.trim(),
        message: wishDraft.message.trim(),
      });
      setEditingWishId(null);
    } finally {
      setSavingWishId(null);
    }
  };

  const handleExportCsv = () => {
    const header = ['Nama Tamu', 'Kehadiran', 'Jumlah Kursi', 'Sesi', 'Ucapan', 'Waktu'];
    const rows = rsvps.map((r) => [
      `"${r.guestName.replace(/"/g, '""')}"`,
      ATTENDANCE_LABELS[r.attendance],
      String(r.guestCount),
      SESSION_LABELS[r.sessionChoice],
      `"${r.message.replace(/"/g, '""')}"`,
      r.createdAt,
    ]);
    const csv = [header.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'daftar-rsvp-undangan.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 4-Column Tabular Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Konfirmasi', value: rsvps.length },
          { label: 'Konfirmasi Hadir', value: attendingList.length },
          { label: 'Estimasi Kursi Tamu', value: totalSeats },
          { label: 'Ucapan Buku Tamu', value: wishes.length },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-[#E6DFDB] bg-white px-5 py-4"
          >
            <p className="text-xs text-[#6E5D63]">{metric.label}</p>
            <p className="font-display text-3xl font-semibold text-[#3A2D32] tabular-nums mt-1">
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      {/* RSVP Data Grid */}
      <section className="rounded-2xl border border-[#E6DFDB] bg-white p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F4EEEC]">
            {(
              [
                { value: 'all', label: 'Semua' },
                { value: 'hadir', label: 'Hadir' },
                { value: 'ragu', label: 'Menyesuaikan' },
                { value: 'tidak_hadir', label: 'Tidak Hadir' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setFilter(tab.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  filter === tab.value
                    ? 'bg-white text-[#3A2D32] shadow-xs'
                    : 'text-[#6E5D63] hover:text-[#3A2D32]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 text-[#6E5D63] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama tamu..."
                className="w-full rounded-xl border border-[#DFD6D1] bg-[#FBF8F6] pl-8 pr-3 py-2 text-xs focus:border-[#C47D8E] focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#DFD6D1] bg-white px-3.5 py-2 text-xs font-medium text-[#3A2D32] hover:bg-[#FBF8F6] cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#EFE8E4] text-[#6E5D63]">
                <th className="py-3 px-2 font-medium">Nama Tamu</th>
                <th className="py-3 px-2 font-medium">Status</th>
                <th className="py-3 px-2 font-medium text-right">Kursi</th>
                <th className="py-3 px-2 font-medium">Sesi</th>
                <th className="py-3 px-2 font-medium">Ucapan</th>
                <th className="py-3 px-2 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4EEEC]">
              {filteredRsvps.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#6E5D63]">
                    Belum ada data RSVP yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredRsvps.map((r) => {
                  const isEditing = editingRsvpId === r.id;
                  if (isEditing) {
                    return (
                      <tr key={r.id} className="bg-[#FBF1F3]/45">
                        <td className="py-2.5 px-2">
                          <input
                            type="text"
                            value={rsvpDraft.guestName}
                            onChange={(e) =>
                              setRsvpDraft({ ...rsvpDraft, guestName: e.target.value })
                            }
                            className="w-full min-w-[120px] rounded-lg border border-[#DFD6D1] bg-white px-2.5 py-1.5 text-xs"
                          />
                        </td>
                        <td className="py-2.5 px-2">
                          <select
                            value={rsvpDraft.attendance}
                            onChange={(e) =>
                              setRsvpDraft({
                                ...rsvpDraft,
                                attendance: e.target.value as RsvpEntry['attendance'],
                              })
                            }
                            className="rounded-lg border border-[#DFD6D1] bg-white px-2 py-1.5 text-xs"
                          >
                            <option value="hadir">Hadir</option>
                            <option value="ragu">Menyesuaikan</option>
                            <option value="tidak_hadir">Tidak Hadir</option>
                          </select>
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={rsvpDraft.guestCount}
                            onChange={(e) =>
                              setRsvpDraft({
                                ...rsvpDraft,
                                guestCount: Number(e.target.value) || 1,
                              })
                            }
                            className="w-14 rounded-lg border border-[#DFD6D1] bg-white px-2 py-1.5 text-xs text-right tabular-nums"
                          />
                        </td>
                        <td className="py-2.5 px-2">
                          <select
                            value={rsvpDraft.sessionChoice}
                            onChange={(e) =>
                              setRsvpDraft({
                                ...rsvpDraft,
                                sessionChoice: e.target.value as RsvpEntry['sessionChoice'],
                              })
                            }
                            className="rounded-lg border border-[#DFD6D1] bg-white px-2 py-1.5 text-xs"
                          >
                            <option value="akad_resepsi">Akad &amp; Resepsi</option>
                            <option value="akad_only">Akad Saja</option>
                            <option value="resepsi_only">Resepsi Saja</option>
                          </select>
                        </td>
                        <td className="py-2.5 px-2">
                          <input
                            type="text"
                            value={rsvpDraft.message}
                            onChange={(e) =>
                              setRsvpDraft({ ...rsvpDraft, message: e.target.value })
                            }
                            placeholder="Ucapan / catatan..."
                            className="w-full min-w-[160px] rounded-lg border border-[#DFD6D1] bg-white px-2.5 py-1.5 text-xs"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              disabled={savingRsvpId === r.id}
                              onClick={() => void handleSaveRsvp(r.id)}
                              title="Simpan perubahan RSVP"
                              className="p-1.5 rounded-lg bg-[#6B8E78] text-white hover:bg-[#5A7B67] cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingRsvpId(null)}
                              title="Batal"
                              className="p-1.5 rounded-lg border border-[#DFD6D1] bg-white text-[#6E5D63] hover:text-[#3A2D32] cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={r.id} className="hover:bg-[#FBF8F6]">
                      <td className="py-3 px-2 font-semibold text-[#3A2D32]">
                        {r.guestName}
                      </td>
                      <td className="py-3 px-2">
                        <span
                          className={`font-medium ${
                            r.attendance === 'hadir'
                              ? 'text-[#3B5B47]'
                              : r.attendance === 'tidak_hadir'
                                ? 'text-[#8F3A4E]'
                                : 'text-[#8A6A3A]'
                          }`}
                        >
                          {ATTENDANCE_LABELS[r.attendance]}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right font-mono tabular-nums text-[#3A2D32]">
                        {r.guestCount}
                      </td>
                      <td className="py-3 px-2 text-[#6E5D63]">
                        {SESSION_LABELS[r.sessionChoice]}
                      </td>
                      <td className="py-3 px-2 text-[#3A2D32]/85 max-w-xs truncate">
                        {r.message || '—'}
                      </td>
                      <td className="py-3 px-2 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEditRsvp(r)}
                            aria-label={`Edit RSVP ${r.guestName}`}
                            title="Edit RSVP"
                            className="p-1.5 text-[#6E5D63] hover:text-[#3A2D32] cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDeleteRsvp(r.id)}
                            aria-label={`Hapus RSVP ${r.guestName}`}
                            title="Hapus RSVP"
                            className="p-1.5 text-[#6E5D63] hover:text-[#8F3A4E] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Wishes Moderation List */}
      <section className="rounded-2xl border border-[#E6DFDB] bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl font-medium text-[#3A2D32]">
            Moderasi Buku Ucapan ({wishes.length})
          </h3>
          <span className="text-[11px] text-[#6E5D63]">
            Klik ikon pensil untuk mengubah teks ucapan bawaan maupun dari tamu
          </span>
        </div>

        <div className="divide-y divide-[#F4EEEC]">
          {wishes.length === 0 ? (
            <p className="py-6 text-center text-xs text-[#6E5D63]">
              Belum ada ucapan tamu yang ditampilkan.
            </p>
          ) : (
            wishes.map((w) => {
              const isEditing = editingWishId === w.id;
              if (isEditing) {
                return (
                  <div key={w.id} className="py-3 space-y-2.5 bg-[#FBF1F3]/40 px-3 rounded-xl my-1">
                    <input
                      type="text"
                      value={wishDraft.guestName}
                      onChange={(e) =>
                        setWishDraft({ ...wishDraft, guestName: e.target.value })
                      }
                      placeholder="Nama pengirim ucapan"
                      className="w-full rounded-lg border border-[#DFD6D1] bg-white px-3 py-1.5 text-xs font-semibold text-[#3A2D32]"
                    />
                    <textarea
                      rows={2}
                      value={wishDraft.message}
                      onChange={(e) =>
                        setWishDraft({ ...wishDraft, message: e.target.value })
                      }
                      placeholder="Isi ucapan / doa..."
                      className="w-full rounded-lg border border-[#DFD6D1] bg-white px-3 py-1.5 text-xs text-[#3A2D32] resize-none"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingWishId(null)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#DFD6D1] bg-white px-3 py-1 text-[11px] font-medium text-[#6E5D63] cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                        <span>Batal</span>
                      </button>
                      <button
                        type="button"
                        disabled={savingWishId === w.id}
                        onClick={() => void handleSaveWish(w.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#6B8E78] px-3 py-1 text-[11px] font-medium text-white hover:bg-[#5A7B67] cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        <span>{savingWishId === w.id ? 'Menyimpan...' : 'Simpan'}</span>
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={w.id}
                  className="py-3 flex items-start justify-between gap-4"
                >
                  <div>
                    <p className="text-xs font-semibold text-[#3A2D32]">
                      {w.guestName}
                      <span className="mx-2 font-normal text-[#6E5D63]" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-normal text-[#6E5D63] tabular-nums">
                        {new Date(w.createdAt).toLocaleDateString('id-ID')}
                      </span>
                    </p>
                    <p className="text-xs text-[#3A2D32]/85 mt-1 leading-relaxed">
                      {w.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEditWish(w)}
                      aria-label={`Edit ucapan ${w.guestName}`}
                      title="Edit Ucapan"
                      className="p-1.5 text-[#6E5D63] hover:text-[#3A2D32] cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteWish(w.id)}
                      aria-label={`Hapus ucapan ${w.guestName}`}
                      title="Hapus Ucapan"
                      className="p-1.5 text-[#6E5D63] hover:text-[#8F3A4E] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
