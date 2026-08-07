import api from "./api";

/**
 * Phase 4 API bindings: SMS/Email Notification System.
 */

export type NotificationChannel = "SMS" | "EMAIL";
export type NotificationStatus = "PENDING" | "SENT" | "FAILED";

export interface NotificationLogItem {
  id: number;
  channel: NotificationChannel;
  recipient: string;
  subject?: string | null;
  message: string;
  status: NotificationStatus;
  provider?: string | null;
  errorMessage?: string | null;
  sentAt?: string | null;
  createdAt: string;
}

export const notificationApi = {
  send: (payload: {
    channel: NotificationChannel;
    recipients: string[];
    subject?: string;
    message: string;
  }) => api.post("/notifications/send", payload),

  list: (params?: { channel?: NotificationChannel; status?: NotificationStatus; limit?: number }) =>
    api.get("/notifications", { params }),
};

/* ================= IMAGE / FILE STORAGE (Cloudinary) ================= */

export type UploadFolder =
  | "students"
  | "teachers"
  | "branding"
  | "gallery"
  | "certificates"
  | "profile"
  | "misc";

export interface UploadImageResponse {
  uploaded: boolean;
  configured: boolean;
  url: string | null;
  public_id: string | null;
}

export const uploadApi = {
  /** Uploads a base64 data-URI image to Cloudinary. If cloud storage
   * isn't configured yet (`configured: false`), the caller should keep
   * using the base64 string it already has instead of `url`. */
  uploadImage: (image: string, folder: UploadFolder = "misc") =>
    api.post<{ success: boolean; data: UploadImageResponse }>("/uploads/image", { image, folder }),

  deleteImage: (publicId: string) =>
    api.delete("/uploads/image", { data: { public_id: publicId } }),
};
