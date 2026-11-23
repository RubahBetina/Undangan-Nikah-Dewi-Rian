import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  CalendarPlus,
  Check,
  ChevronDown,
  Copy,
  MapPin,
  MessageSquareHeart,
  Send,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { FloralGateCurtain } from './FloralGateCurtain.tsx';
import { MentalCanvas3D } from './MentalCanvas3D.tsx';
import { SmokeBackdrop } from './SmokeBackdrop.tsx';
import { WeddingVenueMapModal } from './WeddingVenueMap.tsx';
import { buildGoogleMapsDirectionsUrl } from '../lib/googleMaps.ts';
import {
  DEFAULT_TYPOGRAPHY,
  getFontCssFamily,
  getSlotTextStyle,
  mergeTypography,
} from '../lib/typography.ts';
import type { InvitationBundle, RsvpEntry, WishEntry } from '../types/wedding.ts';
import { dataService } from '../services/dataService.ts';
import { ambientMusic } from '../utils/ambientChime.ts';
import { downloadWeddingIcs } from '../utils/calendar.ts';

interface GuestInvitationProps {
  bundle: InvitationBundle;
  onWishAdded: (wish: WishEntry) => void;
  onSecretAdminTrigger?: () => void;
}

function formatCountdown(targetIso: string) {
  const target = new Date(targetIso).getTime();
  const diff = Math.max(0, target - Date.now());
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds };
}

function stageOpacity(
  progress: number,
  fadeInStart: number,
  fullStart: number,
  fullEnd: number,
  fadeOutEnd: number,
): number {
  if (progress <= fadeInStart || progress >= fadeOutEnd) return 0;
  if (progress < fullStart) {
    return (progress - fadeInStart) / Math.max(0.001, fullStart - fadeInStart);
  }
  if (progress > fullEnd) {
    return 1 - (progress - fullEnd) / Math.max(0.001, fadeOutEnd - fullEnd);
  }
  return 1;
}

