import { defineText, getText } from "../i18n";

const imageUploadText = defineText({
  bn: { invalid: "সর্বোচ্চ ১০ MB-এর স্থির JPG, PNG বা WebP ছবি দিন।", readFailed: "ছবিটি পড়া যায়নি। আবার চেষ্টা করুন।" },
  en: { invalid: "Choose a still JPG, PNG or WebP image up to 10 MB.", readFailed: "Could not read the image. Please try again." },
});

/** Validate before FileReader allocates a base64 copy of a potentially large file. */
export function readImageUploadFile(file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return Promise.reject(new Error(getText(imageUploadText).invalid));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(getText(imageUploadText).readFailed));
    reader.readAsDataURL(file);
  });
}
