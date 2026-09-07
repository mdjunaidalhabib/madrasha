import api, { cachedGet } from "./api";

export type BookLabelDesignKey = "classic" | "minimal" | "arch" | "custom";

export type BookLabelDesignPayload = {
  book_label_design?: BookLabelDesignKey;
  book_label_background_image?: string | null;
};

export type BookLabelDesignResponse = {
  book_label_design: BookLabelDesignKey;
  book_label_background_image: string | null;
};

export async function getBookLabelDesign(): Promise<BookLabelDesignResponse> {
  const res = await cachedGet("/settings/book-label-design");
  return res.data?.data || { book_label_design: "classic", book_label_background_image: null };
}

export async function saveBookLabelDesign(payload: BookLabelDesignPayload) {
  const res = await api.put("/settings/book-label-design", payload);
  return res.data;
}
