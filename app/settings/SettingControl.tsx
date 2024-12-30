import { SettingsOption } from "@/app/types";
import { Form } from "react-bootstrap";

export default function SettingControl({
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
  options?: SettingsOption[];
  value?: any;
  defaultValue: any;
  modified?: boolean;
  onChange: (value: any) => void;
}) {
  const initialValue = value ?? defaultValue;
  const settingsOptions = options ?? [];
  return (
    <Form.Group controlId={"setting-control-" + id} className="mb-3">
      <Form.Label>{name}</Form.Label>
      {settingsOptions.length > 0 ? <Form.Select
        className={modified ? "border-success" : ""}
        value={initialValue}
        onChange={(e) => onChange(e.target.value)}
      >
        {settingsOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label + (option.description ? (": " + option.description) : "")}
          </option>
        ))}
      </Form.Select>
      :
      <Form.Control
        type="text"
        className={modified ? "border-success" : ""}
        defaultValue={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={defaultValue}
      />}
    </Form.Group>
  );
}
