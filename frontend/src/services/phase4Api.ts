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

export type NotificationRecipient = string | { to: string; vars?: Record<string, string | number> };

export interface AudienceStudent {
  id: number;
  name: string;
  roll: number;
  phone: string;
}

export interface AudienceTeacher {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
}

export interface AudienceResult {
  studentId: number;
  name: string;
  roll: number | string;
  phone: string;
  gpa: string;
  grade: string;
  status: string;
}

export type NotificationEventKey = "ADMISSION" | "INFO_UPDATE" | "FEE_PAYMENT";

export interface NotificationSettingItem {
  eventKey: NotificationEventKey;
  isEnabled: boolean;
  template: string;
}

export const notificationApi = {
  send: (payload: {
    channel: NotificationChannel;
    recipients: NotificationRecipient[];
    subject?: string;
    message: string;
  }) => api.post("/notifications/send", payload),

  list: (params?: { channel?: NotificationChannel; status?: NotificationStatus; limit?: number }) =>
    api.get("/notifications", { params }),

  audienceStudents: (params?: { sessionId?: number; classId?: number }) =>
    api.get<{ data: AudienceStudent[] }>("/notifications/audience/students", { params }),

  audienceTeachers: () => api.get<{ data: AudienceTeacher[] }>("/notifications/audience/teachers"),

  audienceResults: (params: { examId: number; classId: number }) =>
    api.get<{ data: AudienceResult[] }>("/notifications/audience/results", { params }),

  getSettings: () => api.get<{ data: NotificationSettingItem[] }>("/notifications/settings"),

  updateSetting: (eventKey: NotificationEventKey, payload: { isEnabled?: boolean; template?: string }) =>
    api.put(`/notifications/settings/${eventKey}`, payload),

  /** SMS returns a numeric/raw balance from the gateway; EMAIL has no
   * balance concept so `success` reports whether the SMTP connection
   * works. Both read the platform-wide gateway Super Admin configured. */
  checkBalance: (channel: NotificationChannel) =>
    api.get<{
      data: {
        channel: NotificationChannel;
        success: boolean;
        balance?: number | string;
        raw?: string;
        errorMessage?: string;
      };
    }>("/notifications/balance", { params: { channel } }),
};

/* ================= IMAGE / FILE STORAGE (Cloudinary) ================= */

export type UploadFolder =
  | "students"
  | "teachers"
  | "branding"
  | "gallery"
  | "certificates"
  | "document-templates"
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
