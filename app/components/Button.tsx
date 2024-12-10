export default function Button({
  onClick,
  enabled,
  variant,
  icon,
  iconLeft,
  tooltip,
  text,
  loading
}: {
  onClick: () => void;
  enabled?: boolean;
  variant: string;
  icon?: string;
  iconLeft?: boolean;
  tooltip?: string;
  text?: string;
  loading?: boolean;
}) {
  const actuallyEnabled = (enabled ?? true) && !loading;
  return (
    <button
      type="button"
      className={"btn px-3 btn-" + variant + (actuallyEnabled ? "" : " disabled")}
      data-bs-toggle="tooltip"
      data-bs-placement="top"
      disabled={!actuallyEnabled}
      tabIndex={-1}
      title={tooltip}
      onClick={onClick}
    >
      {loading ? (
        <div className="spinner-border spinner-border-sm" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      ) : (
        <>
          {iconLeft && icon && <i className={"fas fa-" + icon}></i>}
          {text && <span>{text}</span>}
          {!iconLeft && icon && <i className={"fas fa-" + icon}></i>}
        </>
      )}
    </button>
  )
}
