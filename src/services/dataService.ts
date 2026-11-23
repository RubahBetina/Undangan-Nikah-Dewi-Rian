import {
  DEFAULT_ASSETS,
  DEFAULT_CAMERA_STOPS,
  DEFAULT_ELEMENTS,
  DEFAULT_RSVPS,
  DEFAULT_SETTINGS,
  DEFAULT_WISHES,
} from '../data/defaultSeed.ts';
import { isSupabaseConfigured, supabase } from '../lib/supabase.ts';
import { mergeTypography } from '../lib/typography.ts';
import type {
  AdminUser,
  AssetCategory,
  CameraStop,
  CanvasElement,
  GiftAccount,
  InvitationBundle,
  MediaAsset,
  RsvpEntry,
  WeddingSettings,
  WishEntry,
} from '../types/wedding.ts';

async function apiJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      ...(options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options?.headers || {}),
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if ((res.status === 404 || res.status === 405) && !isSupabaseConfigured) {
      throw new Error(
        'Backend API tidak tersedia di hosting statis. Pastikan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY sudah diisi di Environment Variables Vercel.',
      );
    }
    throw new Error((data as { error?: string }).error || 'Permintaan gagal diproses.');
  }
  return data as T;
}

async function adminApiJson<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }
  return apiJson<T>(url, {
    ...options,
    headers: {
      ...headers,
      ...((options?.headers as Record<string, string> | undefined) || {}),
    },
  });
}

function isMissingTableOrBucketError(err: unknown): boolean {
  if (!err) return false;
  const code =
    typeof (err as { code?: unknown }).code === 'string'
      ? (err as { code: string }).code
      : '';
  const msg =
    err instanceof Error
      ? err.message
      : typeof (err as { message?: unknown }).message === 'string'
        ? (err as { message: string }).message
        : String(err);
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    /PGRST205|could not find the table|does not exist|schema cache|bucket not found/i.test(
      msg,
    )
  );
}

