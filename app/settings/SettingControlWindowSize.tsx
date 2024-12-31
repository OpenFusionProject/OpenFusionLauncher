import { WindowSize } from "@/app/types";
import { useEffect, useState } from "react";
import { Form } from "react-bootstrap";
import SettingControlBase from "./SettingControlBase";

const DEFAULT_WINDOW_WIDTH = 1280;
const DEFAULT_WINDOW_HEIGHT = 720;

const validateSize = (value: string, def: number) => {
  if (value === "") return def;
  if (value.trim() === "") return undefined; // can't be all whitespace
  const size = Number(value);
  if (isNaN(size)) return undefined;
  return size;
};

export default function SettingControlWindowSize({
  id,
  name,
  value,
  modified,
  onChange,
}: {
  id: string;
  name?: string;
  value?: WindowSize;
  modified?: boolean;
  onChange: (value: WindowSize | undefined) => void;
}) {
  const [width, setWidth] = useState<string>("");
  const [height, setHeight] = useState<string>("");

  useEffect(() => {
    if (!value) {
      setWidth("");
      setHeight("");
      return;
    }

    if (validateSize(width, DEFAULT_WINDOW_WIDTH) !== value.width) {
      setWidth(value.width.toString());
    }
    if (validateSize(height, DEFAULT_WINDOW_HEIGHT) !== value.height) {
      setHeight(value.height.toString());
    }
  }, [value]);

  const updateOuter = (width: string, height: string) => {
    if (width === "" && height === "") {
      onChange(undefined);
      return;
    }

    const widthValue = validateSize(width, DEFAULT_WINDOW_WIDTH);
    const heightValue = validateSize(height, DEFAULT_WINDOW_HEIGHT);
    if (widthValue !== undefined && heightValue !== undefined) {
      onChange({ width: widthValue, height: heightValue });
    }
  };

  const onWidthChange = (value: string) => {
    setWidth(value);
    updateOuter(value, height);
  };

  const onHeightChange = (value: string) => {
    setHeight(value);
    updateOuter(width, value);
  };

  return (
    <SettingControlBase id={id} name={name}>
      <div className="d-flex align-items-center">
        <Form.Control
          type="text"
          value={width}
          className={modified ? "border-success" : ""}
          placeholder={DEFAULT_WINDOW_WIDTH.toString()}
          onChange={(e) => onWidthChange(e.target.value)}
          isInvalid={validateSize(width, DEFAULT_WINDOW_WIDTH) === undefined}
        />
        <strong className="mx-2">X</strong>
        <Form.Control
          type="text"
          value={height}
          className={modified ? "border-success" : ""}
          placeholder={DEFAULT_WINDOW_HEIGHT.toString()}
          onChange={(e) => onHeightChange(e.target.value)}
          isInvalid={validateSize(height, DEFAULT_WINDOW_HEIGHT) === undefined}
        />
      </div>
    </SettingControlBase>
  );
}
