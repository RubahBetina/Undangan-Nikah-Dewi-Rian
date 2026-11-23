import { useRef, useState, type ChangeEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Copy,
  Eye,
  EyeOff,
  Maximize2,
  Monitor,
  Move,
  Orbit,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Save,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { dataService } from '../services/dataService.ts';
import {
  isBackdropElement,
  MentalCanvas3D,
  type GizmoMode,
  type MentalCanvas3DHandle,
} from './MentalCanvas3D.tsx';
import type { CameraStop, CanvasElement, MediaAsset } from '../types/wedding.ts';

interface AdminCanvasStudioProps {
  elements: CanvasElement[];
  cameraStops: CameraStop[];
  assets: MediaAsset[];
  skyColorHex: string;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onElementsChange: (next: CanvasElement[]) => void;
  onCameraStopsChange: (next: CameraStop[]) => void;
  onSaveCanvas: () => Promise<void>;
  onResetCanvas?: () => Promise<void>;
  onReplaceElementAsset?: (
    slotType: 'gate' | 'smoke' | 'element',
    targetId: string,
    asset: MediaAsset,
  ) => Promise<void>;
  onAssetsChange?: (next: MediaAsset[]) => void;
  saving: boolean;
}

export function AdminCanvasStudio({
  elements,
  cameraStops,
  assets,
  skyColorHex,
  selectedElementId,
  onSelectElement,
  onElementsChange,
  onCameraStopsChange,
  onSaveCanvas,
  onResetCanvas,
  onReplaceElementAsset,
  onAssetsChange,
  saving,
}: AdminCanvasStudioProps) {
  const [isOrbitMode, setIsOrbitMode] = useState(false);
  const [previewFrame, setPreviewFrame] = useState<'wide' | 'phone'>('wide');
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('translate');
  const [scrubProgress, setScrubProgress] = useState(0);
  const [inspectorTab, setInspectorTab] = useState<'layers' | 'camera'>('layers');
  const [confirmReset, setConfirmReset] = useState(false);
  const [uploadingReplace, setUploadingReplace] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);

  const canvasRef = useRef<MentalCanvas3DHandle | null>(null);
  const replaceFileRef = useRef<HTMLInputElement | null>(null);

  const selectedElement =
    elements.find((e) => e.id === selectedElementId) || null;

  const updateElement = (id: string, patch: Partial<CanvasElement>) => {
    onElementsChange(
      elements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
    );
  };

  const handleDuplicate = (el: CanvasElement) => {
    const copy: CanvasElement = {
      ...el,
      id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: `${el.label} (Salinan)`,
      x: Number((el.x + 0.8).toFixed(2)),
      z: Number((el.z - 0.6).toFixed(2)),
      sortOrder: elements.length + 1,
    };
    onElementsChange([...elements, copy]);
    onSelectElement(copy.id);
  };

  const handleDeleteElement = (id: string) => {
    onElementsChange(elements.filter((el) => el.id !== id));
    if (selectedElementId === id) {
      onSelectElement(null);
    }
  };

  const handleQuickAddAsset = (asset: MediaAsset) => {
    const activeStop =
      [...cameraStops].sort(
        (a, b) =>
          Math.abs(a.scrollAt - scrubProgress) -
          Math.abs(b.scrollAt - scrubProgress),
      )[0] || cameraStops[0];
    const targetX = activeStop ? activeStop.lookX : 0;
    const targetY = activeStop ? activeStop.lookY : 0;
    const targetZ = activeStop
      ? Number((activeStop.camZ - 7.5).toFixed(1))
      : Number((6.5 - scrubProgress * 50 - 7.5).toFixed(1));

    const newEl: CanvasElement = {
      id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      assetId: asset.id,
      label: asset.name,
      url: asset.url,
      x: Number(targetX.toFixed(2)),
      y: Number(targetY.toFixed(2)),
      z: targetZ,
      scale: 3.6,
      rotX: 0,
      rotY: 0,
      rotZ: 0,
      opacity: 0.98,
      removeWhiteBg: !asset.hasAlpha && asset.category !== 'backdrop',
      swayAmplitude: 0.025,
      swaySpeed: 0.85,
      floatAmplitude: 0.04,
      chapterIndex: activeStop?.chapterIndex ?? Math.min(5, Math.round(scrubProgress * 5)),
      sortOrder: elements.length + 1,
      visible: true,
    };
    onElementsChange([...elements, newEl]);
    onSelectElement(newEl.id);
  };

  const handleCaptureCameraToStop = (stopId: string) => {
    if (!canvasRef.current) return;
    const pose = canvasRef.current.getCurrentCameraPose();
    onCameraStopsChange(
      cameraStops.map((s) => (s.id === stopId ? { ...s, ...pose } : s)),
    );
  };

  const updateStop = (stopId: string, patch: Partial<CameraStop>) => {
    onCameraStopsChange(
      cameraStops.map((s) => (s.id === stopId ? { ...s, ...patch } : s)),
    );
  };

  const sortedByDepth = [...elements].sort(
    (a, b) => b.z - a.z || b.sortOrder - a.sortOrder,
  );

  const handleMoveLayer = (id: string, direction: 'up' | 'down') => {
    const idx = sortedByDepth.findIndex((el) => el.id === id);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sortedByDepth.length) return;

    const current = sortedByDepth[idx];
    const neighbor = sortedByDepth[targetIdx];

    // Swap in Front->Back array, adjust Z just past neighbor if needed, and re-index sortOrder
    const reordered = [...sortedByDepth];
    reordered[idx] = neighbor;
    reordered[targetIdx] = {
      ...current,
      z:
        direction === 'up'
          ? current.z <= neighbor.z
            ? Number(Math.min(10, neighbor.z + 0.1).toFixed(1))
            : current.z
          : current.z >= neighbor.z
            ? Number(Math.max(-70, neighbor.z - 0.1).toFixed(1))
            : current.z,
    };

    const updatedMap = new Map<string, CanvasElement>();
    const total = reordered.length;
    reordered.forEach((item, pos) => {
      updatedMap.set(item.id, { ...item, sortOrder: total - pos });
    });

    onElementsChange(elements.map((el) => updatedMap.get(el.id) || el));
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left/Center 3D Viewport & Timeline */}
      <div className="xl:col-span-8 space-y-4">
        {/* Viewport Toolbar */}
        <div className="rounded-2xl border border-[#E6DFDB] bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F4EEEC]">
            <button
              type="button"
              onClick={() => setIsOrbitMode(false)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                !isOrbitMode
                  ? 'bg-white text-[#3A2D32] shadow-xs'
                  : 'text-[#6E5D63] hover:text-[#3A2D32]'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Pratinjau Scroll</span>
            </button>
            <button
              type="button"
              onClick={() => setIsOrbitMode(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                isOrbitMode
                  ? 'bg-white text-[#3A2D32] shadow-xs'
                  : 'text-[#6E5D63] hover:text-[#3A2D32]'
              }`}
            >
              <Orbit className="w-3.5 h-3.5" />
              <span>Orbit 3D & Gizmo</span>
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F4EEEC]">
            <button
              type="button"
              onClick={() => setPreviewFrame('wide')}
              title="Tampilan kanvas lebar"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                previewFrame === 'wide'
                  ? 'bg-white text-[#3A2D32] shadow-xs'
                  : 'text-[#6E5D63] hover:text-[#3A2D32]'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Layar Penuh</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewFrame('phone')}
              title="Simulasikan bingkai layar HP (9:16)"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                previewFrame === 'phone'
                  ? 'bg-white text-[#3A2D32] shadow-xs'
                  : 'text-[#6E5D63] hover:text-[#3A2D32]'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>HP (9:16)</span>
            </button>
          </div>

          {isOrbitMode ? (
            <div className="flex items-center gap-1.5">
              {(
                [
                  { mode: 'translate', label: 'Geser', icon: Move },
                  { mode: 'rotate', label: 'Putar', icon: RotateCw },
                  { mode: 'scale', label: 'Skala', icon: Maximize2 },
                ] as const
              ).map(({ mode, label, icon: Icon }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setGizmoMode(mode)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    gizmoMode === mode
                      ? 'bg-[#6B8E78] text-white'
                      : 'bg-[#FBF8F6] text-[#6E5D63] hover:text-[#3A2D32]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-1 min-w-[220px] max-w-md">
              <span className="text-[11px] font-medium text-[#6E5D63] whitespace-nowrap">
                Simulasi Scroll
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={scrubProgress}
                onChange={(e) => setScrubProgress(Number(e.target.value))}
                aria-label="Simulasi Scroll Undangan"
                className="flex-1 accent-[#C47D8E] cursor-pointer"
              />
              <span className="text-xs font-mono tabular-nums text-[#3A2D32] w-10 text-right">
                {Math.round(scrubProgress * 100)}%
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            {onResetCanvas && (
              confirmReset ? (
                <div className="inline-flex items-center gap-1.5 rounded-xl border border-[#E7C6CE] bg-[#FBECEF] px-2.5 py-1.5 text-[11px]">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setConfirmReset(false);
                      void onResetCanvas();
                    }}
                    className="font-semibold text-[#8F3A4E] hover:underline cursor-pointer"
                  >
                    Ya, Reset Pabrik
                  </button>
                  <span className="text-[#C79BA6]">|</span>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="text-[#6E5D63] hover:text-[#3A2D32] cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  title="Kembalikan posisi elemen & jalur kamera setelan pabrik"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#DFD6D1] bg-white px-3 py-2 text-xs font-medium text-[#6E5D63] hover:text-[#3A2D32] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )
            )}

            <button
              type="button"
              disabled={saving}
              onClick={() => void onSaveCanvas()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#C47D8E] px-4 py-2 text-xs font-medium text-white hover:bg-[#B46B7D] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Kanvas 3D'}</span>
            </button>
          </div>
        </div>

        {/* 3D Mental Canvas Stage */}
        <div
          className={
            previewFrame === 'phone'
              ? 'rounded-2xl border border-[#E6DFDB] bg-[#EFE9E6]/65 p-3 sm:p-4 flex justify-center'
              : ''
          }
        >
          <div
            className={`relative rounded-2xl border border-[#E6DFDB] overflow-hidden bg-[#FBF8F6] transition-all duration-200 ${
              previewFrame === 'phone'
                ? 'w-full max-w-[340px] h-[600px] shadow-md'
                : 'w-full h-[480px] lg:h-[540px]'
            }`}
          >
            <MentalCanvas3D
              ref={canvasRef}
              elements={elements}
              cameraStops={cameraStops}
              scrollProgress={scrubProgress}
              skyColorHex={skyColorHex}
              mode="editor"
              isOrbitMode={isOrbitMode}
              gizmoMode={gizmoMode}
              selectedElementId={selectedElementId}
              onSelectElement={onSelectElement}
              onTransformElement={updateElement}
            />

            {/* Quick chapter jump chips inside bottom bar of viewport when in scrub mode */}
            {!isOrbitMode && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 max-w-[calc(100%-1.5rem)] overflow-x-auto flex items-center gap-1.5 rounded-xl border border-[#E6DFDB] bg-white/94 px-2.5 py-1.5 shadow-sm">
                {cameraStops.map((stop) => (
                  <button
                    key={stop.id}
                    type="button"
                    onClick={() => setScrubProgress(stop.scrollAt)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      Math.abs(scrubProgress - stop.scrollAt) < 0.09
                        ? 'bg-[#C47D8E] text-white'
                        : 'text-[#6E5D63] hover:text-[#3A2D32] hover:bg-[#FBF8F6]'
                    }`}
                  >
                    {stop.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Asset Strip */}
        <div className="rounded-2xl border border-[#E6DFDB] bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[#3A2D32]">
              Tambahkan Elemen ke Kanvas 3D
            </h3>
            <span className="text-[11px] text-[#6E5D63]">
              Klik gambar untuk menaruh lapisan baru di kedalaman saat ini
            </span>
          </div>
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {assets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => handleQuickAddAsset(asset)}
                className="group shrink-0 w-24 rounded-xl border border-[#E6DFDB] bg-[#FBF8F6] p-2 text-left hover:border-[#C47D8E] transition-colors cursor-pointer"
              >
                <div className="h-14 flex items-center justify-center overflow-hidden rounded-lg bg-white mb-1.5 relative">
                  <img
                    src={asset.url}
                    alt={asset.name}
                    referrerPolicy="no-referrer"
                    className="max-h-full max-w-full object-contain"
                  />
                  <span className="absolute inset-0 bg-[#3A2D32]/0 group-hover:bg-[#3A2D32]/15 flex items-center justify-center transition-colors">
                    <Plus className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
                  </span>
                </div>
                <p className="text-[11px] font-medium text-[#3A2D32] truncate">
                  {asset.name}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Property & Layer Inspector */}
      <aside className="xl:col-span-4 rounded-2xl border border-[#E6DFDB] bg-white p-5 space-y-5">
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F4EEEC]">
          <button
            type="button"
            onClick={() => setInspectorTab('layers')}
            className={`py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              inspectorTab === 'layers'
                ? 'bg-white text-[#3A2D32] shadow-xs'
                : 'text-[#6E5D63] hover:text-[#3A2D32]'
            }`}
          >
            Lapisan & Kedalaman
          </button>
          <button
            type="button"
            onClick={() => setInspectorTab('camera')}
            className={`py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              inspectorTab === 'camera'
                ? 'bg-white text-[#3A2D32] shadow-xs'
                : 'text-[#6E5D63] hover:text-[#3A2D32]'
            }`}
          >
            Jalur Kamera ({cameraStops.length})
          </button>
        </div>

        {inspectorTab === 'layers' ? (
          <>
            {/* Layer Stack */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-[#3A2D32]">
                  Susunan Lapisan (Depan → Belakang)
                </h3>
                <span className="text-[11px] text-[#6E5D63] tabular-nums">
                  {elements.length} elemen
                </span>
              </div>

              <div className="max-h-56 overflow-y-auto divide-y divide-[#F2ECE9] border border-[#E6DFDB] rounded-xl">
                {sortedByDepth.map((el, idx) => {
                  const isSel = el.id === selectedElementId;
                  return (
                    <div
                      key={el.id}
                      className={`flex items-center justify-between gap-1.5 px-2.5 py-2 text-xs transition-colors ${
                        isSel ? 'bg-[#FBF1F3]' : 'hover:bg-[#FBF8F6]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectElement(el.id)}
                        className="flex-1 min-w-0 text-left truncate font-medium text-[#3A2D32] cursor-pointer"
                      >
                        {el.label}
                      </button>
                      <span className="text-[11px] font-mono tabular-nums text-[#6E5D63] shrink-0">
                        Z:{el.z.toFixed(1)}
                      </span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveLayer(el.id, 'up')}
                          title="Naikkan lapisan (lebih depan)"
                          aria-label={`Naikkan ${el.label}`}
                          className="p-1 text-[#6E5D63] hover:text-[#3A2D32] disabled:opacity-30 cursor-pointer disabled:cursor-default"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === sortedByDepth.length - 1}
                          onClick={() => handleMoveLayer(el.id, 'down')}
                          title="Turunkan lapisan (lebih belakang)"
                          aria-label={`Turunkan ${el.label}`}
                          className="p-1 text-[#6E5D63] hover:text-[#3A2D32] disabled:opacity-30 cursor-pointer disabled:cursor-default"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateElement(el.id, { visible: !el.visible })
                          }
                          aria-label={el.visible ? 'Sembunyikan' : 'Tampilkan'}
                          className="p-1 text-[#6E5D63] hover:text-[#3A2D32] cursor-pointer"
                        >
                          {el.visible ? (
                            <Eye className="w-3.5 h-3.5" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5 opacity-50" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteElement(el.id)}
                          aria-label={`Hapus ${el.label}`}
                          className="p-1 text-[#6E5D63] hover:text-[#8F3A4E] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Element Properties */}
            {selectedElement ? (
              <div className="pt-4 border-t border-[#E6DFDB] space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={selectedElement.label}
                    onChange={(e) =>
                      updateElement(selectedElement.id, { label: e.target.value })
                    }
                    className="flex-1 rounded-lg border border-[#DFD6D1] bg-[#FBF8F6] px-2.5 py-1.5 text-xs font-semibold text-[#3A2D32] focus:border-[#C47D8E] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleDuplicate(selectedElement)}
                    title="Duplikat elemen"
                    className="inline-flex items-center gap-1 rounded-lg border border-[#DFD6D1] px-2.5 py-1.5 text-[11px] font-medium text-[#3A2D32] hover:bg-[#FBF8F6] cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Duplikat</span>
                  </button>
                </div>

                {/* Replace Element Image: direct 1-click upload OR choose from library */}
                <div className="rounded-xl border border-[#E6DFDB] bg-[#FBF8F6] p-3 space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 shrink-0 rounded-lg bg-white border border-[#E6DFDB] overflow-hidden flex items-center justify-center p-1">
                      <img
                        src={selectedElement.url}
                        alt={selectedElement.label}
                        referrerPolicy="no-referrer"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <span className="block text-[11px] font-semibold text-[#3A2D32]">
                        Ganti Gambar Elemen Ini
                      </span>
                      <input
                        ref={replaceFileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={async (e: ChangeEvent<HTMLInputElement>) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (!file || !selectedElement) return;
                          setUploadingReplace(true);
                          setReplaceError(null);
                          try {
                            const lowerLabel = selectedElement.label.toLowerCase();
                            const cat = isBackdropElement(selectedElement)
                              ? 'backdrop'
                              : lowerLabel.includes('pengantin')
                                ? 'couple'
                                : lowerLabel.includes('gazebo') ||
                                    lowerLabel.includes('gerbang') ||
                                    lowerLabel.includes('pavilion')
                                  ? 'venue'
                                  : 'floral';
                            const uploaded = await dataService.uploadAsset(
                              file,
                              `${selectedElement.label} (${file.name.replace(/\.[^.]+$/, '')})`,
                              cat,
                            );
                            if (onAssetsChange) {
                              onAssetsChange([uploaded, ...assets]);
                            }
                            if (onReplaceElementAsset) {
                              await onReplaceElementAsset(
                                'element',
                                selectedElement.id,
                                uploaded,
                              );
                            } else {
                              updateElement(selectedElement.id, {
                                assetId: uploaded.id,
                                url: uploaded.url,
                                removeWhiteBg: uploaded.hasAlpha
                                  ? false
                                  : selectedElement.removeWhiteBg,
                              });
                            }
                          } catch (err) {
                            setReplaceError(
                              err instanceof Error
                                ? err.message
                                : 'Gagal mengunggah gambar pengganti.',
                            );
                          } finally {
                            setUploadingReplace(false);
                          }
                        }}
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={uploadingReplace || saving}
                        onClick={() => replaceFileRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#C47D8E] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[#B46B7D] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <RefreshCw
                          className={`w-3 h-3 ${uploadingReplace ? 'animate-spin' : ''}`}
                        />
                        <span>
                          {uploadingReplace ? 'Mengunggah...' : 'Upload PNG/Foto Baru'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {replaceError && (
                    <p className="text-[11px] text-[#8F3A4E]">{replaceError}</p>
                  )}

                  <div>
                    <label className="block text-[11px] text-[#6E5D63] mb-1">
                      Atau pilih gambar yang sudah ada di Pustaka:
                    </label>
                    <select
                      value={selectedElement.url}
                      onChange={(e) => {
                        const chosen = assets.find((a) => a.url === e.target.value);
                        if (!chosen) return;
                        updateElement(selectedElement.id, {
                          assetId: chosen.id,
                          url: chosen.url,
                          removeWhiteBg: chosen.hasAlpha
                            ? false
                            : selectedElement.removeWhiteBg,
                        });
                      }}
                      className="w-full rounded-lg border border-[#DFD6D1] bg-white px-2.5 py-1.5 text-xs text-[#3A2D32] focus:border-[#C47D8E] focus:outline-none"
                    >
                      {assets.map((a) => (
                        <option key={a.id} value={a.url}>
                          {a.name} ({a.category})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Z Depth — Primary Mental Canvas control */}
                <div className="rounded-xl bg-[#FBF8F6] border border-[#E6DFDB] p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#3A2D32]">
                      Kedalaman Ruang (Z)
                    </span>
                    <span className="font-mono tabular-nums text-[#C47D8E] font-semibold">
                      {selectedElement.z.toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-70}
                    max={10}
                    step={0.1}
                    value={selectedElement.z}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        z: Number(e.target.value),
                      })
                    }
                    className="w-full accent-[#C47D8E] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#6E5D63]">
                    <span>Jauh di Belakang (-70)</span>
                    <span>Dekat Kamera (+10)</span>
                  </div>
                </div>

                {/* X, Y, Scale, Opacity */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="flex justify-between text-[11px] text-[#6E5D63] mb-1">
                      <span>Posisi X</span>
                      <span className="font-mono tabular-nums">
                        {selectedElement.x.toFixed(1)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-10}
                      max={10}
                      step={0.1}
                      value={selectedElement.x}
                      onChange={(e) =>
                        updateElement(selectedElement.id, {
                          x: Number(e.target.value),
                        })
                      }
                      className="w-full accent-[#6B8E78] cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-[#6E5D63] mb-1">
                      <span>Posisi Y</span>
                      <span className="font-mono tabular-nums">
                        {selectedElement.y.toFixed(1)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-6}
                      max={10}
                      step={0.1}
                      value={selectedElement.y}
                      onChange={(e) =>
                        updateElement(selectedElement.id, {
                          y: Number(e.target.value),
                        })
                      }
                      className="w-full accent-[#6B8E78] cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-[#6E5D63] mb-1">
                      <span>Skala</span>
                      <span className="font-mono tabular-nums">
                        {selectedElement.scale.toFixed(2)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.2}
                      max={16}
                      step={0.05}
                      value={selectedElement.scale}
                      onChange={(e) =>
                        updateElement(selectedElement.id, {
                          scale: Number(e.target.value),
                        })
                      }
                      className="w-full accent-[#6B8E78] cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-[#6E5D63] mb-1">
                      <span>Opasitas</span>
                      <span className="font-mono tabular-nums">
                        {Math.round(selectedElement.opacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.02}
                      value={selectedElement.opacity}
                      onChange={(e) =>
                        updateElement(selectedElement.id, {
                          opacity: Number(e.target.value),
                        })
                      }
                      className="w-full accent-[#6B8E78] cursor-pointer"
                    />
                  </div>
                </div>

                {isBackdropElement(selectedElement) ? (
                  <p className="rounded-lg border border-[#E7C6CE] bg-[#FBF1F3] px-2.5 py-1.5 text-[11px] text-[#8F3A4E] leading-relaxed">
                    Lapisan latar penuh otomatis menyesuaikan lebar & tinggi layar saat tamu menggulir agar tepi kanvas tidak terpotong.
                  </p>
                ) : (
                  <p className="rounded-lg border border-[#E6DFDB] bg-[#FBF8F6] px-2.5 py-1.5 text-[11px] text-[#6E5D63] leading-relaxed">
                    Skala & posisi tetap identik antara Orbit 3D, Pratinjau Scroll, dan layar tamu berapa pun resolusi/ukuran file gambar yang diunggah. Gunakan tombol <strong className="text-[#3A2D32]">HP (9:16)</strong> di atas untuk mengecek proporsi ponsel.
                  </p>
                )}

                {/* 3D Rotation */}
                <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-[#F2ECE9]">
                  <div>
                    <span className="block text-[11px] text-[#6E5D63] mb-1">
                      Rot X ({Math.round((selectedElement.rotX * 180) / Math.PI)}°)
                    </span>
                    <input
                      type="range"
                      min={-0.8}
                      max={0.8}
                      step={0.02}
                      value={selectedElement.rotX}
                      onChange={(e) =>
                        updateElement(selectedElement.id, {
                          rotX: Number(e.target.value),
                        })
                      }
                      className="w-full accent-[#C47D8E] cursor-pointer"
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] text-[#6E5D63] mb-1">
                      Rot Y ({Math.round((selectedElement.rotY * 180) / Math.PI)}°)
                    </span>
                    <input
                      type="range"
                      min={-1.2}
                      max={1.2}
                      step={0.02}
                      value={selectedElement.rotY}
                      onChange={(e) =>
                        updateElement(selectedElement.id, {
                          rotY: Number(e.target.value),
                        })
                      }
                      className="w-full accent-[#C47D8E] cursor-pointer"
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] text-[#6E5D63] mb-1">
                      Rot Z ({Math.round((selectedElement.rotZ * 180) / Math.PI)}°)
                    </span>
                    <input
                      type="range"
                      min={-1.5}
                      max={1.5}
                      step={0.02}
                      value={selectedElement.rotZ}
                      onChange={(e) =>
                        updateElement(selectedElement.id, {
                          rotZ: Number(e.target.value),
                        })
                      }
                      className="w-full accent-[#C47D8E] cursor-pointer"
                    />
                  </div>
                </div>

                {/* White Paper Cutout Toggle */}
                <label className="flex items-center justify-between gap-3 pt-2 border-t border-[#F2ECE9] cursor-pointer">
                  <div>
                    <span className="block text-xs font-medium text-[#3A2D32]">
                      Potong Latar Putih (Cutout)
                    </span>
                    <span className="block text-[11px] text-[#6E5D63]">
                      Ubah ilustrasi berlatar putih menjadi lapisan 3D transparan
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedElement.removeWhiteBg}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        removeWhiteBg: e.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-[#C47D8E] rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 pt-2 border-t border-[#F2ECE9] cursor-pointer">
                  <div>
                    <span className="block text-xs font-medium text-[#3A2D32]">
                      Jendela Tengah (Untuk Arch/Bingkai)
                    </span>
                    <span className="block text-[11px] text-[#6E5D63]">
                      Buka bagian tengah agar gambar mempelai di belakang terlihat jelas
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(selectedElement.centerWindow)}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        centerWindow: e.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-[#C47D8E] rounded cursor-pointer"
                  />
                </label>

                {/* Living Animation */}
                <div className="pt-2 border-t border-[#F2ECE9] space-y-2.5">
                  <p className="text-xs font-semibold text-[#3A2D32]">
                    Animasi Hidup (Angin & Melayang)
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="block text-[11px] text-[#6E5D63] mb-1">
                        Ayunan
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={0.12}
                        step={0.005}
                        value={selectedElement.swayAmplitude}
                        onChange={(e) =>
                          updateElement(selectedElement.id, {
                            swayAmplitude: Number(e.target.value),
                          })
                        }
                        className="w-full accent-[#6B8E78] cursor-pointer"
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] text-[#6E5D63] mb-1">
                        Kecepatan
                      </span>
                      <input
                        type="range"
                        min={0.2}
                        max={2.5}
                        step={0.05}
                        value={selectedElement.swaySpeed}
                        onChange={(e) =>
                          updateElement(selectedElement.id, {
                            swaySpeed: Number(e.target.value),
                          })
                        }
                        className="w-full accent-[#6B8E78] cursor-pointer"
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] text-[#6E5D63] mb-1">
                        Melayang
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={0.18}
                        step={0.005}
                        value={selectedElement.floatAmplitude}
                        onChange={(e) =>
                          updateElement(selectedElement.id, {
                            floatAmplitude: Number(e.target.value),
                          })
                        }
                        className="w-full accent-[#6B8E78] cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="pt-4 border-t border-[#E6DFDB] text-center py-6">
                <p className="text-xs text-[#6E5D63]">
                  Klik elemen di daftar lapisan atau langsung di kanvas 3D untuk mengatur kedalaman dan animasinya.
                </p>
              </div>
            )}
          </>
        ) : (
          /* Camera Path Stops Editor */
          <div className="space-y-4 max-h-[540px] overflow-y-auto pr-1">
            <p className="text-[11px] text-[#6E5D63] leading-relaxed">
              Atur titik perhentian kamera saat tamu menggulir halaman. Aktifkan mode <strong className="text-[#3A2D32]">Orbit 3D</strong> untuk mengarahkan sudut kamera lalu rekam posisinya.
            </p>
            {cameraStops.map((stop) => (
              <div
                key={stop.id}
                className="rounded-xl border border-[#E6DFDB] bg-[#FBF8F6] p-3.5 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#3A2D32]">
                    {stop.title}
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-[#6E5D63]">
                    Scroll {Math.round(stop.scrollAt * 100)}%
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  {(['camX', 'camY', 'camZ'] as const).map((field) => (
                    <label key={field} className="block">
                      <span className="text-[#6E5D63] block mb-0.5">{field}</span>
                      <input
                        type="number"
                        step={0.1}
                        value={stop[field]}
                        onChange={(e) =>
                          updateStop(stop.id, { [field]: Number(e.target.value) })
                        }
                        className="w-full rounded-lg border border-[#DFD6D1] bg-white px-2 py-1 text-xs font-mono tabular-nums"
                      />
                    </label>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOrbitMode(false);
                      setScrubProgress(stop.scrollAt);
                    }}
                    className="flex-1 rounded-lg border border-[#DFD6D1] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#3A2D32] hover:bg-[#F4EEEC] cursor-pointer"
                  >
                    Lihat Titik Ini
                  </button>
                  <button
                    type="button"
                    disabled={!isOrbitMode}
                    onClick={() => handleCaptureCameraToStop(stop.id)}
                    title={
                      isOrbitMode
                        ? 'Simpan posisi orbit kamera saat ini'
                        : 'Aktifkan Orbit 3D terlebih dahulu'
                    }
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-[#6B8E78] px-2.5 py-1.5 text-[11px] font-medium text-white disabled:opacity-45 cursor-pointer"
                  >
                    <Camera className="w-3 h-3" />
                    <span>Rekam Orbit</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