// Map DB snake_case <-> TypeScript camelCase for Supabase
function mapSettingsFromDb(row: Record<string, unknown>): WeddingSettings {
  const extra = (row.scene_config as Record<string, unknown> | null) || {};
  return {
    coupleHeadline: String(row.couple_headline ?? DEFAULT_SETTINGS.coupleHeadline),
    brideFullName: String(row.bride_full_name ?? DEFAULT_SETTINGS.brideFullName),
    brideParents: String(row.bride_parents ?? DEFAULT_SETTINGS.brideParents),
    brideBio: String(row.bride_bio ?? DEFAULT_SETTINGS.brideBio),
    groomFullName: String(row.groom_full_name ?? DEFAULT_SETTINGS.groomFullName),
    groomParents: String(row.groom_parents ?? DEFAULT_SETTINGS.groomParents),
    groomBio: String(row.groom_bio ?? DEFAULT_SETTINGS.groomBio),
    weddingDateIso: String(row.wedding_date_iso ?? DEFAULT_SETTINGS.weddingDateIso),
    displayDateText: String(row.display_date_text ?? DEFAULT_SETTINGS.displayDateText),
    cityLocation: String(row.city_location ?? DEFAULT_SETTINGS.cityLocation),
    openingQuote: String(row.opening_quote ?? DEFAULT_SETTINGS.openingQuote),
    openingVerseSource: String(
      row.opening_verse_source ?? DEFAULT_SETTINGS.openingVerseSource,
    ),
    verseTitle: String(extra.verseTitle ?? DEFAULT_SETTINGS.verseTitle),
    verseQuote: String(extra.verseQuote ?? DEFAULT_SETTINGS.verseQuote),
    akadTitle: String(row.akad_title ?? DEFAULT_SETTINGS.akadTitle),
    akadTime: String(row.akad_time ?? DEFAULT_SETTINGS.akadTime),
    akadVenue: String(row.akad_venue ?? DEFAULT_SETTINGS.akadVenue),
    akadAddress: String(row.akad_address ?? DEFAULT_SETTINGS.akadAddress),
    resepsiTitle: String(row.resepsi_title ?? DEFAULT_SETTINGS.resepsiTitle),
    resepsiTime: String(row.resepsi_time ?? DEFAULT_SETTINGS.resepsiTime),
    resepsiVenue: String(row.resepsi_venue ?? DEFAULT_SETTINGS.resepsiVenue),
    resepsiAddress: String(row.resepsi_address ?? DEFAULT_SETTINGS.resepsiAddress),
    mapsUrl: String(row.maps_url ?? DEFAULT_SETTINGS.mapsUrl),
    venueLat: typeof extra.venueLat === 'number' ? extra.venueLat : undefined,
    venueLng: typeof extra.venueLng === 'number' ? extra.venueLng : undefined,
    venuePlaceId:
      typeof extra.venuePlaceId === 'string' && extra.venuePlaceId.trim()
        ? extra.venuePlaceId
        : undefined,
    dressCode: String(row.dress_code ?? DEFAULT_SETTINGS.dressCode),
    giftTitle: String(extra.giftTitle ?? DEFAULT_SETTINGS.giftTitle),
    giftMessage: String(extra.giftMessage ?? DEFAULT_SETTINGS.giftMessage),
    giftBankName: String(extra.giftBankName ?? DEFAULT_SETTINGS.giftBankName),
    giftAccountNumber: String(
      extra.giftAccountNumber ?? DEFAULT_SETTINGS.giftAccountNumber,
    ),
    giftAccountHolder: String(
      extra.giftAccountHolder ?? DEFAULT_SETTINGS.giftAccountHolder,
    ),
    giftAccounts: Array.isArray(extra.giftAccounts) && extra.giftAccounts.length > 0
      ? (extra.giftAccounts as GiftAccount[])
      : [
          {
            id: 'gift-primary',
            label: 'Rekening Tanda Kasih',
            bankName: String(extra.giftBankName ?? DEFAULT_SETTINGS.giftBankName),
            accountNumber: String(
              extra.giftAccountNumber ?? DEFAULT_SETTINGS.giftAccountNumber,
            ),
            accountHolder: String(
              extra.giftAccountHolder ?? DEFAULT_SETTINGS.giftAccountHolder,
            ),
          },
        ],
    closingThanksTitle: String(
      extra.closingThanksTitle ?? DEFAULT_SETTINGS.closingThanksTitle,
    ),
    closingThanksMessage: String(
      extra.closingThanksMessage ?? DEFAULT_SETTINGS.closingThanksMessage,
    ),
    gateImageUrl: String(extra.gateImageUrl ?? DEFAULT_SETTINGS.gateImageUrl),
    smokeImageUrl: String(extra.smokeImageUrl ?? DEFAULT_SETTINGS.smokeImageUrl),
    couplePhotoUrl: String(row.couple_photo_url ?? DEFAULT_SETTINGS.couplePhotoUrl),
    venuePhotoUrl: String(row.venue_photo_url ?? DEFAULT_SETTINGS.venuePhotoUrl),
    skyColorHex: String(row.sky_color_hex ?? DEFAULT_SETTINGS.skyColorHex),
    musicEnabled:
      typeof extra.musicEnabled === 'boolean'
        ? extra.musicEnabled
        : DEFAULT_SETTINGS.musicEnabled,
    musicUrl: String(extra.musicUrl ?? DEFAULT_SETTINGS.musicUrl),
    musicTitle: String(extra.musicTitle ?? DEFAULT_SETTINGS.musicTitle),
    typography: mergeTypography(extra.typography),
    storyMilestones: Array.isArray(row.story_milestones)
      ? (row.story_milestones as WeddingSettings['storyMilestones'])
      : DEFAULT_SETTINGS.storyMilestones,
  };
}

function mapSettingsToDb(s: WeddingSettings): Record<string, unknown> {
  return {
    id: 1,
    couple_headline: s.coupleHeadline,
    bride_full_name: s.brideFullName,
    bride_parents: s.brideParents,
    bride_bio: s.brideBio,
    groom_full_name: s.groomFullName,
    groom_parents: s.groomParents,
    groom_bio: s.groomBio,
    wedding_date_iso: s.weddingDateIso,
    display_date_text: s.displayDateText,
    city_location: s.cityLocation,
    opening_quote: s.openingQuote,
    opening_verse_source: s.openingVerseSource,
    akad_title: s.akadTitle,
    akad_time: s.akadTime,
    akad_venue: s.akadVenue,
    akad_address: s.akadAddress,
    resepsi_title: s.resepsiTitle,
    resepsi_time: s.resepsiTime,
    resepsi_venue: s.resepsiVenue,
    resepsi_address: s.resepsiAddress,
    maps_url: s.mapsUrl,
    dress_code: s.dressCode,
    couple_photo_url: s.couplePhotoUrl,
    venue_photo_url: s.venuePhotoUrl,
    sky_color_hex: s.skyColorHex,
    story_milestones: s.storyMilestones,
    scene_config: {
      verseTitle: s.verseTitle,
      verseQuote: s.verseQuote,
      giftTitle: s.giftTitle,
      giftMessage: s.giftMessage,
      giftBankName: s.giftAccounts?.[0]?.bankName ?? s.giftBankName,
      giftAccountNumber: s.giftAccounts?.[0]?.accountNumber ?? s.giftAccountNumber,
      giftAccountHolder: s.giftAccounts?.[0]?.accountHolder ?? s.giftAccountHolder,
      giftAccounts: s.giftAccounts || [],
      closingThanksTitle: s.closingThanksTitle,
      closingThanksMessage: s.closingThanksMessage,
      gateImageUrl: s.gateImageUrl,
      smokeImageUrl: s.smokeImageUrl,
      musicEnabled: s.musicEnabled,
      musicUrl: s.musicUrl,
      musicTitle: s.musicTitle,
      typography: s.typography,
      venueLat: typeof s.venueLat === 'number' ? s.venueLat : null,
      venueLng: typeof s.venueLng === 'number' ? s.venueLng : null,
      venuePlaceId: s.venuePlaceId || null,
      wishesSeeded: true,
    },
  };
}

