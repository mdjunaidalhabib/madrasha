import { useState, useEffect, useCallback } from "react";
import Button from "../../ui/Button";
import BasicInfoSection from "./BasicInfoSection";
import PlanSection from "./PlanSection";
import DefaultUsersSection from "./DefaultUsersSection";
import { CreateMadrasaPayload } from "./types";
import { Plan } from "../../../features/super-admin/madrasa-management/SuperAdminMadrasasPage";
import api from "../../../services/adminApi";

import DivisionsSection from "./DivisionsSection";
import ClassesSection from "./ClassesSection";
import BooksSection from "./BooksSection";
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

type Group = {
  title: string;
  items: Item[];
};

type DefaultUser = {
  role: "muhtamim" | "talimat" | "accountant";
  enabled: boolean;
  email: string;
  password: string;
};

export default function CreateMadrasaModal({ plans, onClose, onSubmit }: Props) {
  const [form, setForm] = useState({
    name: "",
    slug: "",
    address: "",
    phone: "",
  });

  const [planId, setPlanId] = useState("");
  const [studentLimit, setStudentLimit] = useState(100);
  const [userLimit, setUserLimit] = useState(5);

  // ===== master data =====
  const [divisionItems, setDivisionItems] = useState<Item[]>([]);
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

  const [defaultUsers, setDefaultUsers] = useState<DefaultUser[]>([
    { role: "muhtamim", enabled: true, email: "", password: "" },
    { role: "talimat", enabled: false, email: "", password: "" },
    { role: "accountant", enabled: false, email: "", password: "" },
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
        api.get("/super/divisions"),
        api.get("/super/modules"),
        api.get("/super/classes"),
        api.get("/super/books"),
      ]);

      const divData = (divRes.data?.data || []).map((r: any) => ({
        key: String(r.id),
        label: r.label || r.name,
      }));

      const modData = (modRes.data?.data || []).map((r: any) => ({
        key: String(r.id),
        label: r.label || r.name,
      }));

      const classesData = classRes.data?.data || [];
      const booksData = bookRes.data?.data || [];

      setDivisionItems(divData);
      setModuleItems(modData);
      setAllClasses(classesData);
      setAllBooks(booksData);

      setDivisions(divData.map((d: Item) => d.key));
      setModules(modData.map((m: Item) => m.key));
      setClasses(classesData.map((c: any) => String(c.id)));
      setBooks(booksData.map((b: any) => String(b.id)));
    };

    fetchData();
  }, []);

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
        title: division?.label || "Unknown",
        items,
      };
    });

    setGroupedClasses(grouped);

    const validKeys = grouped.flatMap((g) => g.items.map((i) => i.key));

    // ✅ keep only valid selected classes
    setClasses((prev) => prev.filter((c) => validKeys.includes(c)));
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
        title: cls?.label || cls?.name || "Unknown",
        items,
      };
    });

    setGroupedBooks(grouped);

    const validKeys = grouped.flatMap((g) => g.items.map((i) => i.key));

    // ✅ keep only valid selected books
    setBooks((prev) => prev.filter((b) => validKeys.includes(b)));
  }, [classes, allBooks, allClasses]);

  /* =========================
  Plan Logic
  ========================= */
  const handlePlanChange = useCallback(
    (id: string) => {
      setPlanId(id);
      const plan = plans.find((p) => String(p.id) === id);
      if (!plan) return;

      setStudentLimit(plan.student_limit);
      setUserLimit(plan.user_limit);
    },
    [plans]
  );

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

    if (!form.name.trim()) newErrors.name = "Madrasa name required";

    defaultUsers.forEach((u) => {
      if (!u.enabled) return;

      if (!u.email.trim()) {
        newErrors[u.role + "_email"] = "Email required";
      }

      if (!u.password.trim()) {
        newErrors[u.role + "_password"] = "Password required";
      }

      if (u.password.length < 6) {
        newErrors[u.role + "_password"] = "Password must be at least 6 characters";
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
        plan_id: Number(planId),
        student_limit: studentLimit,
        user_limit: userLimit,

        divisions: divisions.map(Number),
        classes: classes.map(Number),
        books: books.map(Number),
        modules: modules.map(Number),

        default_users: defaultUsers
          .filter((u) => u.enabled)
          .map((u) => ({
            role: u.role,
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-xl p-6 space-y-6 max-h-[90vh] overflow-y-auto">
        <BasicInfoSection
          data={form}
          errors={errors}
          onChange={(field, value) => setForm((prev) => ({ ...prev, [field]: value }))}
        />

        <PlanSection
          plans={plans}
          plan_id={planId}
          student_limit={studentLimit}
          user_limit={userLimit}
          locked={!!planId}
          onPlanChange={handlePlanChange}
        />

        <DivisionsSection items={divisionItems} divisions={divisions} setDivisions={setDivisions} />

        {groupedClasses.length > 0 && (
          <ClassesSection groups={groupedClasses} classes={classes} setClasses={setClasses} />
        )}

        {groupedBooks.length > 0 && (
          <BooksSection groups={groupedBooks} books={books} setBooks={setBooks} />
        )}

        <ToggleSection
          title="Modules"
          items={moduleItems}
          selected={modules}
          setSelected={setModules}
        />

        <DefaultUsersSection
          defaultUsers={defaultUsers}
          setDefaultUsers={setDefaultUsers}
          errors={errors}
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>

          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Creating..." : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}
