import { Form } from "react-bootstrap";
import SettingControlBase from "./SettingControlBase";
import { useEffect, useState } from "react";

export default function SettingControlText({
  id,
  name,
  value,
  placeholder,
  modified,
  validator,
  onChange,
}: {
  id: string;
  name?: string;
  value?: string;
  placeholder?: string;
  modified?: boolean;
  validator?: (value: string) => boolean;
  onChange: (value: string) => void;
}) {
  const [text, setText] = useState<string>(value ?? "");

  useEffect(() => {
    setText(value ?? "");
  }, [value]);

  return (
    <SettingControlBase id={id} name={name}>
      <Form.Control
        type="text"
        className={modified ? "border-success" : ""}
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
