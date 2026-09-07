import { useEffect } from "react";
import { useLetterDesignStore } from "../../../../store/letterDesignStore";
import type { LetterDesignKey } from "./LetterDocument";

/**
 * Shared by every letter-style document (Sanad, Testimonial, Transfer
 * Letter, ...) — they all render through the same LetterDocument shell, so
 * they share one "letter design" preference instead of one each.
 */
export function useLetterDesign(): { design: LetterDesignKey; backgroundImage: string | null } {
  const design = useLetterDesignStore((s) => s.design);
  const fetchDesign = useLetterDesignStore((s) => s.fetchDesign);

  useEffect(() => {
    fetchDesign();
  }, [fetchDesign]);

  return {
    design: design?.letter_design || "classic",
    backgroundImage: design?.letter_background_image || null,
  };
}
