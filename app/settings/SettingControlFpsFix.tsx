import { useEffect, useState } from "react";
import { Form } from "react-bootstrap";
import SettingControlBase from "./SettingControlBase";
import { FpsFix, FpsLimit } from "@/app/types";
import { useT } from "@/app/i18n";

const KEY_FIX_ON = "on";
const KEY_FIX_ON_WITH_LIMITER = "on_with_limiter";
const KEY_FIX_OFF = "off";

const DEFAULT_FPS_LIMIT = 60;

const validateFps = (value: string) => {
  if (value === "") return DEFAULT_FPS_LIMIT;
  if (value.trim() === "") return undefined; // can't be all whitespace
  const fps = Number(value);
  if (isNaN(fps)) return undefined;
  if (fps < 1) return undefined;
  if (fps % 1 !== 0) return undefined;
  return fps;
};

const getKeyForValue = (value: FpsFix) => {
  if (value === KEY_FIX_ON) return KEY_FIX_ON;
  if (value === KEY_FIX_OFF) return KEY_FIX_OFF;
  return KEY_FIX_ON_WITH_LIMITER;
};

const getFpsLimitForValue = (value: FpsFix) => {
  const key = getKeyForValue(value);
  if (key === KEY_FIX_ON_WITH_LIMITER)
    return (value as FpsLimit).on_with_limiter;
  return undefined;
};

export default function SettingControlFpsFix({
  id,
  name,
  oldValue,
  value,
  onChange,
}: {
  id: string;
  name?: string;
  oldValue: FpsFix;
  value: FpsFix;
  onChange: (value: FpsFix) => void;
}) {
  const t = useT();
  const [selected, setSelected] = useState<string>(getKeyForValue(value));
  const [fpsLimit, setFpsLimit] = useState<string>(
    getFpsLimitForValue(value)?.toString() ?? "",
  );

  const updateOuter = (key: string, fpsLimit?: string) => {
    if (key === KEY_FIX_ON) {
      onChange(KEY_FIX_ON);
      return;
    }
    if (key === KEY_FIX_OFF) {
      onChange(KEY_FIX_OFF);
      return;
    }
    const fps = validateFps(fpsLimit!);
    if (fps === undefined) return;
    onChange({ on_with_limiter: fps });
  };

  useEffect(() => {
    const key = getKeyForValue(value);
    setSelected(key);
    if (key === KEY_FIX_ON_WITH_LIMITER) {
      const cfgLimit: FpsLimit = value as FpsLimit;
      if (validateFps(fpsLimit) !== cfgLimit.on_with_limiter) {
        setFpsLimit(cfgLimit.on_with_limiter.toString());
      }
    }
  }, [value]);

  const keyModified = getKeyForValue(value) !== getKeyForValue(oldValue);
  const fpsModified = keyModified
    ? selected === KEY_FIX_ON_WITH_LIMITER
    : getFpsLimitForValue(value) !== getFpsLimitForValue(oldValue);

  const EXPLANATION = [
    t("FusionFall's framerate is normally capped around 64 FPS."),
    t("This setting activates a patch to remove this limit."),
    t(
      "You can restore the original behavior by turning it off or tweak it to your own soft cap.",
    ),
  ];

  return (
    <SettingControlBase id={id} name={name}>
      <p className="text-muted">{EXPLANATION.join(" ")}</p>
      <Form.Check
        type="radio"
        id={`${id}-on`}
        label={t("On (experimental, default)")}
        checked={selected === KEY_FIX_ON}
        className={selected === KEY_FIX_ON && keyModified ? "text-success" : ""}
        onChange={() => {
          setSelected(KEY_FIX_ON);
          updateOuter(KEY_FIX_ON);
        }}
      />
      <div className="d-flex align-items-center">
        <Form.Check
          type="radio"
          id={`${id}-on-with-limiter`}
          label={t("On with limiter")}
          checked={selected === KEY_FIX_ON_WITH_LIMITER}
          className={
            selected === KEY_FIX_ON_WITH_LIMITER && keyModified
              ? "text-success"
              : ""
          }
          onChange={() => {
            setSelected(KEY_FIX_ON_WITH_LIMITER);
            updateOuter(KEY_FIX_ON_WITH_LIMITER, fpsLimit);
          }}
        />
        <Form.Control
          type="text"
          disabled={selected !== KEY_FIX_ON_WITH_LIMITER}
          value={fpsLimit}
          className={"fps-input ms-3" + (fpsModified ? " border-success" : "")}
          placeholder={DEFAULT_FPS_LIMIT.toString()}
          isInvalid={validateFps(fpsLimit) === undefined}
          onChange={(e) => {
            setFpsLimit(e.target.value);
            updateOuter(KEY_FIX_ON_WITH_LIMITER, e.target.value);
          }}
        />
        <span className="mx-2">FPS</span>
      </div>
      <Form.Check
        type="radio"
        id={`${id}-off`}
        label={t("Off")}
        checked={selected === KEY_FIX_OFF}
        className={
          selected === KEY_FIX_OFF && keyModified ? "text-success" : ""
        }
        onChange={() => {
          setSelected(KEY_FIX_OFF);
          updateOuter(KEY_FIX_OFF);
        }}
      />
    </SettingControlBase>
  );
}
