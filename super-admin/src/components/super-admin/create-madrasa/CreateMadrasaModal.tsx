import { useState, useEffect, useCallback, useMemo } from "react";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import BasicInfoSection from "./BasicInfoSection";
import PlanSection, { RegBlockPreviewRow } from "./PlanSection";
import DefaultUsersSection from "./DefaultUsersSection";
import { CreateMadrasaPayload } from "./types";
import { Plan } from "../../../features/super-admin/madrasa-management/SuperAdminMadrasasPage";
import { cachedGet } from "../../../services/adminApi";
import { commonText, useText, type InstitutionType } from "@madrasha/shared-ui/src/i18n";
import { createMadrasaText } from "./createMadrasa.text";
import InstitutionSection, { normalizeDefaultLanguage, type DefaultLanguageValue } from "./InstitutionSection";

import DivisionsSection from "./DivisionsSection";
import ToggleSection from "./ToggleSection";

type Props = {
  plans: Plan[];
  onClose: () => void;
  onSubmit: (payload: CreateMadrasaPayload) => Promise<void>;
};

type Item = {
  key: string;
  label: string;
};

/** Catalogue division row, tagged with the institution type it belongs to. */
type DivisionItem = Item & { institutionType: InstitutionType };

type Group = {
  title: string;
  items: Item[];
};

type DefaultUser = {
  role: "muhtamim" | "talimat" | "accountant";
  enabled: boolean;
  name: string;
  email: string;
  password: string;
};

