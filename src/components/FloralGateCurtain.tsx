interface FloralGateCurtainProps {
  gateImageUrl: string;
  isOpen: boolean;
  mode: 'opening' | 'closing';
  guestName?: string;
  brideFullName: string;
  groomFullName: string;
  onAction: () => void;
}

export function FloralGateCurtain({
  gateImageUrl,
  isOpen,
  mode,
  guestName,
  brideFullName,
  groomFullName,
  onAction,
}: FloralGateCurtainProps) {
  const interactive = !isOpen;

  return (
    <div
      className={`fixed inset-0 z-40 overflow-hidden transition-opacity duration-700 ${
        interactive ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
      style={{ perspective: '1600px' }}
      aria-hidden={!interactive}
    >
      {/* Left Gate Leaf */}
      <div
        className="absolute inset-y-0 left-0 w-1/2 overflow-hidden origin-left transition-transform duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          transform: isOpen ? 'rotateY(-86deg) translateX(-12%)' : 'rotateY(0deg)',
          opacity: isOpen ? 0 : 1,
          transitionProperty: 'transform, opacity',
        }}
      >
        <div
          className="w-[200%] h-full bg-cover bg-center scale-[1.09]"
          style={{ backgroundImage: `url("${gateImageUrl}")` }}
        />
      </div>

      {/* Right Gate Leaf */}
      <div
        className="absolute inset-y-0 right-0 w-1/2 overflow-hidden origin-right transition-transform duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          transform: isOpen ? 'rotateY(86deg) translateX(12%)' : 'rotateY(0deg)',
          opacity: isOpen ? 0 : 1,
          transitionProperty: 'transform, opacity',
        }}
      >
        <div
          className="w-[200%] h-full -translate-x-1/2 bg-cover bg-center scale-[1.09]"
          style={{ backgroundImage: `url("${gateImageUrl}")` }}
        />
      </div>

      {/* Minimal Center Tap Prompt on Closed Gate */}
      <div
        className={`relative z-10 h-full flex flex-col items-center justify-end pb-14 px-6 transition-opacity duration-500 ${
          isOpen ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {guestName && mode === 'opening' && (
          <p className="mb-3 rounded-full bg-[#FBF8F6]/90 px-4 py-1 text-xs font-medium text-[#3A2D32]">
            Kepada Yth. {guestName}
          </p>
        )}

        <button
          type="button"
          onClick={onAction}
          className="rounded-full bg-[#FBF8F6]/94 border border-[#DFD6D1] px-7 py-3 text-xs sm:text-sm font-semibold text-[#3A2D32] shadow-[0_12px_30px_-10px_rgba(58,45,50,0.28)] hover:bg-white transition-transform active:scale-[0.98] cursor-pointer text-center"
        >
          {mode === 'opening' ? (
            <span>
              Ketuk untuk Membuka Undangan
              <span className="mx-1.5 text-[#C47D8E]" aria-hidden="true">
                ·
              </span>
              <span className="font-script font-bold text-lg sm:text-xl text-[#3A2D32] align-middle">
                {brideFullName} &amp; {groomFullName}
              </span>
            </span>
          ) : (
            'Kembali ke Atas'
          )}
        </button>
      </div>
    </div>
  );
}
