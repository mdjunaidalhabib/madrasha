import { z } from "zod";

const text = (max = 190) => z.string().max(max);
const url = (max = 255) =>
  text(max).refine(
    (value) => !value || /^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value),
    "Use an http(s) URL or a site-relative path",
  );
const toggle = z.union([z.literal(0), z.literal(1)]);
const published = { isPublished: toggle };
const ordered = { ...published, sortOrder: z.number().int().min(0).max(1000) };
const link = text(255).refine(
  (value) =>
    !value || /^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value) || value.startsWith("#"),
  "Use an http(s) URL, site path, or section anchor",
);

export const websiteTemplateSchema = z
  .object({
    enabled: z.boolean(),
    settings: z
      .object({
        heroTitle: text(),
        heroSubtitle: text(10000),
        themeColor: z.string().regex(/^#[0-9a-f]{6}$/i),
        themeKey: z.enum(["classic", "modern", "minimal"]),
        showNotices: toggle,
        showGallery: toggle,
        showTeachers: toggle,
        showAdmission: toggle,
        showAbout: toggle,
        showContact: toggle,
        showSlider: toggle,
        showMuhtamim: toggle,
        showCommittee: toggle,
        showNoticeBar: toggle,
        showSovapoti: toggle,
        showVideoGallery: toggle,
        isPublished: toggle,
        noticeBarText: text(10000),
        noticeBarSpeed: z.number().int().min(5).max(60),
        muhtamimName: text(),
        muhtamimDesignation: text(),
        muhtamimPhoto: url(),
        muhtamimMessage: text(20000),
        sovapotiName: text(),
        sovapotiDesignation: text(),
        sovapotiPhoto: url(),
        sovapotiMessage: text(20000),
        facebookUrl: url(),
        youtubeUrl: url(),
        instagramUrl: url(),
        whatsappChannelUrl: url(),
        mapUrl: url(500),
      })
      .strict(),
    pages: z
      .array(
        z
          .object({
            pageKey: z.enum(["about", "admission", "contact"]),
            title: text().min(1),
            content: text(50000),
            ...ordered,
          })
          .strict(),
      )
      .max(3)
      .refine(
        (rows) => new Set(rows.map((r) => r.pageKey)).size === rows.length,
        "Duplicate page key",
      ),
    notices: z
      .array(z.object({ title: text().min(1), content: text(20000), ...published }).strict())
      .max(30),
    slides: z
      .array(
        z
          .object({
            imageUrl: url().refine(Boolean, "Image is required"),
            buttonLink: link,
            ...ordered,
          })
          .strict(),
      )
      .max(20),
    gallery: z
      .array(
        z
          .object({
            title: text(),
            imageUrl: url().refine(Boolean, "Image is required"),
            ...ordered,
          })
          .strict(),
      )
      .max(30),
    committee: z
      .array(
        z
          .object({
            name: text().min(1),
            designation: text(),
            photoUrl: url(),
            phone: text(20),
            ...ordered,
          })
          .strict(),
      )
      .max(30),
    videos: z
      .array(
        z
          .object({
            title: text(),
            videoUrl: url().refine(Boolean, "Video URL is required"),
            ...ordered,
          })
          .strict(),
      )
      .max(20),
  })
  .strict();

export type WebsiteTemplate = z.infer<typeof websiteTemplateSchema>;

export const DEFAULT_WEBSITE_TEMPLATE: WebsiteTemplate = {
  enabled: true,
  settings: {
    heroTitle: "জ্ঞান, আদর্শ ও সুন্দর আগামীর পথে",
    heroSubtitle:
      "{{institution_name}} — নৈতিকতা, সুশিক্ষা ও মানবিক মূল্যবোধে আলোকিত মানুষ গড়ার প্রত্যয়।",
    themeColor: "#0f766e",
    themeKey: "modern",
    showNotices: 1,
    showGallery: 1,
    showTeachers: 1,
    showAdmission: 1,
    showAbout: 1,
    showContact: 1,
    showSlider: 1,
    showMuhtamim: 1,
    showCommittee: 1,
    showNoticeBar: 1,
    showSovapoti: 1,
    showVideoGallery: 1,
    isPublished: 1,
    noticeBarSpeed: 25,
    noticeBarText:
      "{{institution_name}}-এর ওয়েবসাইটে স্বাগতম। এটি নমুনা কনটেন্ট; সঠিক তথ্যের জন্য প্রতিষ্ঠানের অফিসে যোগাযোগ করুন।",
    muhtamimName: "প্রতিষ্ঠান প্রধান",
    muhtamimDesignation: "প্রতিষ্ঠান প্রধান (নমুনা)",
    muhtamimPhoto: "/images/website-demo-avatar.svg",
    muhtamimMessage:
      "শিক্ষার সঙ্গে নৈতিকতা ও মানবিকতার সমন্বয় আমাদের অঙ্গীকার। প্রতিটি শিক্ষার্থীর মেধা ও সম্ভাবনার বিকাশে আমরা একসঙ্গে কাজ করতে চাই। এটি নমুনা বাণী; আপনার নিজস্ব বাণী এখানে যুক্ত করুন।",
    sovapotiName: "সভাপতি",
    sovapotiDesignation: "পরিচালনা পরিষদ (নমুনা)",
    sovapotiPhoto: "/images/website-demo-avatar.svg",
    sovapotiMessage:
      "একটি সুন্দর শিক্ষার পরিবেশ গড়তে শিক্ষক, অভিভাবক ও পরিচালনা পরিষদের সম্মিলিত উদ্যোগ অপরিহার্য। আমাদের এই পথচলায় আপনাকে স্বাগতম। এটি নমুনা বাণী।",
    facebookUrl: "",
    youtubeUrl: "",
    instagramUrl: "",
    whatsappChannelUrl: "",
    mapUrl: "",
  },
  pages: [
    {
      pageKey: "about",
      title: "আমাদের পরিচয়",
      content:
        "{{institution_name}}-এ আপনাকে স্বাগতম। জ্ঞানচর্চা, শৃঙ্খলা ও নৈতিক মূল্যবোধের সমন্বয়ে শিক্ষার্থীদের সুন্দর ভবিষ্যৎ গড়াই আমাদের লক্ষ্য।\n\nঅভিজ্ঞ শিক্ষকমণ্ডলী, আন্তরিক পরিচর্যা এবং সহশিক্ষা কার্যক্রমের মাধ্যমে প্রতিটি শিক্ষার্থীর সম্ভাবনা বিকাশে আমরা কাজ করি।\n\nএটি নমুনা পরিচিতি। ওয়েবসাইট সেটিংস থেকে প্রতিষ্ঠানের প্রকৃত ইতিহাস, লক্ষ্য ও কার্যক্রম যোগ করুন।",
      isPublished: 1,
      sortOrder: 1,
    },
    {
      pageKey: "admission",
      title: "ভর্তি নির্দেশনা",
      content:
        "ভর্তি সংক্রান্ত বিস্তারিত তথ্য, প্রয়োজনীয় কাগজপত্র ও সময়সূচির জন্য প্রতিষ্ঠানের অফিসে যোগাযোগ করুন। অনলাইন আবেদন ফর্ম পূরণ করে আপনার আগ্রহ জানাতে পারেন।\n\nএটি নমুনা নির্দেশনা; প্রতিষ্ঠানের নির্ধারিত ভর্তি নীতিমালা এখানে যোগ করুন।",
      isPublished: 1,
      sortOrder: 2,
    },
    {
      pageKey: "contact",
      title: "যোগাযোগ করুন",
      content:
        "আমাদের শিক্ষা কার্যক্রম ও ভর্তি সম্পর্কে জানতে প্রতিষ্ঠানের অফিসে যোগাযোগ করুন। আপনার প্রশ্ন ও মতামতকে আমরা স্বাগত জানাই।",
      isPublished: 1,
      sortOrder: 3,
    },
  ],
  notices: [
    {
      title: "আমাদের নতুন ওয়েবসাইটে স্বাগতম",
      content:
        "{{institution_name}}-এর সংবাদ, নোটিশ ও কার্যক্রম এখন এই ওয়েবসাইটে পাবেন। এটি একটি নমুনা নোটিশ।",
      isPublished: 1,
    },
    {
      title: "ভর্তি তথ্য — নমুনা নোটিশ",
      content:
        "ভর্তি সম্পর্কে জানতে অফিসে যোগাযোগ করুন। প্রতিষ্ঠান কর্তৃপক্ষ এখানে প্রকৃত সময়সূচি ও নির্দেশনা প্রকাশ করবেন।",
      isPublished: 1,
    },
  ],
  slides: [
    {
      imageUrl: "/images/website-demo-campus.svg",
      buttonLink: "#about",
      isPublished: 1,
      sortOrder: 1,
    },
  ],
  gallery: [
    {
      title: "শিক্ষার সুন্দর পরিবেশ — নমুনা চিত্র",
      imageUrl: "/images/website-demo-campus.svg",
      isPublished: 1,
      sortOrder: 1,
    },
    {
      title: "জ্ঞানচর্চার আয়োজন — নমুনা চিত্র",
      imageUrl: "/images/website-demo-books.svg",
      isPublished: 1,
      sortOrder: 2,
    },
  ],
  committee: [
    {
      name: "পরিচালনা পরিষদের সদস্য",
      designation: "সদস্য (নমুনা)",
      photoUrl: "/images/website-demo-avatar.svg",
      phone: "",
      isPublished: 1,
      sortOrder: 1,
    },
  ],
  videos: [],
};
