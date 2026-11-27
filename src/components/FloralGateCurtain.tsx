import { DEFAULT_TYPOGRAPHY, getSlotTextStyle } from '../lib/typography.ts';
import type { TypographySettings } from '../types/wedding.ts';

interface FloralGateCurtainProps {
  gateImageUrl: string;
  isOpen: boolean;
  mode: 'opening' | 'closing';
  guestName?: string;
  brideFullName: string;
  groomFullName: string;
  typography?: TypographySettings;
  onAction: () => void;
}

export function FloralGateCurtain({
  gateImageUrl,
  isOpen,
  mode,
  guestName,
  brideFullName,
  groomFullName,
  typography,
  onAction,
}: FloralGateCurtainProps) {
  const interactive = !isOpen;
  const typo = typography || DEFAULT_TYPOGRAPHY;

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
        className={`relative z-10 h-full flex flex-col items-center justify-end pb-12 sm:pb-14 px-5 transition-opacity duration-500 ${
          isOpen ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <button
          type="button"
          onClick={onAction}
          className="w-auto max-w-[92vw] sm:max-w-lg md:max-w-2xl rounded-3xl bg-[#FBF8F6]/94 border border-[#DFD6D1] px-7 py-4 md:px-10 md:py-6 text-[#3A2D32] shadow-[0_12px_30px_-10px_rgba(58,45,50,0.28)] hover:bg-white transition-transform active:scale-[0.98] cursor-pointer text-center"
        >
          {mode === 'opening' ? (
            <div className="flex flex-col items-center gap-1.5">
              {guestName && (
                <span
                  style={getSlotTextStyle(typo.gateSubtitle, DEFAULT_TYPOGRAPHY.gateSubtitle, 1.08)}
                  className="italic font-medium text-[#6E5D63]"
                >
                  Kepada Yth. {guestName}
                </span>
              )}
              <span
                style={getSlotTextStyle(typo.gateCouple, DEFAULT_TYPOGRAPHY.gateCouple)}
                className="font-bold tracking-tight text-[#3A2D32] leading-snug text-balance"
              >
                {groomFullName} &amp; {brideFullName}
              </span>
              <span className="w-12 h-px bg-[#DFD6D1] my-0.5" aria-hidden="true" />
              <span
                style={getSlotTextStyle(typo.gateSubtitle, DEFAULT_TYPOGRAPHY.gateSubtitle, 0.9)}
                className="font-semibold uppercase tracking-[0.18em] text-[#8F4A5B]"
              >
                Ketuk untuk Membuka Undangan
              </span>
            </div>
          ) : (
            <span
              style={getSlotTextStyle(typo.gateSubtitle, DEFAULT_TYPOGRAPHY.gateSubtitle, 0.95)}
              className="font-semibold uppercase tracking-[0.18em] text-[#8F4A5B]"
            >
              Kembali ke Atas
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
