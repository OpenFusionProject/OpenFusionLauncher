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
  variant: string;
  icon?: string;
  iconLeft?: boolean;
  tooltip?: string;
  text?: string;
  loading?: boolean;
  className?: string;
}) {
  const actuallyEnabled = (enabled ?? true) && !loading;
  const tooltipText = tooltip ?? text?.trim(); 
  return (
    <button
      type="button"
      className={(className ? (className + " ") : "") + "btn px-3 btn-" + variant + (actuallyEnabled ? "" : " disabled")}
      data-bs-toggle="tooltip"
      data-bs-placement="top"
      disabled={!actuallyEnabled}
      tabIndex={-1}
      title={tooltipText}
      onClick={onClick}
    >
      {loading ? (
        <div className="spinner-border spinner-border-sm" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      ) : (
        <>
          {iconLeft && icon && <i className={"fa fa-" + icon}></i>}
          {iconLeft && icon && text && " "}
          {text && <span>{text}</span>}
          {!iconLeft && icon && text && " "}
          {!iconLeft && icon && <i className={"fa fa-" + icon}></i>}
        </>
      )}
    </button>
  )
}
