import { SettingsOption } from "@/app/types";
import { Form } from "react-bootstrap";
import SettingControlBase from "./SettingControlBase";

export default function SettingControlDropdown({
  id,
  name,
  options,
  value,
  defaultValue,
  modified,
  onChange,
}: {
  id: string;
  name?: string;
  options: SettingsOption[];
  value?: any;
  defaultValue: any;
  modified?: boolean;
  onChange: (value: any) => void;
}) {
  const initialValue = value ?? defaultValue;
  return (
    <SettingControlBase id={id} name={name}>
      <Form.Select
        className={modified ? "border-success" : ""}
        value={initialValue}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label +
              (option.description ? " - " + option.description : "") +
              (option.value === defaultValue ? " (default)" : "")}
          </option>
        ))}
      </Form.Select>
    </SettingControlBase>
  );
}