function mapElementFromDb(row: Record<string, unknown>): CanvasElement {
  return {
    id: String(row.id),
    assetId: String(row.asset_id),
    label: String(row.label),
    url: String(row.url),
    x: Number(row.x),
    y: Number(row.y),
    z: Number(row.z),
    scale: Number(row.scale),
    rotX: Number(row.rot_x),
    rotY: Number(row.rot_y),
    rotZ: Number(row.rot_z),
    opacity: Number(row.opacity),
    removeWhiteBg: Boolean(row.remove_white_bg),
    centerWindow: Boolean(row.center_window),
    swayAmplitude: Number(row.sway_amplitude),
    swaySpeed: Number(row.sway_speed),
    floatAmplitude: Number(row.float_amplitude),
    chapterIndex: Number(row.chapter_index),
    sortOrder: Number(row.sort_order),
    visible: Boolean(row.visible),
  };
}

function mapElementToDb(el: CanvasElement): Record<string, unknown> {
  return {
    id: el.id,
    asset_id: el.assetId,
    label: el.label,
    url: el.url,
    x: el.x,
    y: el.y,
    z: el.z,
    scale: el.scale,
    rot_x: el.rotX,
    rot_y: el.rotY,
    rot_z: el.rotZ,
    opacity: el.opacity,
    remove_white_bg: el.removeWhiteBg,
    center_window: Boolean(el.centerWindow),
    sway_amplitude: el.swayAmplitude,
    sway_speed: el.swaySpeed,
    float_amplitude: el.floatAmplitude,
    chapter_index: el.chapterIndex,
    sort_order: el.sortOrder,
    visible: el.visible,
  };
}

function mapCameraStopFromDb(row: Record<string, unknown>): CameraStop {
  return {
    id: String(row.id),
    chapterIndex: Number(row.chapter_index),
    title: String(row.title),
    subtitle: String(row.subtitle ?? ''),
    scrollAt: Number(row.scroll_at),
    camX: Number(row.cam_x),
    camY: Number(row.cam_y),
    camZ: Number(row.cam_z),
    lookX: Number(row.look_x),
    lookY: Number(row.look_y),
    lookZ: Number(row.look_z),
  };
}

function mapCameraStopToDb(s: CameraStop): Record<string, unknown> {
  return {
    id: s.id,
    chapter_index: s.chapterIndex,
    title: s.title,
    subtitle: s.subtitle,
    scroll_at: s.scrollAt,
    cam_x: s.camX,
    cam_y: s.camY,
    cam_z: s.camZ,
    look_x: s.lookX,
    look_y: s.lookY,
    look_z: s.lookZ,
  };
}

