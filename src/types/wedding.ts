export type AssetCategory =
  | 'floral'
  | 'foliage'
  | 'frame'
  | 'couple'
  | 'venue'
  | 'backdrop';

export interface MediaAsset {
  id: string;
  name: string;
  category: AssetCategory;
  url: string;
  storagePath?: string;
  hasAlpha: boolean;
  isSystem?: boolean;
  createdAt: string;
}

export interface CanvasElement {
  id: string;
  assetId: string;
  label: string;
  url: string;
  x: number;
  y: number;
  z: number;
  scale: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  opacity: number;
  removeWhiteBg: boolean;
  centerWindow?: boolean;
  swayAmplitude: number;
  swaySpeed: number;
  floatAmplitude: number;
  chapterIndex: number;
  sortOrder: number;
  visible: boolean;
}

export interface CameraStop {
  id: string;
  chapterIndex: number;
  title: string;
  subtitle: string;
  scrollAt: number; // 0..1
  camX: number;
  camY: number;
  camZ: number;
  lookX: number;
  lookY: number;
  lookZ: number;
}

export interface StoryMilestone {
  year: string;
  title: string;
  description: string;
}

export interface WeddingSettings {
  coupleHeadline: string;
  brideFullName: string;
  brideParents: string;
  brideBio: string;
  groomFullName: string;
  groomParents: string;
  groomBio: string;
  weddingDateIso: string;
  displayDateText: string;
  cityLocation: string;
  openingQuote: string;
  openingVerseSource: string;
  // Scene 2: Ayat / Doa Berpasang-pasangan
  verseTitle: string;
  verseQuote: string;
  // Scene 3: Gazebo Akad & Resepsi
  akadTitle: string;
  akadTime: string;
  akadVenue: string;
  akadAddress: string;
  resepsiTitle: string;
  resepsiTime: string;
  resepsiVenue: string;
  resepsiAddress: string;
  mapsUrl: string;
  dressCode: string;
  // Scene 5: Taman Kado (Wedding Gift)
  giftTitle: string;
  giftMessage: string;
  giftBankName: string;
  giftAccountNumber: string;
  giftAccountHolder: string;
  // Scene 6: Langit Penutup (Ucapan Terima Kasih)
  closingThanksTitle: string;
  closingThanksMessage: string;
  // Illustrated UI Elements & Audio (Gate, Smoke Puff Backdrop, Music)
  gateImageUrl: string;
  smokeImageUrl: string;
  couplePhotoUrl: string;
  venuePhotoUrl: string;
  skyColorHex: string;
  musicEnabled: boolean;
  musicUrl: string;
  musicTitle: string;
  storyMilestones: StoryMilestone[];
}

export interface RsvpEntry {
  id: string;
  guestName: string;
  attendance: 'hadir' | 'tidak_hadir' | 'ragu';
  guestCount: number;
  sessionChoice: 'akad_resepsi' | 'akad_only' | 'resepsi_only';
  message: string;
  createdAt: string;
}

export interface WishEntry {
  id: string;
  guestName: string;
  message: string;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'admin';
}

export interface InvitationBundle {
  settings: WeddingSettings;
  elements: CanvasElement[];
  cameraStops: CameraStop[];
  wishes: WishEntry[];
}