export default function CreateMadrasaModal({ plans, onClose, onSubmit }: Props) {
  const t = useText(createMadrasaText);
  const c = useText(commonText);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    address: "",
    phone: "",
  });

  const [institutionType, setInstitutionType] = useState<InstitutionType>("MADRASA");
  const [defaultLanguage, setDefaultLanguage] = useState<DefaultLanguageValue>("");

  const [planId, setPlanId] = useState("");
  const [studentLimit, setStudentLimit] = useState(100);
  const [userLimit, setUserLimit] = useState(5);
  const [durationDays, setDurationDays] = useState(365);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));

  // ===== master data =====
  const [allDivisionItems, setAllDivisionItems] = useState<DivisionItem[]>([]);
  const [moduleItems, setModuleItems] = useState<Item[]>([]);
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [allBooks, setAllBooks] = useState<any[]>([]);

  // ===== grouped =====
  const [groupedClasses, setGroupedClasses] = useState<Group[]>([]);
  const [groupedBooks, setGroupedBooks] = useState<Group[]>([]);

  // ===== selected =====
  const [divisions, setDivisions] = useState<string[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [books, setBooks] = useState<string[]>([]);

  // তালিমাত/অ্যাকাউন্টেন্ট রোলের ডিফল্ট লগইন এখানে আর বানানো হয় না - মুহতামিম
  // নিজেই dynamic Users/Roles সেটিংস থেকে যেকোনো রোলের স্টাফ তৈরি করতে পারেন।
  // মুহতামিমের অ্যাকাউন্টটাই একমাত্র bootstrap করা জরুরি।
  const [defaultUsers, setDefaultUsers] = useState<DefaultUser[]>([
    { role: "muhtamim", enabled: true, name: "", email: "", password: "" },
  ]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  /* =========================
  Auto Slug
  ========================= */
  useEffect(() => {
    if (!form.name) return;

    const slug = form.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    setForm((prev) => ({ ...prev, slug }));
  }, [form.name]);

  /* =========================
  Fetch ALL Data
  ========================= */
  useEffect(() => {
    const fetchData = async () => {
      const [divRes, modRes, classRes, bookRes] = await Promise.all([
        cachedGet("/super/divisions"),
        cachedGet("/super/modules"),
        cachedGet("/super/classes"),
        cachedGet("/super/books"),
      ]);

      const divData: DivisionItem[] = (divRes.data?.data || []).map((r: any) => ({
        key: String(r.id),
        label: r.label || r.name,
        institutionType: (r.institution_type || "MADRASA") as InstitutionType,
      }));

      const modData = (modRes.data?.data || []).map((r: any) => ({
        key: String(r.id),
        label: r.label || r.name,
      }));

      const classesData = classRes.data?.data || [];
      const booksData = bookRes.data?.data || [];

      setAllDivisionItems(divData);
      setModuleItems(modData);
      setAllClasses(classesData);
      setAllBooks(booksData);

      // Default: every catalogue division of the (initial) institution type.
      setDivisions(divData.filter((d) => d.institutionType === "MADRASA").map((d) => d.key));
      setModules(modData.map((m: Item) => m.key));
      setClasses(classesData.map((c: any) => String(c.id)));
      setBooks(booksData.map((b: any) => String(b.id)));
    };

    fetchData();
  }, []);

  // Only the catalogue divisions of the selected institution type are offered
  // (classes/books follow their division, see the effects below).
  const divisionItems = useMemo<Item[]>(
    () => allDivisionItems.filter((d) => d.institutionType === institutionType),
    [allDivisionItems, institutionType],
  );

  const handleTypeChange = (type: InstitutionType) => {
    setInstitutionType(type);
    setDefaultLanguage((prev) => normalizeDefaultLanguage(type, prev));
    // A new institution starts with the whole catalogue of its type selected,
    // so switching type swaps the selection to that type's divisions.
    setDivisions(allDivisionItems.filter((d) => d.institutionType === type).map((d) => d.key));
  };

  /* =========================
  Division → Classes
  ========================= */
  useEffect(() => {
    if (!divisions.length) {
      setGroupedClasses([]);
      setClasses([]);
      return;
    }

    const grouped = divisions.map((divId) => {
      const division = divisionItems.find((d) => d.key === divId);

      const items = allClasses
        .filter((c) => String(c.division_id) === divId)
        .map((c) => ({
          key: String(c.id),
          label: c.label || c.name,
        }));

      return {
        title: division?.label || t.unknown,
        items,
      };
    });

    setGroupedClasses(grouped);

    const validKeys = grouped.flatMap((g) => g.items.map((i) => i.key));

    // ✅ Classes UI is hidden — auto-select ALL classes under the selected divisions
    setClasses(validKeys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [divisions, allClasses, divisionItems]);

  /* =========================
  Class → Books
  ========================= */
  useEffect(() => {
    if (!classes.length) {
      setGroupedBooks([]);
      setBooks([]);
      return;
    }

    const grouped = classes.map((classId) => {
      const cls = allClasses.find((c) => String(c.id) === classId);

      const items = allBooks
        .filter((b) => String(b.class_id) === classId)
        .map((b) => ({
          key: String(b.id),
          label: b.label || b.name,
        }));

      return {
        title: cls?.label || cls?.name || t.unknown,
        items,
      };
    });

    setGroupedBooks(grouped);

    const validKeys = grouped.flatMap((g) => g.items.map((i) => i.key));

    // ✅ Books UI is hidden — auto-select ALL books under the auto-selected classes
    setBooks(validKeys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classes, allBooks, allClasses]);

  /* =========================
  Plan Logic
  ========================= */
  const handlePlanChange = useCallback(
    (id: string) => {
      setPlanId(id);
      const plan = plans.find((p) => String(p.id) === id);
      if (!plan) return;

      setStudentLimit(plan.studentLimit);
      setUserLimit(plan.userLimit);
      setDurationDays(plan.durationDays);
    },
    [plans]
  );

  /* Preview of the registration-number blocks the backend will lay out on
     creation (assignMissingRegistrationBlocksOnTx): selected বিভাগ in catalog
     order, each class a block of the plan's size, back to back from 1. */
  const regBlockPreview = useMemo<RegBlockPreviewRow[]>(() => {
    const plan = plans.find((p) => String(p.id) === planId);
    const sizes = new Map((plan?.regBlocks || []).map((b) => [String(b.divisionId), b.blockSize]));
    const selectedClasses = new Set(classes);
    let cursor = 0;
    return divisionItems
      .filter((d) => divisions.includes(d.key))
      .map((d) => {
        const classCount = allClasses.filter(
          (c) => String(c.division_id) === d.key && selectedClasses.has(String(c.id)),
        ).length;
        const size = sizes.get(d.key) ?? 0;
        const total = size * classCount;
        const row = {
          label: d.label,
          classCount,
          size,
          start: total ? cursor + 1 : null,
          end: total ? cursor + total : null,
        };
        cursor += total;
        return row;
      });
  }, [plans, planId, divisionItems, divisions, allClasses, classes]);

  useEffect(() => {
    if (plans.length && !planId) {
      handlePlanChange(String(plans[0].id));
    }
  }, [plans, planId, handlePlanChange]);

  /* =========================
  Validation
  ========================= */
  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!form.name.trim()) newErrors.name = t.errInstitutionName;

    defaultUsers.forEach((u) => {
      if (!u.enabled) return;

      if (!u.name.trim()) {
        newErrors[u.role + "_name"] = t.errName;
      }

      if (!u.email.trim()) {
        newErrors[u.role + "_email"] = t.errEmail;
      }

      if (!u.password.trim()) {
        newErrors[u.role + "_password"] = t.errPassword;
      }

      if (u.password.length < 6) {
        newErrors[u.role + "_password"] = t.errPasswordMin;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /* =========================
  Submit
  ========================= */
  const handleSubmit = async () => {
    if (!validate()) return;

    setSaving(true);

    try {
      const payload: CreateMadrasaPayload = {
        ...form,
        institution_type: institutionType,
        default_language: defaultLanguage || null,
        plan_id: Number(planId),
        student_limit: studentLimit,
        user_limit: userLimit,
        duration_days: durationDays,
        start_date: startDate,

        divisions: divisions.map(Number),
        classes: classes.map(Number),
        books: books.map(Number),
        modules: modules.map(Number),

        default_users: defaultUsers
          .filter((u) => u.enabled)
          .map((u) => ({
            role: u.role,
            name: u.name,
            email: u.email,
            password: u.password,
          })),
      };

      await onSubmit(payload);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="relative bg-white w-full max-w-2xl rounded-xl shadow-xl p-4 sm:p-6 space-y-6 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto dark:bg-slate-900 dark:text-slate-100">
        <BasicInfoSection
          data={form}
          errors={errors}
          onChange={(field, value) => setForm((prev) => ({ ...prev, [field]: value }))}
        />

        <div className="space-y-3">
          <h4 className="font-semibold text-gray-700 dark:text-slate-200">{t.typeAndLanguage}</h4>
          <InstitutionSection
            institutionType={institutionType}
            defaultLanguage={defaultLanguage}
            onTypeChange={handleTypeChange}
            onLanguageChange={setDefaultLanguage}
          />
        </div>

        <PlanSection
          plans={plans}
          plan_id={planId}
          student_limit={studentLimit}
          user_limit={userLimit}
          duration_days={durationDays}
          start_date={startDate}
          locked={!!planId}
          onPlanChange={handlePlanChange}
          onStartDateChange={setStartDate}
          regBlockPreview={regBlockPreview}
        />

        <DivisionsSection items={divisionItems} divisions={divisions} setDivisions={setDivisions} />
        {!divisionItems.length && allDivisionItems.length > 0 && (
          <p className="-mt-4 text-xs text-amber-600 dark:text-amber-400">{t.noDivisionsForType}</p>
        )}

        {/* Classes section intentionally hidden: classes are auto-created based on selected divisions */}

        {/* Books section intentionally hidden: books are auto-created based on the auto-selected classes */}

        <ToggleSection
          title={t.modules}
          items={moduleItems}
          selected={modules}
          setSelected={setModules}
        />

        <DefaultUsersSection
          defaultUsers={defaultUsers}
          setDefaultUsers={setDefaultUsers}
          errors={errors}
        />

        <div className="flex gap-3 pt-4 sm:justify-end">
          <Button variant="secondary" className="flex-1 sm:flex-none" onClick={onClose} disabled={saving}>
            {c.cancel}
          </Button>

          <Button className="flex-1 sm:flex-none" onClick={handleSubmit} disabled={saving}>
            {saving ? t.creating : c.create}
          </Button>
        </div>
      </div>

      {saving && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-white/30 backdrop-blur-sm dark:bg-slate-950/40">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        </div>
      )}
    </div>
  );
}
