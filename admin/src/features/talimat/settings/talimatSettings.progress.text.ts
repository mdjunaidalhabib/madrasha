import { defineText } from "@madrasha/shared-ui/src/i18n";

/** Progress-overlay wording for copy / delete of a {{division}}, {{class}} or
 * {{subject}} in the {{academic}} settings. */
export const talimatSettingsProgressText = defineText({
  bn: {
    // বিভাগ
    duplicateDivisionTitle: "{{division}} ডুপ্লিকেট করা হচ্ছে",
    duplicateDivisionStepCheck: "{{division}} যাচাই করা হচ্ছে",
    duplicateDivisionStepCreate: "নতুন {{division}} তৈরি করা হচ্ছে",
    duplicateDivisionStepClasses: "{{class}} কপি করা হচ্ছে",
    duplicateDivisionStepBooks: "{{subject}} কপি করা হচ্ছে",
    deleteDivisionTitle: "{{division}} ডিলিট করা হচ্ছে",
    deleteDivisionStepCheck: "{{division}} যাচাই করা হচ্ছে",
    deleteDivisionStepMove: "ট্রাশে সরানো হচ্ছে",
    // শ্রেণি
    duplicateClassTitle: "{{class}} ডুপ্লিকেট করা হচ্ছে",
    duplicateClassStepCheck: "{{class}} যাচাই করা হচ্ছে",
    duplicateClassStepCreate: "নতুন {{class}} তৈরি করা হচ্ছে",
    duplicateClassStepBooks: "{{subject}} কপি করা হচ্ছে",
    deleteClassTitle: "{{class}} ডিলিট করা হচ্ছে",
    deleteClassStepCheck: "{{class}} যাচাই করা হচ্ছে",
    deleteClassStepMove: "ডিলিট করা হচ্ছে",
    // কিতাব
    duplicateBookTitle: "{{subject}} ডুপ্লিকেট করা হচ্ছে",
    duplicateBookStepCheck: "{{subject}} যাচাই করা হচ্ছে",
    duplicateBookStepCopy: "নতুন কপি তৈরি করা হচ্ছে",
    deleteBookTitle: "{{subject}} ডিলিট করা হচ্ছে",
    deleteBookStepCheck: "{{subject}} যাচাই করা হচ্ছে",
    deleteBookStepMove: "ট্রাশে সরানো হচ্ছে",
    deleteBookStepResults: "ফলাফল হালনাগাদ হচ্ছে",
    // shared
    stepReload: "তালিকা হালনাগাদ হচ্ছে",
    deleteFailed: "ডিলিট করা যায়নি",
  },
  en: {
    duplicateDivisionTitle: "Duplicating {{division}}",
    duplicateDivisionStepCheck: "Checking the {{division}}",
    duplicateDivisionStepCreate: "Creating the new {{division}}",
    duplicateDivisionStepClasses: "Copying {{class}}es",
    duplicateDivisionStepBooks: "Copying {{subject}}s",
    deleteDivisionTitle: "Deleting {{division}}",
    deleteDivisionStepCheck: "Checking the {{division}}",
    deleteDivisionStepMove: "Moving to trash",

    duplicateClassTitle: "Duplicating {{class}}",
    duplicateClassStepCheck: "Checking the {{class}}",
    duplicateClassStepCreate: "Creating the new {{class}}",
    duplicateClassStepBooks: "Copying {{subject}}s",
    deleteClassTitle: "Deleting {{class}}",
    deleteClassStepCheck: "Checking the {{class}}",
    deleteClassStepMove: "Deleting",

    duplicateBookTitle: "Duplicating {{subject}}",
    duplicateBookStepCheck: "Checking the {{subject}}",
    duplicateBookStepCopy: "Creating the copy",
    deleteBookTitle: "Deleting {{subject}}",
    deleteBookStepCheck: "Checking the {{subject}}",
    deleteBookStepMove: "Moving to trash",
    deleteBookStepResults: "Updating results",

    stepReload: "Refreshing the list",
    deleteFailed: "Could not delete",
  },
});