export const dataService = {
  getBackendMode(): 'supabase' | 'express' {
    return isSupabaseConfigured ? 'supabase' : 'express';
  },

  // =========================================================================
  // AUTHENTICATION
  // =========================================================================
  async getCurrentUser(): Promise<AdminUser | null> {
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return null;
      return {
        id: data.user.id,
        name:
          (data.user.user_metadata?.name as string | undefined) ||
          data.user.email?.split('@')[0] ||
          'Admin',
        email: data.user.email || '',
        role: 'admin',
      };
    }
    const res = await apiJson<{ user: AdminUser | null }>('/api/auth/me');
    return res.user;
  },

  async login(email: string, password: string): Promise<AdminUser> {
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        const msg = error?.message || '';
        if (/email not confirmed/i.test(msg)) {
          throw new Error(
            'Email Anda belum dikonfirmasi. Buka kotak masuk/spam email untuk klik tautan verifikasi, atau matikan "Confirm email" di Supabase Dashboard > Authentication > Providers > Email.',
          );
        }
        if (/invalid login credentials/i.test(msg)) {
          if (email.toLowerCase() === 'admin@atelierfleur.id') {
            throw new Error(
              'Akun bawaan admin@atelierfleur.id hanya tersedia di mode server lokal. Karena Anda memakai Supabase, silakan buka tab "Daftar Akun Baru" untuk mendaftarkan email Anda sendiri.',
            );
          }
          throw new Error(
            'Email belum terdaftar di proyek Supabase Anda, kata sandi salah, atau email belum dikonfirmasi.',
          );
        }
        throw new Error(msg || 'Gagal login ke Supabase.');
      }
      return {
        id: data.user.id,
        name:
          (data.user.user_metadata?.name as string | undefined) ||
          data.user.email?.split('@')[0] ||
          'Admin',
        email: data.user.email || '',
        role: 'admin',
      };
    }
    const res = await apiJson<{ user: AdminUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return res.user;
  },

  async register(
    name: string,
    email: string,
    password: string,
  ): Promise<{ user: AdminUser; needsEmailConfirmation: boolean }> {
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: `${window.location.origin}/admin`,
        },
      });
      if (error || !data.user) {
        const msg = error?.message || '';
        if (/already registered/i.test(msg)) {
          throw new Error(
            'Email ini sudah terdaftar di Supabase. Silakan pindah ke tab "Masuk Admin".',
          );
        }
        throw new Error(msg || 'Gagal mendaftar di Supabase.');
      }
      return {
        user: {
          id: data.user.id,
          name,
          email: data.user.email || email,
          role: 'admin',
        },
        needsEmailConfirmation: !data.session,
      };
    }
    const res = await apiJson<{ user: AdminUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    return { user: res.user, needsEmailConfirmation: false };
  },

  async checkSchemaReady(): Promise<boolean> {
    if (!supabase) return true;
    try {
      const { error } = await supabase
        .from('wedding_settings')
        .select('id')
        .limit(1);
      if (error && isMissingTableOrBucketError(error)) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  },

  async logout(): Promise<void> {
    if (supabase) {
      await supabase.auth.signOut();
      return;
    }
    await apiJson('/api/auth/logout', { method: 'POST' });
  },

  // =========================================================================
  // PUBLIC INVITATION DATA
  // =========================================================================
  async getInvitationBundle(): Promise<InvitationBundle> {
    if (supabase) {
      const [settingsRes, elementsRes, stopsRes, wishesRes] = await Promise.all([
        supabase.from('wedding_settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('canvas_elements').select('*').order('sort_order', { ascending: true }),
        supabase.from('camera_stops').select('*').order('chapter_index', { ascending: true }),
        supabase.from('wishes').select('*').order('created_at', { ascending: false }),
      ]);

      if (
        isMissingTableOrBucketError(settingsRes.error) ||
        isMissingTableOrBucketError(elementsRes.error) ||
        isMissingTableOrBucketError(stopsRes.error) ||
        isMissingTableOrBucketError(wishesRes.error)
      ) {
        return apiJson<InvitationBundle>('/api/invitation');
      }

      const sceneConfig =
        (settingsRes.data?.scene_config as Record<string, unknown> | null) || null;
      const wishesAlreadySeeded = Boolean(sceneConfig?.wishesSeeded);

      const settings = settingsRes.data
        ? mapSettingsFromDb(settingsRes.data)
        : DEFAULT_SETTINGS;
      const elements =
        elementsRes.data && elementsRes.data.length > 0
          ? elementsRes.data.map(mapElementFromDb)
          : DEFAULT_ELEMENTS;
      const cameraStops =
        stopsRes.data && stopsRes.data.length > 0
          ? stopsRes.data.map(mapCameraStopFromDb)
          : DEFAULT_CAMERA_STOPS;
      const wishes: WishEntry[] =
        wishesRes.data && wishesRes.data.length > 0
          ? wishesRes.data.map((w) => ({
              id: String(w.id),
              guestName: String(w.guest_name),
              message: String(w.message),
              createdAt: String(w.created_at),
            }))
          : wishesAlreadySeeded
            ? []
            : DEFAULT_WISHES;

      return { settings, elements, cameraStops, wishes };
    }
    return apiJson<InvitationBundle>('/api/invitation');
  },

  async submitRsvp(payload: {
    guestName: string;
    attendance: RsvpEntry['attendance'];
    guestCount: number;
    sessionChoice: RsvpEntry['sessionChoice'];
    message: string;
  }): Promise<{ rsvp: RsvpEntry; wish: WishEntry | null }> {
    if (supabase) {
      const createdAt = new Date().toISOString();
      const { error: rsvpErr } = await supabase.from('rsvps').insert({
        guest_name: payload.guestName,
        attendance: payload.attendance,
        guest_count: payload.guestCount,
        session_choice: payload.sessionChoice,
        message: payload.message,
      });

      if (rsvpErr && isMissingTableOrBucketError(rsvpErr)) {
        return apiJson<{ rsvp: RsvpEntry; wish: WishEntry | null }>('/api/rsvp', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      if (rsvpErr) {
        throw new Error(rsvpErr.message || 'Gagal menyimpan RSVP.');
      }

      let wish: WishEntry | null = null;
      const cleanMessage = payload.message.trim();
      if (cleanMessage.length > 0) {
        const { error: wishErr } = await supabase
          .from('wishes')
          .insert({ guest_name: payload.guestName, message: cleanMessage });
        if (!wishErr) {
          wish = {
            id: `wish-local-${Date.now()}`,
            guestName: payload.guestName,
            message: cleanMessage,
            createdAt,
          };
        }
      }

      return {
        rsvp: {
          id: `rsvp-local-${Date.now()}`,
          guestName: payload.guestName,
          attendance: payload.attendance,
          guestCount: payload.guestCount,
          sessionChoice: payload.sessionChoice,
          message: payload.message,
          createdAt,
        },
        wish,
      };
    }

    return apiJson<{ rsvp: RsvpEntry; wish: WishEntry | null }>('/api/rsvp', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async submitWish(guestName: string, message: string): Promise<WishEntry> {
    if (supabase) {
      const createdAt = new Date().toISOString();
      const { error } = await supabase
        .from('wishes')
        .insert({ guest_name: guestName, message });
      if (error && isMissingTableOrBucketError(error)) {
        const res = await apiJson<{ wish: WishEntry }>('/api/wishes', {
          method: 'POST',
          body: JSON.stringify({ guestName, message }),
        });
        return res.wish;
      }
      if (error) {
        throw new Error(error.message || 'Gagal mengirim ucapan.');
      }
      return {
        id: `wish-local-${Date.now()}`,
        guestName,
        message,
        createdAt,
      };
    }
    const res = await apiJson<{ wish: WishEntry }>('/api/wishes', {
      method: 'POST',
      body: JSON.stringify({ guestName, message }),
    });
    return res.wish;
  },

  // =========================================================================
  // ADMIN SETTINGS, ASSETS & 3D CANVAS
  // =========================================================================
  async updateSettings(settings: WeddingSettings): Promise<WeddingSettings> {
    if (supabase) {
      const { data, error } = await supabase
        .from('wedding_settings')
        .upsert(mapSettingsToDb(settings), { onConflict: 'id' })
        .select('*')
        .single();
      if (error && isMissingTableOrBucketError(error)) {
        const res = await adminApiJson<{ settings: WeddingSettings }>(
          '/api/admin/settings',
          {
            method: 'PUT',
            body: JSON.stringify(settings),
          },
        );
        return res.settings;
      }
      if (error || !data) {
        throw new Error(error?.message || 'Gagal menyimpan pengaturan undangan.');
      }
      return mapSettingsFromDb(data);
    }
    const res = await adminApiJson<{ settings: WeddingSettings }>('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
    return res.settings;
  },

  async getAssets(): Promise<MediaAsset[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false });
      if (error && isMissingTableOrBucketError(error)) {
        const res = await adminApiJson<{ assets: MediaAsset[] }>('/api/admin/assets');
        return res.assets;
      }
      if (error) {
        throw new Error(error.message);
      }
      const mapped: MediaAsset[] = (data || []).map((a) => ({
        id: String(a.id),
        name: String(a.name),
        category: a.category as AssetCategory,
        url: String(a.url),
        storagePath: a.storage_path ? String(a.storage_path) : undefined,
        hasAlpha: Boolean(a.has_alpha),
        isSystem: Boolean(a.is_system),
        createdAt: String(a.created_at),
      }));
      return mapped.length > 0 ? [...mapped, ...DEFAULT_ASSETS] : DEFAULT_ASSETS;
    }
    const res = await adminApiJson<{ assets: MediaAsset[] }>('/api/admin/assets');
    return res.assets;
  },

  async uploadAsset(
    file: File,
    name: string,
    category: AssetCategory,
  ): Promise<MediaAsset> {
    if (supabase) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const storagePath = `elements/${safeName}`;

      const { error: uploadErr } = await supabase.storage
        .from('wedding-assets')
        .upload(storagePath, file, { upsert: false });

      if (uploadErr && isMissingTableOrBucketError(uploadErr)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', name);
        formData.append('category', category);
        const res = await adminApiJson<{ asset: MediaAsset }>('/api/admin/assets/upload', {
          method: 'POST',
          body: formData,
        });
        return res.asset;
      }

      if (uploadErr) {
        throw new Error(uploadErr.message);
      }

      const { data: pubUrl } = supabase.storage
        .from('wedding-assets')
        .getPublicUrl(storagePath);

      const hasAlpha = ext === 'png' || ext === 'webp' || ext === 'svg';

      const { data: row, error: dbErr } = await supabase
        .from('assets')
        .insert({
          name: name.trim() || file.name,
          category,
          url: pubUrl.publicUrl,
          storage_path: storagePath,
          has_alpha: hasAlpha,
          is_system: false,
        })
        .select('*')
        .single();

      if (dbErr && isMissingTableOrBucketError(dbErr)) {
        await supabase.storage.from('wedding-assets').remove([storagePath]).catch(() => {});
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', name);
        formData.append('category', category);
        const res = await adminApiJson<{ asset: MediaAsset }>('/api/admin/assets/upload', {
          method: 'POST',
          body: formData,
        });
        return res.asset;
      }

      if (dbErr || !row) {
        throw new Error(dbErr?.message || 'Gagal mencatat metadata aset.');
      }

      return {
        id: String(row.id),
        name: String(row.name),
        category: row.category as AssetCategory,
        url: String(row.url),
        storagePath: row.storage_path ? String(row.storage_path) : undefined,
        hasAlpha: Boolean(row.has_alpha),
        isSystem: false,
        createdAt: String(row.created_at),
      };
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    formData.append('category', category);
    const res = await adminApiJson<{ asset: MediaAsset }>('/api/admin/assets/upload', {
      method: 'POST',
      body: formData,
    });
    return res.asset;
  },

  async uploadMusic(file: File, customTitle?: string): Promise<{ url: string; title: string }> {
    const cleanTitle = (customTitle || '').trim() || file.name.replace(/\.[^.]+$/, '');
    if (supabase) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'mp3';
      const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const storagePath = `music/${safeName}`;
      const { error: uploadErr } = await supabase.storage
        .from('wedding-assets')
        .upload(storagePath, file, { upsert: false });

      if (!uploadErr) {
        const { data: pubUrl } = supabase.storage
          .from('wedding-assets')
          .getPublicUrl(storagePath);
        return { url: pubUrl.publicUrl, title: cleanTitle };
      }

      if (!isMissingTableOrBucketError(uploadErr)) {
        throw new Error(uploadErr.message);
      }
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', cleanTitle);
    return adminApiJson<{ url: string; title: string }>('/api/admin/music/upload', {
      method: 'POST',
      body: formData,
    });
  },

  async deleteAsset(asset: MediaAsset): Promise<void> {
    if (supabase && !asset.url.startsWith('/uploads/')) {
      if (asset.storagePath) {
        await supabase.storage
          .from('wedding-assets')
          .remove([asset.storagePath])
          .catch(() => {});
      }
      const { error } = await supabase.from('assets').delete().eq('id', asset.id);
      if (error && isMissingTableOrBucketError(error)) {
        await adminApiJson(`/api/admin/assets/${encodeURIComponent(asset.id)}`, {
          method: 'DELETE',
        });
        return;
      }
      if (error) throw new Error(error.message);
      return;
    }
    await adminApiJson(`/api/admin/assets/${encodeURIComponent(asset.id)}`, {
      method: 'DELETE',
    });
  },

  async saveCanvas(
    elements: CanvasElement[],
    cameraStops: CameraStop[],
  ): Promise<{ elements: CanvasElement[]; cameraStops: CameraStop[] }> {
    if (supabase) {
      const { error: delElErr } = await supabase
        .from('canvas_elements')
        .delete()
        .neq('id', '__none__');
      if (delElErr && isMissingTableOrBucketError(delElErr)) {
        return adminApiJson<{ elements: CanvasElement[]; cameraStops: CameraStop[] }>(
          '/api/admin/canvas',
          {
            method: 'PUT',
            body: JSON.stringify({ elements, cameraStops }),
          },
        );
      }
      if (delElErr) throw new Error(delElErr.message);

      if (elements.length > 0) {
        const { error: elErr } = await supabase
          .from('canvas_elements')
          .insert(elements.map(mapElementToDb));
        if (elErr && isMissingTableOrBucketError(elErr)) {
          return adminApiJson<{ elements: CanvasElement[]; cameraStops: CameraStop[] }>(
            '/api/admin/canvas',
            {
              method: 'PUT',
              body: JSON.stringify({ elements, cameraStops }),
            },
          );
        }
        if (elErr) throw new Error(elErr.message);
      }

      const { error: delStErr } = await supabase
        .from('camera_stops')
        .delete()
        .neq('id', '__none__');
      if (delStErr && isMissingTableOrBucketError(delStErr)) {
        return adminApiJson<{ elements: CanvasElement[]; cameraStops: CameraStop[] }>(
          '/api/admin/canvas',
          {
            method: 'PUT',
            body: JSON.stringify({ elements, cameraStops }),
          },
        );
      }
      if (delStErr) throw new Error(delStErr.message);

      if (cameraStops.length > 0) {
        const { error: stErr } = await supabase
          .from('camera_stops')
          .insert(cameraStops.map(mapCameraStopToDb));
        if (stErr && isMissingTableOrBucketError(stErr)) {
          return adminApiJson<{ elements: CanvasElement[]; cameraStops: CameraStop[] }>(
            '/api/admin/canvas',
            {
              method: 'PUT',
              body: JSON.stringify({ elements, cameraStops }),
            },
          );
        }
        if (stErr) throw new Error(stErr.message);
      }
      return { elements, cameraStops };
    }

    return adminApiJson<{ elements: CanvasElement[]; cameraStops: CameraStop[] }>(
      '/api/admin/canvas',
      {
        method: 'PUT',
        body: JSON.stringify({ elements, cameraStops }),
      },
    );
  },

  async getAdminRsvps(): Promise<{ rsvps: RsvpEntry[]; wishes: WishEntry[] }> {
    if (supabase) {
      const [rsvpRes, wishRes, settingsRes] = await Promise.all([
        supabase.from('rsvps').select('*').order('created_at', { ascending: false }),
        supabase.from('wishes').select('*').order('created_at', { ascending: false }),
        supabase.from('wedding_settings').select('id, scene_config').eq('id', 1).maybeSingle(),
      ]);
      if (
        isMissingTableOrBucketError(rsvpRes.error) ||
        isMissingTableOrBucketError(wishRes.error)
      ) {
        return adminApiJson<{ rsvps: RsvpEntry[]; wishes: WishEntry[] }>('/api/admin/rsvps');
      }

      const sceneCfg =
        (settingsRes.data?.scene_config as Record<string, unknown> | null) || null;
      const alreadySeeded = Boolean(sceneCfg?.wishesSeeded);
      let rsvpRows = rsvpRes.data || [];
      let wishRows = wishRes.data || [];

      // Materialize built-in default RSVPs & Wishes into real Supabase rows once so admin can edit or delete them permanently
      if (!alreadySeeded && rsvpRows.length === 0 && wishRows.length === 0) {
        try {
          const [insertedRsvps, insertedWishes] = await Promise.all([
            supabase
              .from('rsvps')
              .insert(
                DEFAULT_RSVPS.map((r) => ({
                  guest_name: r.guestName,
                  attendance: r.attendance,
                  guest_count: r.guestCount,
                  session_choice: r.sessionChoice,
                  message: r.message,
                  created_at: r.createdAt,
                })),
              )
              .select('*'),
            supabase
              .from('wishes')
              .insert(
                DEFAULT_WISHES.map((w) => ({
                  guest_name: w.guestName,
                  message: w.message,
                  created_at: w.createdAt,
                })),
              )
              .select('*'),
          ]);

          if (insertedRsvps.data && insertedRsvps.data.length > 0) {
            rsvpRows = insertedRsvps.data;
          }
          if (insertedWishes.data && insertedWishes.data.length > 0) {
            wishRows = insertedWishes.data;
          }

          if (settingsRes.data) {
            await supabase
              .from('wedding_settings')
              .update({
                scene_config: { ...(sceneCfg || {}), wishesSeeded: true },
              })
              .eq('id', 1);
          } else {
            await supabase
              .from('wedding_settings')
              .upsert(mapSettingsToDb(DEFAULT_SETTINGS), { onConflict: 'id' });
          }
        } catch {
          // Non-fatal fallback
        }
      }

      return {
        rsvps: rsvpRows.map((r) => ({
          id: String(r.id),
          guestName: String(r.guest_name),
          attendance: r.attendance as RsvpEntry['attendance'],
          guestCount: Number(r.guest_count),
          sessionChoice: r.session_choice as RsvpEntry['sessionChoice'],
          message: String(r.message ?? ''),
          createdAt: String(r.created_at),
        })),
        wishes: wishRows.map((w) => ({
          id: String(w.id),
          guestName: String(w.guest_name),
          message: String(w.message),
          createdAt: String(w.created_at),
        })),
      };
    }
    return adminApiJson<{ rsvps: RsvpEntry[]; wishes: WishEntry[] }>('/api/admin/rsvps');
  },

  async updateRsvp(
    id: string,
    patch: Partial<
      Pick<RsvpEntry, 'guestName' | 'attendance' | 'guestCount' | 'sessionChoice' | 'message'>
    >,
  ): Promise<RsvpEntry> {
    if (supabase && !id.startsWith('rsvp-')) {
      const dbPatch: Record<string, unknown> = {};
      if (patch.guestName !== undefined) dbPatch.guest_name = patch.guestName;
      if (patch.attendance !== undefined) dbPatch.attendance = patch.attendance;
      if (patch.guestCount !== undefined) dbPatch.guest_count = patch.guestCount;
      if (patch.sessionChoice !== undefined) dbPatch.session_choice = patch.sessionChoice;
      if (patch.message !== undefined) dbPatch.message = patch.message;

      const { data, error } = await supabase
        .from('rsvps')
        .update(dbPatch)
        .eq('id', id)
        .select('*')
        .single();

      if (error && isMissingTableOrBucketError(error)) {
        const res = await adminApiJson<{ rsvp: RsvpEntry }>(
          `/api/admin/rsvps/${encodeURIComponent(id)}`,
          { method: 'PUT', body: JSON.stringify(patch) },
        );
        return res.rsvp;
      }
      if (error || !data) {
        throw new Error(error?.message || 'Gagal memperbarui RSVP.');
      }
      return {
        id: String(data.id),
        guestName: String(data.guest_name),
        attendance: data.attendance as RsvpEntry['attendance'],
        guestCount: Number(data.guest_count),
        sessionChoice: data.session_choice as RsvpEntry['sessionChoice'],
        message: String(data.message ?? ''),
        createdAt: String(data.created_at),
      };
    }

    const res = await adminApiJson<{ rsvp: RsvpEntry }>(
      `/api/admin/rsvps/${encodeURIComponent(id)}`,
      { method: 'PUT', body: JSON.stringify(patch) },
    );
    return res.rsvp;
  },

  async deleteRsvp(id: string): Promise<void> {
    if (supabase && !id.startsWith('rsvp-')) {
      const { error } = await supabase.from('rsvps').delete().eq('id', id);
      if (error && isMissingTableOrBucketError(error)) {
        await adminApiJson(`/api/admin/rsvps/${encodeURIComponent(id)}`, { method: 'DELETE' });
        return;
      }
      if (error) throw new Error(error.message);
      return;
    }
    await adminApiJson(`/api/admin/rsvps/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async updateWish(
    id: string,
    patch: Partial<Pick<WishEntry, 'guestName' | 'message'>>,
  ): Promise<WishEntry> {
    if (supabase && !id.startsWith('wish-')) {
      const dbPatch: Record<string, unknown> = {};
      if (patch.guestName !== undefined) dbPatch.guest_name = patch.guestName;
      if (patch.message !== undefined) dbPatch.message = patch.message;

      const { data, error } = await supabase
        .from('wishes')
        .update(dbPatch)
        .eq('id', id)
        .select('*')
        .single();

      if (error && isMissingTableOrBucketError(error)) {
        const res = await adminApiJson<{ wish: WishEntry }>(
          `/api/admin/wishes/${encodeURIComponent(id)}`,
          { method: 'PUT', body: JSON.stringify(patch) },
        );
        return res.wish;
      }
      if (error || !data) {
        throw new Error(error?.message || 'Gagal memperbarui ucapan.');
      }
      return {
        id: String(data.id),
        guestName: String(data.guest_name),
        message: String(data.message),
        createdAt: String(data.created_at),
      };
    }

    const res = await adminApiJson<{ wish: WishEntry }>(
      `/api/admin/wishes/${encodeURIComponent(id)}`,
      { method: 'PUT', body: JSON.stringify(patch) },
    );
    return res.wish;
  },

  async deleteWish(id: string): Promise<void> {
    if (supabase && !id.startsWith('wish-')) {
      const { error } = await supabase.from('wishes').delete().eq('id', id);
      if (error && isMissingTableOrBucketError(error)) {
        await adminApiJson(`/api/admin/wishes/${encodeURIComponent(id)}`, { method: 'DELETE' });
        return;
      }
      if (error) throw new Error(error.message);
      return;
    }
    await adminApiJson(`/api/admin/wishes/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};
