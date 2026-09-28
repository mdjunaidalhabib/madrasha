import React, { useState } from "react";
import StaffImageUpload from "../../components/staff-admission/StaffImageUpload";
import StaffInfo from "../../components/staff-admission/StaffInfo";
import StaffParentInfo from "../../components/staff-admission/StaffParentInfo";
import AddressInfo from "../../components/staff-admission/AddressInfo";
import SubmitButton from "../../components/teachers-admission/SubmitButton";
import api from "../../services/api";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { getText, useText } from "@madrasha/shared-ui/src/i18n";
import { teacherStaffText } from "../teachers/teacherStaff.text";

export interface StaffFormData {
  name_bn: string;
  name_ar: string;
  name_en: string;
  nid: string;
  gender: number | null;
  dob: string;
  age: number | null;
  phone: string;
  email: string;
  designation: string;
  department: string;
  qualification: string;
  experience_year: string;
  experience_month: string;
  joining_date: string;
  salary: string;
  father_name: string;
  father_name_ar: string;
  father_name_en: string;
  mother_name: string;
  mother_name_ar: string;
  mother_name_en: string;
  father_nid: string;
  mother_nid: string;
  father_occupation: string;
  mother_occupation: string;
  parent_phone: string;
  division: string;
  district: string;
  thana: string;
  village: string;
  image: string;
}

export type StaffFormErrors = Partial<Record<keyof StaffFormData, string>>;

const initialState: StaffFormData = {
  name_bn: "",
  name_ar: "",
  name_en: "",
  nid: "",
  gender: null,
  dob: "",
  age: null,
  phone: "",
  email: "",
  designation: "",
  department: "",
  qualification: "",
  experience_year: "",
  experience_month: "",
  joining_date: "",
  salary: "",
  father_name: "",
  father_name_ar: "",
  father_name_en: "",
  mother_name: "",
  mother_name_ar: "",
  mother_name_en: "",
  father_nid: "",
  mother_nid: "",
  father_occupation: "",
  mother_occupation: "",
  parent_phone: "",
  division: "",
  district: "",
  thana: "",
  village: "",
  image: "",
};

const cleanPhone = (phone: string | number) => String(phone || "").replace(/[^0-9]/g, "");

const toGenderNumber = (value: any) => {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return num === 1 || num === 2 ? num : null;
};

const calculateAge = (dob?: string) => {
  if (!dob) return null;

  const birth = new Date(dob + "T00:00:00");
  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const StaffPage: React.FC = () => {
  const t = useText(teacherStaffText);
  const [formData, setFormData] = useState<StaffFormData>(initialState);
  const [errors, setErrors] = useState<StaffFormErrors>({});
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const newErrors: StaffFormErrors = {};

    if (!formData.name_bn.trim()) newErrors.name_bn = getText(teacherStaffText).enterStaffName;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const makePayload = (data: StaffFormData) => ({
    name_bn: data.name_bn,
    name_ar: data.name_ar || null,
    name_en: data.name_en || null,
    nid: data.nid || null,
    gender: toGenderNumber(data.gender),
    dob: data.dob || null,
    age: data.age ?? calculateAge(data.dob),
    phone: cleanPhone(data.phone) || null,
    email: data.email || null,
    designation: data.designation || null,
    department: data.department || null,
    qualification: data.qualification || null,
    experience_year: Number(data.experience_year || 0),
    experience_month: Number(data.experience_month || 0),
    joining_date: data.joining_date || null,
    salary: data.salary ? Number(data.salary) : null,
    father_name: data.father_name || null,
    father_name_ar: data.father_name_ar || null,
    father_name_en: data.father_name_en || null,
    father_nid: data.father_nid || null,
    father_occupation: data.father_occupation || null,
    mother_name: data.mother_name || null,
    mother_name_ar: data.mother_name_ar || null,
    mother_name_en: data.mother_name_en || null,
    mother_nid: data.mother_nid || null,
    mother_occupation: data.mother_occupation || null,
    parent_phone: cleanPhone(data.parent_phone),
    division: data.division || null,
    district: data.district || null,
    thana: data.thana || null,
    village: data.village || null,
    image: data.image || null,
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setLoading(true);
      await api.post("/staff", makePayload(formData));
      useToastStore.getState().show(getText(teacherStaffText).staffAdded, "success");
      setFormData(initialState);
      setErrors({});
    } catch (error: any) {
      useToastStore.getState().show(error?.response?.data?.message || getText(teacherStaffText).staffAddFailed, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-center mb-6 dark:text-slate-100">{t.staffRegistration}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <StaffImageUpload formData={formData} setFormData={setFormData} />

        <StaffInfo formData={formData} setFormData={setFormData} errors={errors} setErrors={setErrors} />

        <StaffParentInfo formData={formData} setFormData={setFormData} />

        <AddressInfo formData={formData} setFormData={setFormData} />

        <SubmitButton loading={loading} text={t.saveStaff} />
      </form>
    </div>
  );
};

export default StaffPage;
