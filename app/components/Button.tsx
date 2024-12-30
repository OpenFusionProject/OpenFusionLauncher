export default function Button({
  onClick,
  enabled,
  variant,
  icon,
  iconLeft,
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
  tooltip?: string;
  text?: string;
  loading?: boolean;
  className?: string;
}) {
  const actualVariant = variant ?? "primary";
  const actuallyEnabled = (enabled ?? true) && !loading;
  const tooltipText = tooltip ?? text?.trim();

  const iconElement = loading ? (
    <div className="spinner-border spinner-border-sm" role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
  ) : (
    <i className={"fa fa-" + icon}></i>
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
        {text && <span>{text}</span>}
        {!iconLeft && icon && text && " "}
        {!iconLeft && icon && iconElement}
      </>
    </button>
  );
}
