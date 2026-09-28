import { AdmissionFormData, AdmissionFormErrors } from "../../features/students/AdmissionPage";
import { useText, useIsMadrasa } from "@madrasha/shared-ui/src/i18n";
import { admissionText } from "./admission.text";
import ScriptInput from "@madrasha/shared-ui/src/components/ui/ScriptInput";
import NumericInput from "@madrasha/shared-ui/src/components/ui/NumericInput";

interface Props {
  formData: AdmissionFormData;
  setFormData: React.Dispatch<React.SetStateAction<AdmissionFormData>>;
  errors: AdmissionFormErrors;
  setErrors: React.Dispatch<React.SetStateAction<AdmissionFormErrors>>;
}

const ParentInfo: React.FC<Props> = ({ formData, setFormData, errors, setErrors }) => {
  const t = useText(admissionText);
  const isMadrasa = useIsMadrasa();
  const inputClass = (field: keyof AdmissionFormData) =>
    `border rounded-lg px-3 py-2 outline-none focus:ring-2 dark:bg-slate-800 dark:text-slate-100 ${
      errors[field]
        ? "border-red-500 focus:ring-red-500 dark:border-red-600"
        : "border-gray-300 focus:ring-green-500 dark:border-slate-700"
    }`;

  const ErrorText = ({ field }: { field: keyof AdmissionFormData }) =>
    errors[field] ? <p className="text-red-500 text-xs mt-1 dark:text-red-400">{errors[field]}</p> : null;

  const clearError = (field: keyof AdmissionFormData) => {
    setErrors((prev) => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const field = e.target.name as keyof AdmissionFormData;

    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));

    clearError(field);
  };

  return (
    <div className="bg-white shadow-lg p-6 rounded-xl border border-gray-200 mt-6 dark:bg-slate-900 dark:border-slate-700">
      <div className="flex items-center justify-between border-b pb-3 mb-6 dark:border-slate-700">
        <h2 className="text-xl font-semibold text-gray-700 dark:text-slate-200">{t.parentInfo}</h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.hasAltGuardian}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, hasAltGuardian: e.target.checked }))
            }
            className="w-4 h-4 accent-green-600"
          />
          <span className="text-sm font-medium text-gray-600 dark:text-slate-400">{t.noParents}</span>
        </label>
      </div>

      {!formData.hasAltGuardian && (
      <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">{t.fatherNameBn}</label>
          <ScriptInput
            scriptLang="bn"
            name="fatherName"
            value={formData.fatherName || ""}
            onChange={handleChange}
            placeholder={t.fatherNamePlaceholder}
            className={inputClass("fatherName")}
          />
          <ErrorText field="fatherName" />
        </div>

        {isMadrasa && (
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">{t.fatherNameAr}</label>
          <ScriptInput
            scriptLang="ar"
            name="fatherArabicName"
            value={formData.fatherArabicName || ""}
            onChange={handleChange}
            placeholder="الأب اسم"
            className={inputClass("fatherArabicName")}
          />
          <ErrorText field="fatherArabicName" />
        </div>
        )}

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">{t.fatherNameEn}</label>
          <ScriptInput
            scriptLang="en"
            name="fatherNameEn"
            value={formData.fatherNameEn || ""}
            onChange={handleChange}
            placeholder="Father's Name"
            className={inputClass("fatherNameEn")}
          />
          <ErrorText field="fatherNameEn" />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">{t.fatherNid}</label>
          <NumericInput
            name="fatherNid"
            value={formData.fatherNid || ""}
            onChange={handleChange}
            placeholder={t.fatherNidPlaceholder}
            className={inputClass("fatherNid")}
          />
          <ErrorText field="fatherNid" />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">{t.fatherOccupation}</label>
          <input
            name="fatherOccupation"
            value={formData.fatherOccupation || ""}
            onChange={handleChange}
            placeholder={t.fatherOccupation}
            className={inputClass("fatherOccupation")}
          />
          <ErrorText field="fatherOccupation" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 mt-5">
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">{t.motherNameBn}</label>
          <ScriptInput
            scriptLang="bn"
            name="motherName"
            value={formData.motherName || ""}
            onChange={handleChange}
            placeholder={t.motherNamePlaceholder}
            className={inputClass("motherName")}
          />
          <ErrorText field="motherName" />
        </div>

        {isMadrasa && (
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">{t.motherNameAr}</label>
          <ScriptInput
            scriptLang="ar"
            name="motherArabicName"
            value={formData.motherArabicName || ""}
            onChange={handleChange}
            placeholder="الأم اسم"
            className={inputClass("motherArabicName")}
          />
          <ErrorText field="motherArabicName" />
        </div>
        )}

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">{t.motherNameEn}</label>
          <ScriptInput
            scriptLang="en"
            name="motherNameEn"
            value={formData.motherNameEn || ""}
            onChange={handleChange}
            placeholder="Mother's Name"
            className={inputClass("motherNameEn")}
          />
          <ErrorText field="motherNameEn" />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">{t.motherNid}</label>
          <NumericInput
            name="motherNid"
            value={formData.motherNid || ""}
            onChange={handleChange}
            placeholder={t.motherNidPlaceholder}
            className={inputClass("motherNid")}
          />
          <ErrorText field="motherNid" />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">{t.motherOccupation}</label>
          <input
            name="motherOccupation"
            value={formData.motherOccupation || ""}
            onChange={handleChange}
            placeholder={t.motherOccupation}
            className={inputClass("motherOccupation")}
          />
          <ErrorText field="motherOccupation" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 mt-5">
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">{t.guardianMobile}</label>
          <NumericInput
            name="parentPhone"
            value={formData.parentPhone || ""}
            onChange={handleChange}
            placeholder={t.mobileNo}
            className={inputClass("parentPhone")}
          />
          <ErrorText field="parentPhone" />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">
            {t.guardianAltMobile}
          </label>
          <NumericInput
            name="parentPhone2"
            value={formData.parentPhone2 || ""}
            onChange={handleChange}
            placeholder={t.altMobileNo}
            className={inputClass("parentPhone2")}
          />
          <ErrorText field="parentPhone2" />
        </div>
      </div>
      </>
      )}
    </div>
  );
};

export default ParentInfo;
