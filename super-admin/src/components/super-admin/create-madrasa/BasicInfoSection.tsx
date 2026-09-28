import Input from "@madrasha/shared-ui/src/components/ui/Input";
import { useText } from "@madrasha/shared-ui/src/i18n";
import { createMadrasaText } from "./createMadrasa.text";

type FormData = {
  name: string;
  slug: string;
  address: string;
  phone: string;
};

type Props = {
  data: FormData;
  errors: Record<string, string>;
  onChange: (field: keyof FormData, value: string) => void;
};

export default function BasicInfoSection({ data, errors, onChange }: Props) {
  const t = useText(createMadrasaText);
  const fieldClass = (name: keyof FormData) => (errors[name] ? "border-red-500" : "");

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-700 dark:text-slate-200">{t.basicInfo}</h4>

      <Field label={t.institutionNameRequired} error={errors.name}>
        <Input
          name="name"
          className={fieldClass("name")}
          value={data.name}
          onChange={(e) => onChange("name", e.target.value)}
        />
      </Field>

      <Field label={t.slugOptional}>
        <Input name="slug" value={data.slug} onChange={(e) => onChange("slug", e.target.value)} />
      </Field>

      <Field label={t.addressOptional}>
        <Input
          name="address"
          value={data.address}
          onChange={(e) => onChange("address", e.target.value)}
        />
      </Field>

      <Field label={t.contactNumber}>
        <Input
          name="phone"
          value={data.phone}
          onChange={(e) => onChange("phone", e.target.value)}
          autoComplete="tel"
        />
      </Field>
    </div>
  );
}

type FieldProps = {
  label: string;
  children: React.ReactNode;
  error?: string;
};

function Field({ label, children, error }: FieldProps) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-600 block mb-1 dark:text-slate-400">{label}</label>

      {children}

      {error && <p className="text-xs text-red-600 mt-1 dark:text-red-400">{error}</p>}
    </div>
  );
}
