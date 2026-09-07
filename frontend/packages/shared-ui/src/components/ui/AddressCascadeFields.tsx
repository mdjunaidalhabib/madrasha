import React, { useMemo } from "react";
import { divisions, getDistrictsByDivision, getUpazilasByDistrict } from "../../data/bdGeo";

export type AddressField = "division" | "district" | "thana";

interface AddressValues {
  division: string;
  district: string;
  thana: string;
}

interface AddressCascadeFieldsProps {
  values: AddressValues;
  onChange: (field: AddressField, value: string) => void;
  selectClassName: string;
  labelClassName?: string;
  wrapperClassName?: string;
}

interface Option {
  value: string;
  label: string;
}

function toOptions(list: { bn_name: string }[]): Option[] {
  return list.map((item) => ({ value: item.bn_name, label: item.bn_name }));
}

function withLegacyOption(options: Option[], currentValue: string): Option[] {
  if (!currentValue || options.some((o) => o.value === currentValue)) return options;
  return [...options, { value: currentValue, label: `${currentValue} (বর্তমান)` }];
}

const DEFAULT_LABEL_CLASS = "text-sm font-medium text-gray-600 mb-1 dark:text-slate-400";
const DEFAULT_WRAPPER_CLASS = "flex flex-col";

const AddressCascadeFields: React.FC<AddressCascadeFieldsProps> = ({
  values,
  onChange,
  selectClassName,
  labelClassName = DEFAULT_LABEL_CLASS,
  wrapperClassName = DEFAULT_WRAPPER_CLASS,
}) => {
  const districtList = useMemo(() => getDistrictsByDivision(values.division), [values.division]);
  const thanaList = useMemo(() => getUpazilasByDistrict(values.district), [values.district]);

  const divisionOptions = useMemo(
    () => withLegacyOption(toOptions(divisions), values.division),
    [values.division]
  );
  const districtOptions = useMemo(
    () => withLegacyOption(toOptions(districtList), values.district),
    [districtList, values.district]
  );
  const thanaOptions = useMemo(
    () => withLegacyOption(toOptions(thanaList), values.thana),
    [thanaList, values.thana]
  );

  const handleDivisionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange("division", e.target.value);
    onChange("district", "");
    onChange("thana", "");
  };

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange("district", e.target.value);
    onChange("thana", "");
  };

  const handleThanaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange("thana", e.target.value);
  };

  return (
    <>
      <div className={wrapperClassName}>
        <label className={labelClassName}>বিভাগ</label>
        <select className={selectClassName} value={values.division} onChange={handleDivisionChange}>
          <option value="">নির্বাচন করুন</option>
          {divisionOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className={wrapperClassName}>
        <label className={labelClassName}>জেলা</label>
        <select
          className={selectClassName}
          value={values.district}
          onChange={handleDistrictChange}
          disabled={!values.division}
        >
          <option value="">নির্বাচন করুন</option>
          {districtOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className={wrapperClassName}>
        <label className={labelClassName}>থানা / উপজেলা</label>
        <select
          className={selectClassName}
          value={values.thana}
          onChange={handleThanaChange}
          disabled={!values.district}
        >
          <option value="">নির্বাচন করুন</option>
          {thanaOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </>
  );
};

export default AddressCascadeFields;
