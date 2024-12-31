import { Form } from "react-bootstrap";
import SettingControlBase from "./SettingControlBase";
import { useEffect, useState } from "react";

export default function SettingControlText({
  id,
  name,
  oldValue,
  value,
  placeholder,
  validator,
  onChange,
}: {
  id: string;
  name?: string;
  oldValue?: string;
  value?: string;
  placeholder?: string;
  validator?: (value: string) => boolean;
  onChange: (value: string) => void;
}) {
  const [text, setText] = useState<string>(value ?? "");

  const oldValueString = oldValue ?? "";
  const valueString = value ?? "";

  useEffect(() => {
    setText(valueString);
  }, [oldValueString, valueString]);

  return (
    <SettingControlBase id={id} name={name}>
      <Form.Control
        type="text"
        className={oldValueString != valueString ? "border-success" : ""}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (validator && !validator(e.target.value)) {
            return;
          }
          onChange(e.target.value);
        }}
        placeholder={placeholder}
        isInvalid={validator ? !validator(text) : false}
      />
    </SettingControlBase>
  );
}
