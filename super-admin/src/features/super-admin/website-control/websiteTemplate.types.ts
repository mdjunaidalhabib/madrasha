export type TemplateSettings = {
  heroTitle: string;
  heroSubtitle: string;
  themeColor: string;
  themeKey: "classic" | "modern" | "minimal";
  showNotices: number;
  showGallery: number;
  showTeachers: number;
  showAdmission: number;
  showAbout: number;
  showContact: number;
  showSlider: number;
  showMuhtamim: number;
  showCommittee: number;
  showNoticeBar: number;
  showSovapoti: number;
  showVideoGallery: number;
  isPublished: number;
  noticeBarText: string;
  noticeBarSpeed: number;
  muhtamimName: string;
  muhtamimDesignation: string;
  muhtamimPhoto: string;
  muhtamimMessage: string;
  sovapotiName: string;
  sovapotiDesignation: string;
  sovapotiPhoto: string;
  sovapotiMessage: string;
  facebookUrl: string;
  youtubeUrl: string;
  instagramUrl: string;
  whatsappChannelUrl: string;
  mapUrl: string;
};
export type TemplateItem = { isPublished: number; sortOrder?: number } & Record<
  string,
  string | number
>;
export type WebsiteTemplate = {
  enabled: boolean;
  settings: TemplateSettings;
  pages: TemplateItem[];
  notices: TemplateItem[];
  slides: TemplateItem[];
  gallery: TemplateItem[];
  committee: TemplateItem[];
  videos: TemplateItem[];
};
export type TemplateResponse = {
  content: WebsiteTemplate;
  updatedAt: string | null;
};