export function GuestInvitation({
  bundle,
  onWishAdded,
  onSecretAdminTrigger,
}: GuestInvitationProps) {
  const { settings, elements, cameraStops, wishes } = bundle;

  const [hasOpened, setHasOpened] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [rsvpModalOpen, setRsvpModalOpen] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [copiedAccountId, setCopiedAccountId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(() =>
    formatCountdown(settings.weddingDateIso),
  );

  const invitedGuestName = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('to')?.trim() || '';
  }, []);

  // Secret 5-tap gesture on closing couple headline (zero visible admin UI for guests)
  const tapCountRef = useRef(0);
  const tapResetTimerRef = useRef<number | null>(null);
  const handleSecretTap = () => {
    if (!onSecretAdminTrigger) return;
    tapCountRef.current += 1;
    if (tapResetTimerRef.current !== null) {
      window.clearTimeout(tapResetTimerRef.current);
    }
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      onSecretAdminTrigger();
      return;
    }
    tapResetTimerRef.current = window.setTimeout(() => {
      tapCountRef.current = 0;
    }, 1800);
  };

  // RSVP form state
  const [guestName, setGuestName] = useState(invitedGuestName);
  const [attendance, setAttendance] = useState<RsvpEntry['attendance']>('hadir');
  const [guestCount, setGuestCount] = useState(1);
  const [sessionChoice, setSessionChoice] =
    useState<RsvpEntry['sessionChoice']>('akad_resepsi');
  const [message, setMessage] = useState('');
  const [submittingRsvp, setSubmittingRsvp] = useState(false);
  const [rsvpStatus, setRsvpStatus] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown(formatCountdown(settings.weddingDateIso));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [settings.weddingDateIso]);

  useEffect(() => {
    const onScroll = () => {
      const maxScroll = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
      setScrollProgress(progress);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    ambientMusic.setTrack(settings.musicUrl || '');
  }, [settings.musicUrl]);

  useEffect(() => {
    return () => {
      ambientMusic.stop();
      if (tapResetTimerRef.current !== null) {
        window.clearTimeout(tapResetTimerRef.current);
      }
    };
  }, []);

  const handleOpenGate = () => {
    setHasOpened(true);
    if (settings.musicEnabled !== false) {
      ambientMusic.start(settings.musicUrl);
      setMusicOn(true);
    } else {
      setMusicOn(false);
    }
  };

  const handleCloseToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleMusic = () => {
    const next = ambientMusic.toggle(settings.musicUrl);
    setMusicOn(next);
  };

  const giftList = useMemo(() => {
    if (Array.isArray(settings.giftAccounts) && settings.giftAccounts.length > 0) {
      return settings.giftAccounts;
    }
    if (settings.giftBankName || settings.giftAccountNumber) {
      return [
        {
          id: 'gift-primary',
          label: 'Rekening Tanda Kasih',
          bankName: settings.giftBankName,
          accountNumber: settings.giftAccountNumber,
          accountHolder: settings.giftAccountHolder,
        },
      ];
    }
    return [];
  }, [
    settings.giftAccounts,
    settings.giftBankName,
    settings.giftAccountNumber,
    settings.giftAccountHolder,
  ]);

  const handleCopyBank = (accountId: string, accountNumber: string) => {
    if (!accountNumber) return;
    void navigator.clipboard?.writeText(accountNumber);
    setCopiedAccountId(accountId);
    window.setTimeout(() => {
      setCopiedAccountId((prev) => (prev === accountId ? null : prev));
    }, 2200);
  };

  const scrollToFraction = (fraction: number) => {
    const maxScroll = Math.max(
      1,
      document.documentElement.scrollHeight - window.innerHeight,
    );
    window.scrollTo({ top: maxScroll * fraction, behavior: 'smooth' });
  };

  const handleRsvpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      setRsvpStatus({ type: 'error', text: 'Mohon tuliskan nama lengkap Anda.' });
      return;
    }

    setSubmittingRsvp(true);
    setRsvpStatus(null);
    try {
      const res = await dataService.submitRsvp({
        guestName: guestName.trim(),
        attendance,
        guestCount,
        sessionChoice,
        message: message.trim(),
      });
      if (res.wish) {
        onWishAdded(res.wish);
      }
      setMessage('');
      setRsvpStatus({
        type: 'success',
        text: 'Terima kasih, konfirmasi kehadiran & doa Anda telah tercatat.',
      });
    } catch (err) {
      setRsvpStatus({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal mengirim konfirmasi.',
      });
    } finally {
      setSubmittingRsvp(false);
    }
  };

  // Scroll-synchronized opacities for the 6 illustrated scenes
  const s1CoupleOpacity =
    scrollProgress < 0.11 ? 1 : Math.max(0, 1 - (scrollProgress - 0.11) / 0.05);
  const s2VerseOpacity = stageOpacity(scrollProgress, 0.14, 0.18, 0.28, 0.33);
  const s3GazeboOpacity = stageOpacity(scrollProgress, 0.33, 0.37, 0.47, 0.52);
  const s4VenueOpacity = stageOpacity(scrollProgress, 0.52, 0.56, 0.66, 0.71);
  const s5GiftOpacity = stageOpacity(scrollProgress, 0.71, 0.75, 0.84, 0.88);
  const s6SkyOpacity = stageOpacity(scrollProgress, 0.88, 0.91, 0.955, 0.975);

  const isClosingGateClosed = hasOpened && scrollProgress >= 0.975;
  const gateOpenState = hasOpened && !isClosingGateClosed;
  const typo = useMemo(
    () => mergeTypography(settings.typography),
    [settings.typography],
  );

  return (
    <div className="relative bg-[#FBF8F6] text-[#3A2D32]">
      {/* Illustrated Floral Gate (Swings open at start, swings shut at end of scroll) */}
      <FloralGateCurtain
        gateImageUrl={settings.gateImageUrl}
        isOpen={gateOpenState}
        mode={isClosingGateClosed ? 'closing' : 'opening'}
        guestName={invitedGuestName}
        brideFullName={settings.brideFullName}
        groomFullName={settings.groomFullName}
        typography={typo}
        onAction={isClosingGateClosed ? handleCloseToTop : handleOpenGate}
      />

      {/* Full-Viewport 3D Mental Canvas Stage */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <MentalCanvas3D
          elements={elements}
          cameraStops={cameraStops}
          scrollProgress={scrollProgress}
          skyColorHex={settings.skyColorHex}
          mode="guest"
        />
      </div>

      {/* Discreet Corner Music Control */}
      {hasOpened && !isClosingGateClosed && (
        <div className="fixed bottom-4 right-4 z-30 flex items-center">
          <button
            type="button"
            onClick={handleToggleMusic}
            aria-label={musicOn ? 'Bisukan musik' : 'Putar musik'}
            title={musicOn ? 'Musik Aktif' : 'Putar Musik'}
            className={`inline-flex items-center justify-center w-9 h-9 rounded-full border transition-colors cursor-pointer ${
              musicOn
                ? 'bg-[#C47D8E] border-[#C47D8E] text-white'
                : 'bg-[#FBF8F6] border-[#DFD6D1] text-[#3A2D32] hover:bg-white'
            }`}
          >
            {musicOn ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>
        </div>
      )}

      {/* PURE ILLUSTRATED SMOKE-CLOUD TYPOGRAPHY LAYER (ZERO rectangular boxes!) */}
      {hasOpened && (
        <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between">
          {/* SCENE 1: Calon Pengantin PNG + Gelembung Asap Nama Pengantin Kiri-Kanan di Atasnya */}
          {s1CoupleOpacity > 0.01 && (
            <div
              style={{
                opacity: s1CoupleOpacity,
                transform: `translateY(${(1 - s1CoupleOpacity) * -12}px)`,
              }}
              className="pt-2 sm:pt-4 px-1.5 sm:px-4 flex flex-col items-center justify-between h-full pb-6"
            >
              <SmokeBackdrop
                imageUrl={settings.smokeImageUrl}
                compact
                className="w-full max-w-2xl"
              >
                <p
                  style={getSlotTextStyle(typo.weddingOf, DEFAULT_TYPOGRAPHY.weddingOf)}
                  className="font-bold text-[#5E826B] leading-none mb-1"
                >
                  The Wedding of
                </p>

                <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-1 sm:gap-5 w-full">
                  <div className="text-center min-w-0">
                    <h1
                      style={getSlotTextStyle(typo.coupleNames, DEFAULT_TYPOGRAPHY.coupleNames)}
                      className="font-bold text-[#3A2D32] leading-[1.1] break-words"
                    >
                      {settings.groomFullName}
                    </h1>
                    <p
                      style={getSlotTextStyle(typo.coupleParents, DEFAULT_TYPOGRAPHY.coupleParents)}
                      className="font-medium text-[#5C4B51] leading-tight mt-1"
                    >
                      {settings.groomParents}
                    </p>
                  </div>

                  <div
                    style={getSlotTextStyle(typo.coupleNames, DEFAULT_TYPOGRAPHY.coupleNames, 0.82)}
                    className="font-bold text-[#C47D8E] leading-none pt-1 px-0.5"
                    aria-hidden="true"
                  >
                    &amp;
                  </div>

                  <div className="text-center min-w-0">
                    <h2
                      style={getSlotTextStyle(typo.coupleNames, DEFAULT_TYPOGRAPHY.coupleNames)}
                      className="font-bold text-[#3A2D32] leading-[1.1] break-words"
                    >
                      {settings.brideFullName}
                    </h2>
                    <p
                      style={getSlotTextStyle(typo.coupleParents, DEFAULT_TYPOGRAPHY.coupleParents)}
                      className="font-medium text-[#5C4B51] leading-tight mt-1"
                    >
                      {settings.brideParents}
                    </p>
                  </div>
                </div>
              </SmokeBackdrop>

              <button
                type="button"
                onClick={() => scrollToFraction(0.2)}
                className="pointer-events-auto inline-flex flex-col items-center gap-1 text-[11px] font-medium text-[#3A2D32]/85 cursor-pointer"
              >
                <span>Gulir ke bawah</span>
                <ChevronDown className="w-4 h-4 text-[#C47D8E]" />
              </button>
            </div>
          )}

          {/* SCENE 2: Jalanan Taman + Alas Asap Ayat Al-Qur'an Berpasang-pasangan */}
          {s2VerseOpacity > 0.01 && (
            <div
              style={{
                opacity: s2VerseOpacity,
                transform: `translateY(${(1 - s2VerseOpacity) * 12}px)`,
              }}
              className="pt-8 sm:pt-12 px-4"
            >
              <SmokeBackdrop
                imageUrl={settings.smokeImageUrl}
                className="w-full max-w-lg"
              >
                <h2
                  style={getSlotTextStyle(typo.sectionTitles, DEFAULT_TYPOGRAPHY.sectionTitles, 0.9)}
                  className="font-bold tracking-wide text-[#6B8E78] mb-1.5"
                >
                  {settings.verseTitle}
                </h2>
                <p
                  style={getSlotTextStyle(typo.verseQuote, DEFAULT_TYPOGRAPHY.verseQuote)}
                  className="italic font-medium text-[#3A2D32] leading-snug text-balance"
                >
                  “{settings.verseQuote}”
                </p>
              </SmokeBackdrop>
            </div>
          )}

          {/* SCENE 3: Gazebo Floral + Alas Asap Akad & Resepsi (Tgl, Jam, Hitung Mundur) */}
          {s3GazeboOpacity > 0.01 && (
            <div
              style={{
                opacity: s3GazeboOpacity,
                transform: `translateY(${(1 - s3GazeboOpacity) * 12}px)`,
              }}
              className="pt-6 sm:pt-10 px-4"
            >
              <SmokeBackdrop
                imageUrl={settings.smokeImageUrl}
                className="w-full max-w-lg"
              >
                <h2
                  style={getSlotTextStyle(typo.sectionTitles, DEFAULT_TYPOGRAPHY.sectionTitles)}
                  className="font-bold text-[#3A2D32] tracking-tight mb-0.5 leading-tight"
                >
                  {settings.akadTitle} &amp; {settings.resepsiTitle}
                </h2>
                <p
                  style={getSlotTextStyle(typo.sectionTitles, DEFAULT_TYPOGRAPHY.sectionTitles, 0.8)}
                  className="font-bold text-[#6B8E78] leading-tight"
                >
                  {settings.displayDateText}
                </p>
                <p
                  style={getSlotTextStyle(typo.bodyText, DEFAULT_TYPOGRAPHY.bodyText)}
                  className="font-medium text-[#3A2D32] mt-1.5 tabular-nums"
                >
                  Akad {settings.akadTime}
                  <span className="mx-1.5 text-[#C47D8E]" aria-hidden="true">
                    ·
                  </span>
                  Resepsi {settings.resepsiTime}
                </p>
                <div className="grid grid-cols-4 gap-3 max-w-xs mx-auto mt-3 pt-2.5 border-t border-[#E6DFDB]/80">
                  {[
                    { label: 'Hari', value: countdown.days },
                    { label: 'Jam', value: countdown.hours },
                    { label: 'Menit', value: countdown.minutes },
                    { label: 'Detik', value: countdown.seconds },
                  ].map((item) => (
                    <div key={item.label}>
                      <div
                        style={{ fontFamily: getFontCssFamily(typo.sectionTitles.font) }}
                        className="text-2xl font-bold text-[#3A2D32] tabular-nums leading-none"
                      >
                        {String(item.value).padStart(2, '0')}
                      </div>
                      <div
                        style={{ fontFamily: getFontCssFamily(typo.bodyText.font) }}
                        className="text-[10px] font-medium text-[#6E5D63] mt-0.5"
                      >
                        {item.label}
                      </div>
                    </div>
                  ))}
                </div>
              </SmokeBackdrop>
            </div>
          )}

          {/* SCENE 4: Pelataran Rumah Kaca + Alas Asap Alamat & Integrasi Google Maps */}
          {s4VenueOpacity > 0.01 && (
            <div
              style={{
                opacity: s4VenueOpacity,
                transform: `translateY(${(1 - s4VenueOpacity) * 12}px)`,
              }}
              className="pt-6 sm:pt-10 px-4"
            >
              <SmokeBackdrop
                imageUrl={settings.smokeImageUrl}
                className="w-full max-w-lg"
              >
                <h2
                  style={getSlotTextStyle(typo.sectionTitles, DEFAULT_TYPOGRAPHY.sectionTitles)}
                  className="font-bold text-[#3A2D32] tracking-tight mb-1 leading-tight"
                >
                  Lokasi Acara
                </h2>
                <p
                  style={getSlotTextStyle(typo.sectionTitles, DEFAULT_TYPOGRAPHY.sectionTitles, 0.85)}
                  className="font-bold text-[#6B8E78] leading-tight text-balance"
                >
                  {settings.akadVenue}
                </p>
                <p
                  style={getSlotTextStyle(typo.bodyText, DEFAULT_TYPOGRAPHY.bodyText)}
                  className="font-medium text-[#6E5D63] mt-1.5 leading-relaxed max-w-sm mx-auto"
                >
                  {settings.akadAddress}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 pointer-events-auto">
                  <button
                    type="button"
                    onClick={() => setMapModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#C47D8E] px-3.5 py-1.5 text-[11px] font-medium text-white hover:bg-[#B46B7D] cursor-pointer whitespace-nowrap"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Peta Interaktif</span>
                  </button>
                  <a
                    href={buildGoogleMapsDirectionsUrl({
                      venueName: settings.akadVenue,
                      address: settings.akadAddress,
                      lat: settings.venueLat,
                      lng: settings.venueLng,
                      placeId: settings.venuePlaceId,
                      fallbackUrl: settings.mapsUrl,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#C47D8E] hover:underline whitespace-nowrap"
                  >
                    <span>Buka Google Maps</span>
                  </a>
                  <span className="text-[#D6CBC6]" aria-hidden="true">
                    |
                  </span>
                  <button
                    type="button"
                    onClick={() => downloadWeddingIcs(settings)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B8E78] hover:underline cursor-pointer whitespace-nowrap"
                  >
                    <CalendarPlus className="w-3.5 h-3.5" />
                    <span>Simpan Kalender</span>
                  </button>
                </div>
              </SmokeBackdrop>
            </div>
          )}

          {/* SCENE 5: Area Taman Tumpukan Kado + Alas Asap Wedding Gift & Tombol RSVP */}
          {s5GiftOpacity > 0.01 && (
            <div
              style={{
                opacity: s5GiftOpacity,
                transform: `translateY(${(1 - s5GiftOpacity) * 12}px)`,
              }}
              className="pt-4 sm:pt-8 px-3 sm:px-4"
            >
              <SmokeBackdrop
                imageUrl={settings.smokeImageUrl}
                compact={giftList.length > 1}
                className={giftList.length > 1 ? 'w-full max-w-xl' : 'w-full max-w-lg'}
              >
                <h2
                  style={getSlotTextStyle(typo.sectionTitles, DEFAULT_TYPOGRAPHY.sectionTitles)}
                  className="font-bold text-[#3A2D32] tracking-tight mb-1 leading-tight"
                >
                  {settings.giftTitle}
                </h2>
                <p
                  style={getSlotTextStyle(typo.bodyText, DEFAULT_TYPOGRAPHY.bodyText)}
                  className="text-[#6E5D63] leading-relaxed max-w-md mx-auto"
                >
                  {settings.giftMessage}
                </p>

                {giftList.length > 0 && (
                  <div
                    style={{ fontFamily: getFontCssFamily(typo.bodyText.font) }}
                    className={`mt-2.5 grid gap-2.5 pointer-events-auto ${
                      giftList.length > 1
                        ? 'grid-cols-2 max-w-lg mx-auto'
                        : 'grid-cols-1 max-w-xs mx-auto'
                    }`}
                  >
                    {giftList.map((acc) => {
                      const isCopied = copiedAccountId === acc.id;
                      return (
                        <div key={acc.id} className="text-center px-1.5 py-1">
                          {acc.label && (
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#5E826B]">
                              {acc.label}
                            </p>
                          )}
                          <div className="text-xs font-bold text-[#3A2D32] tabular-nums mt-0.5">
                            {acc.bankName} · {acc.accountNumber}
                          </div>
                          <p className="text-[10px] sm:text-[11px] text-[#6E5D63] truncate">
                            {acc.accountHolder}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleCopyBank(acc.id, acc.accountNumber)}
                            className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#C47D8E] px-3 py-1 text-[10px] sm:text-[11px] font-medium text-white hover:bg-[#B46B7D] cursor-pointer whitespace-nowrap"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Tersalin</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Salin Rekening</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-center pointer-events-auto">
                  <button
                    type="button"
                    onClick={() => setRsvpModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#6B8E78] bg-[#FBF8F6] px-4 py-1.5 text-[11px] font-medium text-[#3A2D32] hover:bg-white cursor-pointer whitespace-nowrap"
                  >
                    <MessageSquareHeart className="w-3 h-3 text-[#6B8E78]" />
                    <span>RSVP &amp; Ucapan ({wishes.length})</span>
                  </button>
                </div>
              </SmokeBackdrop>
            </div>
          )}

          {/* SCENE 6: Langit Pastel + Alas Asap Ucapan Terima Kasih */}
          {s6SkyOpacity > 0.01 && (
            <div
              style={{
                opacity: s6SkyOpacity,
                transform: `translateY(${(1 - s6SkyOpacity) * 12}px)`,
              }}
              className="my-auto px-4"
            >
              <SmokeBackdrop
                imageUrl={settings.smokeImageUrl}
                className="w-full max-w-lg"
              >
                <p
                  style={{ fontFamily: getFontCssFamily(typo.bodyText.font) }}
                  className="text-[10px] tracking-[0.22em] uppercase text-[#6B8E78] font-bold mb-1"
                >
                  Sampai Jumpa di Hari Bahagia
                </p>
                <h2
                  style={getSlotTextStyle(typo.closingTitle, DEFAULT_TYPOGRAPHY.closingTitle)}
                  className="font-bold text-[#3A2D32] leading-tight"
                >
                  {settings.closingThanksTitle}
                </h2>
                <p
                  style={getSlotTextStyle(typo.bodyText, DEFAULT_TYPOGRAPHY.bodyText, 1.05)}
                  className="text-[#6E5D63] mt-2 leading-relaxed max-w-sm mx-auto"
                >
                  {settings.closingThanksMessage}
                </p>
                <p
                  onClick={handleSecretTap}
                  style={getSlotTextStyle(typo.coupleNames, DEFAULT_TYPOGRAPHY.coupleNames, 1.05)}
                  className="pointer-events-auto font-bold text-[#C47D8E] mt-2.5 select-none leading-tight"
                >
                  {settings.groomFullName} &amp; {settings.brideFullName}
                </p>
              </SmokeBackdrop>
            </div>
          )}
        </div>
      )}

      {/* Clean Interactive RSVP & Wishes Modal (only opens when guest taps RSVP button) */}
      {rsvpModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-[#3A2D32]/45"
          role="dialog"
          aria-modal="true"
          aria-label="RSVP dan Buku Ucapan"
        >
          <div className="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-2xl border border-[#E6DFDB] bg-[#FBF8F6] p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl font-semibold text-[#3A2D32]">
                RSVP &amp; Doa Restu
              </h3>
              <button
                type="button"
                onClick={() => setRsvpModalOpen(false)}
                aria-label="Tutup jendela RSVP"
                className="p-1.5 rounded-lg text-[#6E5D63] hover:text-[#3A2D32] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRsvpSubmit} className="space-y-3">
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Nama lengkap Anda"
                className="w-full rounded-xl border border-[#DFD6D1] bg-white px-3.5 py-2.5 text-sm text-[#3A2D32] focus:border-[#C47D8E] focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={attendance}
                  onChange={(e) =>
                    setAttendance(e.target.value as RsvpEntry['attendance'])
                  }
                  className="rounded-xl border border-[#DFD6D1] bg-white px-3 py-2 text-xs text-[#3A2D32]"
                >
                  <option value="hadir">Hadir</option>
                  <option value="ragu">Menyesuaikan</option>
                  <option value="tidak_hadir">Berhalangan</option>
                </select>
                <select
                  value={guestCount}
                  onChange={(e) => setGuestCount(Number(e.target.value))}
                  className="rounded-xl border border-[#DFD6D1] bg-white px-3 py-2 text-xs text-[#3A2D32] tabular-nums"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} Tamu
                    </option>
                  ))}
                </select>
              </div>
              <select
                value={sessionChoice}
                onChange={(e) =>
                  setSessionChoice(e.target.value as RsvpEntry['sessionChoice'])
                }
                className="w-full rounded-xl border border-[#DFD6D1] bg-white px-3 py-2 text-xs text-[#3A2D32]"
              >
                <option value="akad_resepsi">Akad Nikah &amp; Resepsi</option>
                <option value="akad_only">Akad Nikah Saja</option>
                <option value="resepsi_only">Resepsi Saja</option>
              </select>
              <textarea
                rows={2}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tuliskan doa & ucapan hangat..."
                className="w-full rounded-xl border border-[#DFD6D1] bg-white px-3.5 py-2 text-sm text-[#3A2D32] resize-none"
              />

              {rsvpStatus && (
                <p
                  className={`text-xs ${
                    rsvpStatus.type === 'success'
                      ? 'text-[#3B5B47]'
                      : 'text-[#8F3A4E]'
                  }`}
                >
                  {rsvpStatus.text}
                </p>
              )}

              <button
                type="submit"
                disabled={submittingRsvp}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#C47D8E] px-5 py-2.5 text-xs font-medium text-white hover:bg-[#B46B7D] disabled:opacity-60 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {submittingRsvp ? 'Mengirim...' : 'Kirim Konfirmasi & Doa'}
                </span>
              </button>
            </form>

            <div className="pt-4 border-t border-[#E6DFDB] space-y-2.5 max-h-48 overflow-y-auto">
              <p className="text-xs font-semibold text-[#3A2D32]">
                Ucapan Tamu ({wishes.length})
              </p>
              {wishes.map((w) => (
                <div
                  key={w.id}
                  className="pb-2 border-b border-[#EFE8E4] last:border-b-0"
                >
                  <p className="text-xs font-semibold text-[#3A2D32]">
                    {w.guestName}
                  </p>
                  <p className="text-xs text-[#6E5D63] mt-0.5 leading-relaxed">
                    {w.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Interactive Google Maps Venue Modal */}
      <WeddingVenueMapModal
        open={mapModalOpen}
        onClose={() => setMapModalOpen(false)}
        settings={settings}
      />

      {/* Full Mental Canvas Scroll Runway (680vh — zero solid webpage block at bottom!) */}
      <div className="h-[680vh] pointer-events-none" aria-hidden="true" />
    </div>
  );
}
