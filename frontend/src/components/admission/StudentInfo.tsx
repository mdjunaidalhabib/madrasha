import { AdmissionFormData, AdmissionFormErrors } from "../../features/students/AdmissionPage";
import { useEffect, useState } from "react";
import api, { cachedGet } from "../../services/api";
import CustomDatePicker from "../../components/CustomDatePicker/CustomDatePicker";
import { logger } from "../../utils/logger";
import ScriptInput from "../ui/ScriptInput";
import NumericInput from "../ui/NumericInput";

interface Props {
  formData: AdmissionFormData;
  setFormData: React.Dispatch<React.SetStateAction<AdmissionFormData>>;
  errors: AdmissionFormErrors;
  setErrors: React.Dispatch<React.SetStateAction<AdmissionFormErrors>>;
  /** true once the NID lookup has matched an existing student - see AdmissionPage's
   * previousStudent state. Purely a read-only indicator, never manually set. */
  isReturning?: boolean;
}

interface Division {
  division_id: number;
  division_name_bn: string;
}

interface ClassItem {
  class_id: number;
  class_name_bn: string;
}

interface SessionItem {
  id: number;
  name: string;
  isCurrent: boolean;
}

const StudentInfo: React.FC<Props> = ({ formData, setFormData, errors, setErrors, isReturning }) => {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [sessions, setSessions] = useState<SessionItem[]>([]);

  const inputClass = (field: keyof AdmissionFormData) =>
    `border rounded-lg px-3 py-2 outline-none focus:ring-2 dark:bg-slate-800 dark:text-slate-100 ${
      errors[field]
        ? "border-red-500 focus:ring-red-500"
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

  const extractData = (res: any) => res?.data?.data || res?.data?.result || res?.data || [];

  const calculateAge = (dob: string) => {
    const birthDate = new Date(dob + "T00:00:00");
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  };

  const isValidDate = (date: string) => {
    const d = new Date(date);
    return !isNaN(d.getTime());
  };

  const formatAdmissionDate = (date: string) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const field = name as keyof AdmissionFormData;

    setFormData((prev) => {
      const updated = {
        ...prev,
        [name]: name === "gender" ? (value === "" ? null : Number(value)) : value,
      };

      if (name === "academicDivision") {
        updated.previousClass = "";
        updated.currentClass = "";
      }

      if (name === "academicDivision" || name === "currentClass" || name === "academicYear") {
        updated.roll = "";
      }

      return updated;
    });

    clearError(field);

    if (name === "academicDivision") {
      setClasses([]);
      clearError("currentClass");
    }
  };

  useEffect(() => {
    const fetchDivisions = async () => {
      try {
        const res = await cachedGet("/madrasa-divisions");
        const data = extractData(res);
        setDivisions(Array.isArray(data) ? data : []);
      } catch (err) {
        logger.error("Division load error:", err);
        setDivisions([]);
      }
    };

    fetchDivisions();
  }, []);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await cachedGet("/sessions?active_only=true");
        const data = extractData(res);
        const list: SessionItem[] = Array.isArray(data) ? data : [];
        setSessions(list);

        // Default-select the current session once, so admin doesn't have to
        // pick it manually every admission - but never override a value the
        // form already has (e.g. re-admission prefill, edit-in-progress).
        if (!formData.academicYear) {
          const current = list.find((s) => s.isCurrent);
          if (current) {
            setFormData((prev) => ({ ...prev, academicYear: current.name }));
          }
        }
      } catch (err) {
        logger.error("Session load error:", err);
        setSessions([]);
      }
    };

    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!formData.academicDivision) {
      setClasses([]);
      return;
    }

    const controller = new AbortController();

    const fetchClasses = async () => {
      try {
        setLoadingClasses(true);

        const res = await cachedGet(`/madrasa-classes?division_id=${formData.academicDivision}`, {
          signal: controller.signal,
        });

        const data = extractData(res);
        setClasses(Array.isArray(data) ? data : []);
      } catch (err: any) {
        if (err?.name !== "CanceledError") {
          logger.error("Class load error:", err);
        }
        setClasses([]);
      } finally {
        setLoadingClasses(false);
      }
    };

    fetchClasses();

    return () => controller.abort();
  }, [formData.academicDivision]);

  return (
    <div className="bg-white shadow-lg p-6 rounded-xl border border-gray-200 dark:bg-slate-900 dark:border-slate-700">
      <h2 className="text-xl font-semibold mb-6 text-gray-700 border-b pb-3 dark:text-slate-100 dark:border-slate-700">ছাত্রের তথ্য</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">
            ছাত্রের নাম (বাংলা) <span className="text-red-500 dark:text-red-400">*</span>
          </label>
          <ScriptInput
            scriptLang="bn"
            name="name"
            value={formData.name || ""}
            onChange={handleChange}
            className={inputClass("name")}
          />
          <ErrorText field="name" />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">ছাত্রের নাম (আরবি)</label>
          <ScriptInput
            scriptLang="ar"
            name="arabicName"
            value={formData.arabicName || ""}
            onChange={handleChange}
            placeholder="اسم الطالب"
            className={inputClass("arabicName")}
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">ছাত্রের নাম (ইংরেজি)</label>
          <ScriptInput
            scriptLang="en"
            name="nameEn"
            value={formData.nameEn || ""}
            onChange={handleChange}
            placeholder="Student's Name"
            className={inputClass("nameEn")}
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">NID/জন্ম নিবন্ধন নম্বর</label>
          <NumericInput
            name="nid"
            value={formData.nid || ""}
            onChange={handleChange}
            className={inputClass("nid")}
          />
        </div>

        <div className="flex flex-col">
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="text-sm font-medium text-gray-600 dark:text-slate-400">রোল নম্বর</label>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              স্বয়ংক্রিয়
            </span>
          </div>

          <input
            type="text"
            value={formData.roll || ""}
            placeholder="শ্রেণি নির্বাচন করলে সম্ভাব্য রোল দেখা যাবে"
            readOnly
            aria-readonly="true"
            className={`${inputClass("roll")} cursor-not-allowed bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300`}
          />
        </div>

        <div className="flex flex-col">
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="text-sm font-medium text-gray-600 dark:text-slate-400">ভর্তির ধরন</label>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              স্বয়ংক্রিয়
            </span>
          </div>
          <input
            type="text"
            value={isReturning ? "পুনঃভর্তি (পুরাতন)" : "নতুন"}
            readOnly
            aria-readonly="true"
            className="border rounded-lg px-3 py-2 bg-gray-100 text-gray-700 cursor-not-allowed dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
          />
        </div>

        <div className="flex flex-col">
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="text-sm font-medium text-gray-600 dark:text-slate-400">ভর্তির তারিখ</label>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              স্বয়ংক্রিয়
            </span>
          </div>
          <input
            type="text"
            value={formatAdmissionDate(formData.admissionDate)}
            readOnly
            aria-readonly="true"
            className="border rounded-lg px-3 py-2 bg-gray-100 text-gray-700 cursor-not-allowed dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">লিঙ্গ</label>
          <select
            name="gender"
            value={formData.gender ?? ""}
            onChange={handleChange}
            className={inputClass("gender")}
          >
            <option value="">নির্বাচন করুন</option>
            <option value={1}>ছেলে</option>
            <option value={2}>মেয়ে</option>
          </select>
        </div>

        <div>
          <CustomDatePicker
            label="জন্ম তারিখ"
            value={formData.dob || ""}
            onChange={(date) => {
              setFormData((prev) => ({
                ...prev,
                dob: date,
                age: isValidDate(date) ? calculateAge(date) : null,
              }));

              clearError("dob");
            }}
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">বয়স</label>
          <input
            name="age"
            value={formData.age || ""}
            readOnly
            className="border rounded-lg px-3 py-2 bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
          />
        </div>

        {/* শিক্ষাবর্ষ */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">
            শিক্ষাবর্ষ <span className="text-red-500 dark:text-red-400">*</span>
          </label>
          <select
            name="academicYear"
            value={formData.academicYear || ""}
            onChange={handleChange}
            className={inputClass("academicYear")}
          >
            <option value="">নির্বাচন করুন</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.name}>
                {session.name}
                {session.isCurrent ? " (চলমান)" : ""}
              </option>
            ))}
          </select>
          <ErrorText field="academicYear" />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">
            বিভাগ <span className="text-red-500 dark:text-red-400">*</span>
          </label>

          <select
            name="academicDivision"
            value={formData.academicDivision || ""}
            onChange={handleChange}
            className={inputClass("academicDivision")}
          >
            <option value="">নির্বাচন করুন</option>
            {divisions.map((d) => (
              <option key={d.division_id} value={d.division_id}>
                {d.division_name_bn}
              </option>
            ))}
          </select>

          <ErrorText field="academicDivision" />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">
            বর্তমান শ্রেণি <span className="text-red-500 dark:text-red-400">*</span>
          </label>
          <select
            name="currentClass"
            value={formData.currentClass || ""}
            onChange={handleChange}
            disabled={!classes.length || loadingClasses}
            className={inputClass("currentClass")}
          >
            <option value="">{loadingClasses ? "লোড হচ্ছে..." : "নির্বাচন করুন"}</option>
            {classes.map((c) => (
              <option key={c.class_id} value={c.class_id}>
                {c.class_name_bn}
              </option>
            ))}
          </select>
          <ErrorText field="currentClass" />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">পূর্বের শ্রেণি</label>
          <select
            name="previousClass"
            value={formData.previousClass || ""}
            onChange={handleChange}
            disabled={!classes.length || loadingClasses}
            className={inputClass("previousClass")}
          >
            <option value="">{loadingClasses ? "লোড হচ্ছে..." : "নির্বাচন করুন"}</option>
            {classes.map((c) => (
              <option key={c.class_id} value={c.class_id}>
                {c.class_name_bn}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">পূর্ববর্তী প্রতিষ্ঠান</label>
          <input
            name="previousInstitution"
            value={formData.previousInstitution || ""}
            onChange={handleChange}
            placeholder="পূর্ববর্তী প্রতিষ্ঠানের নাম"
            className={inputClass("previousInstitution")}
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-600 mb-1 dark:text-slate-400">পূর্বের ফলাফল</label>
          <input
            name="previousResult"
            value={formData.previousResult || ""}
            onChange={handleChange}
            placeholder="যেমন: মুমতায/জায়্যিদ জিদ্দান"
            className={inputClass("previousResult")}
          />
        </div>
      </div>
    </div>
  );
};

export default StudentInfo;
