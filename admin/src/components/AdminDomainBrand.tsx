import { useAdminDomainStore } from "../store/adminDomainStore";

export default function AdminDomainBrand() {
  const institution = useAdminDomainStore((s) => s.institution);
  if (!institution) return null;
  return (
    <div className="space-y-2 text-center">
      {institution.logo && (
        <img src={institution.logo} alt="" className="mx-auto h-16 w-16 object-contain" />
      )}
      <p className="text-lg font-semibold">{institution.name}</p>
    </div>
  );
}
