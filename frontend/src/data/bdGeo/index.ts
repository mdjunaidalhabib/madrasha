import divisionsData from "./divisions.json";
import districtsData from "./districts.json";
import upazilasData from "./upazilas.json";

export interface BdDivision {
  id: string;
  name: string;
  bn_name: string;
}

export interface BdDistrict {
  id: string;
  division_id: string;
  name: string;
  bn_name: string;
}

export interface BdUpazila {
  id: string;
  district_id: string;
  name: string;
  bn_name: string;
}

export const divisions: BdDivision[] = divisionsData.divisions;
export const districts: BdDistrict[] = districtsData.districts;
export const upazilas: BdUpazila[] = upazilasData.upazilas;

export function getDistrictsByDivision(divisionBnName: string): BdDistrict[] {
  const division = divisions.find((d) => d.bn_name === divisionBnName);
  if (!division) return [];
  return districts.filter((d) => d.division_id === division.id);
}

export function getUpazilasByDistrict(districtBnName: string): BdUpazila[] {
  const district = districts.find((d) => d.bn_name === districtBnName);
  if (!district) return [];
  return upazilas.filter((u) => u.district_id === district.id);
}
