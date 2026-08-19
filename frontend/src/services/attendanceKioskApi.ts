import axios from "axios";

import { API_BASE_URL } from "./apiConfig";

/**
 * কিওস্ক স্ক্যান কলগুলোর জন্য আলাদা axios instance — শেয়ার্ড `api` instance
 * ব্যবহার করা হয় না ইচ্ছাকৃতভাবে, কারণ কিওস্ক পেজে কোনো লগইন করা এডমিন নেই।
 * একই ব্রাউজারে যদি কাকতালীয়ভাবে এডমিন সেশন cached থাকে, শেয়ার্ড instance
 * ব্যবহার করলে ভুলবশত Authorization bearer token পাঠিয়ে দেওয়ার ঝুঁকি থাকত।
 * এখানে কোনো interceptor নেই — প্রতিটি কলে হেডার এক্সপ্লিসিটভাবে আর্গুমেন্ট
 * হিসেবে পাস করা হয়।
 */
const kioskClient = axios.create({ baseURL: API_BASE_URL });

export type KioskScanResponse = {
  success: true;
  data: {
    alreadyMarked: boolean;
    student: {
      id: number;
      name_bn: string;
      roll: number | string;
      class_id: number;
      image?: string | null;
    };
  };
};

export const scanCard = (slug: string, kioskKey: string, cardUid: string) =>
  kioskClient.post<KioskScanResponse>(
    "/attendance/kiosk/scan-card",
    { card_uid: cardUid },
    {
      headers: {
        "X-Madrasa-Slug": slug,
        "x-kiosk-key": kioskKey,
      },
    },
  );

export const scanFingerprint = (slug: string, kioskKey: string, fingerprintId: string) =>
  kioskClient.post<KioskScanResponse>(
    "/attendance/kiosk/scan-fingerprint",
    { fingerprint_id: fingerprintId },
    {
      headers: {
        "X-Madrasa-Slug": slug,
        "x-kiosk-key": kioskKey,
      },
    },
  );
