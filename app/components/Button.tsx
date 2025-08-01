"use client";
import { useT } from "@/app/i18n";

export default function Button({
  onClick,
  enabled,
  variant,
  icon,
  iconLeft,
  iconStyle,
  tooltip,
  text,
  loading,
  className,
}: {
  onClick: () => void;
  enabled?: boolean;
  variant?: string;
  icon?: string;
  iconLeft?: boolean;
  iconStyle?: string;
  tooltip?: string;
  text?: string;
  loading?: boolean;
  className?: string;
}) {
  const t = useT();
  const actualVariant = variant ?? "primary";
  const actuallyEnabled = (enabled ?? true) && !loading;
  const tooltipText = tooltip ? t(tooltip) : text ? t(text.trim()) : undefined;
  const iconStyleClass = iconStyle ? "-" + iconStyle : "";

  const iconElement = loading ? (
    <div className="spinner-border spinner-border-sm" role="status">
      <span className="visually-hidden">{t("Loading...")}</span>
    </div>
  ) : (
    <i className={"fa" + iconStyleClass + " fa-" + icon}></i>
  );
  return (
    <button
      type="button"
      className={
        (className ? className + " " : "") +
        "btn px-3 btn-" +
        actualVariant +
        (actuallyEnabled ? "" : " disabled")
      }
      data-bs-toggle="tooltip"
      data-bs-placement="top"
      disabled={!actuallyEnabled}
      tabIndex={-1}
      title={tooltipText}
      onClick={onClick}
    >
      <>
        {iconLeft && icon && iconElement}
        {iconLeft && icon && text && " "}
        {text && <span>{t(text)}</span>}
        {!iconLeft && icon && text && " "}
        {!iconLeft && icon && iconElement}
      </>
    </button>
  );
}
