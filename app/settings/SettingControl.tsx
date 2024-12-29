import { SettingsOption } from "@/app/types";
import { Form } from "react-bootstrap";

export default function SettingControl({
  id,
  name,
  options,
  value,
  defaultValue,
  onChange,
}: {
  id: string;
  name?: string;
  options: SettingsOption[];
  value?: any;
  defaultValue: any;
  onChange?: (value: any) => void;
}) {
  const initialValue = value ?? defaultValue;
  return (
    <Form.Group controlId={"setting-control-" + id}>
      <Form.Label>{name}</Form.Label>
      <Form.Select
        value={initialValue}
        onChange={(e) => onChange && onChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label + (option.description ? (": " + option.description) : "")}
          </option>
        ))}
      </Form.Select>
    </Form.Group>
  );
}
