import { Form } from "react-bootstrap";
import SettingControlBase from "./SettingControlBase";
import { useEffect, useState } from "react";
import Button from "@/components/Button";
import { open } from "@tauri-apps/plugin-dialog";

export default function SettingControlBrowse({
  id,
  name,
  oldValue,
  value,
  placeholder,
  directory,
  extensions,
  validator,
  onChange,
}: {
  id: string;
  name?: string;
  oldValue?: string;
  value?: string;
  placeholder?: string;
  directory?: boolean;
  extensions?: string[];
  validator?: (value: string) => boolean;
  onChange: (value: string) => void;
}) {
  const [text, setText] = useState<string>(value ?? "");

  const oldValueString = oldValue ?? "";
  const valueString = value ?? "";

  useEffect(() => {
    setText(valueString);
  }, [oldValueString, valueString]);

  const onTextChange = (txt: string) => {
    setText(txt);
    if (validator && !validator(txt)) {
      return;
    }
    onChange(txt);
  };

  const onBrowse = async () => {
    const isDirectory = directory ?? false;
    const result = await open({
      multiple: false,
      directory: isDirectory,
      filters: isDirectory
        ? []
        : [
            {
              name: "File",
              extensions: extensions ?? ["*"],
            },
          ],
    });
    if (result) {
      onTextChange(result);
    }
  };

  return (
    <SettingControlBase id={id} name={name}>
      <div className="d-flex align-items-center">
        <Form.Control
          type="text"
          className={oldValueString != valueString ? "border-success" : ""}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={placeholder}
          isInvalid={validator ? !validator(text) : false}
        />
        <Button className="ms-3" text="Browse..." onClick={() => onBrowse()} />
      </div>
    </SettingControlBase>
  );
}
