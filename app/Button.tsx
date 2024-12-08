export default function Button({
  onClick,
  enabled,
  variant,
  icon,
  iconLeft,
  tooltip,
  text
}: {
  onClick: () => void;
  enabled: boolean;
  variant: string;
  icon?: string;
  iconLeft?: boolean;
  tooltip?: string;
  text?: string;
}) {
  return (
    <button
      type="button"
      className={"btn px-3 btn-" + variant + (enabled ? "" : " disabled")}
      data-bs-toggle="tooltip"
      data-bs-placement="top"
      disabled={!enabled}
      tabIndex={-1}
      title={tooltip}
      onClick={onClick}
    >
      {iconLeft && icon && <i className={"fas fa-" + icon}></i>}
      {text && <span>{text}</span>}
      {!iconLeft && icon && <i className={"fas fa-" + icon}></i>}
    </button>
  )
}
