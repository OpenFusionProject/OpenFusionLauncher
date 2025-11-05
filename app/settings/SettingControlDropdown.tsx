import { SettingsOption } from "@/app/types";
import { Form } from "react-bootstrap";
import SettingControlBase from "./SettingControlBase";
import { useEffect, useState } from "react";

export default function SettingControlDropdown({
  id,
  name,
  options,
  oldValue,
  value,
  defaultKey,
  onChange,
}: {
  id: string;
  name?: string;
  options: SettingsOption[];
  oldValue?: any;
  value?: any;
  defaultKey: string;
  onChange: (value: any) => void;
}) {
  const getOptionValueFromKey = (key: string) => {
    const option = options.find((option) => option.key === key);
    if (!option) {
      console.warn("Invalid option key: " + key);
      return undefined;
    }
    const optionVal = option.value ?? option.key;
    return optionVal;
  };

  const getKeyFromOptionValue = (value: unknown) => {
    const option = options.find((option) => {
      const optionVal = option.value ?? option.key;
      return optionVal === value;
    });
    if (!option) {
      return defaultKey;
    }
    return option.key;
  };

  const initialKey = getKeyFromOptionValue(value) ?? defaultKey;
  const [selected, setSelected] = useState<string>(initialKey);

  useEffect(() => {
    const newKey = getKeyFromOptionValue(value) ?? defaultKey;
    setSelected(newKey);
  }, [oldValue, value, options]);

  return (
    <SettingControlBase id={id} name={name}>
      <Form.Select
        className={value !== oldValue ? "border-success" : ""}
        value={selected}
        onChange={(e) => {
          const key = e.target.value;
          setSelected(key);
          const optionVal = getOptionValueFromKey(key);
          onChange(optionVal);
        }}
      >
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label +
              (option.description ? " - " + option.description : "") +
              (option.key === defaultKey ? " (default)" : "")}
          </option>
        ))}
      </Form.Select>
    </SettingControlBase>
  );
}
