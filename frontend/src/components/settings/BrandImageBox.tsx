import { useRef } from "react";

type Props = {
  label: string;
  hint?: string;
  value: string | null | undefined;
  onChange: (dataUrl: string) => void;
  onRemove: () => void;
  shape?: "square" | "wide";
};

const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export default function BrandImageBox({
  label,
  hint,
  value,
  onChange,
  onRemove,
  shape = "square",
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("দয়া করে একটি ছবি ফাইল নির্বাচন করুন");
      return;
    }

    if (file.size > MAX_SIZE) {
      alert("ছবির সাইজ ২MB এর কম হতে হবে");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => onChange(reader.result as string);
    reader.readAsDataURL(file);

    e.target.value = "";
  };

  return (
    <div className="rounded-xl border p-4">
      <p className="mb-1 font-semibold">{label}</p>
      {hint && <p className="mb-3 text-xs text-gray-500">{hint}</p>}

      <div
        onClick={() => fileRef.current?.click()}
        className={`flex cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-gray-50 hover:bg-gray-100 ${
          shape === "wide" ? "h-28 w-full" : "h-32 w-32"
        }`}
        style={{
          backgroundImage: value ? `url(${value})` : "none",
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
        }}
      >
        {!value && <span className="px-2 text-center text-sm text-gray-500">ছবি আপলোড করুন</span>}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
        >
          আপলোড
        </button>
        {value && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded bg-red-500 px-3 py-1 text-sm text-white"
          >
            মুছুন
          </button>
        )}
      </div>

      <input type="file" ref={fileRef} hidden accept="image/*" onChange={handleFile} />
    </div>
  );
}
