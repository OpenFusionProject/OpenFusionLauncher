export default function Button({
  onClick,
  enabled,
  variant,
  icon,
  text
}: {
  onClick: () => void;
  enabled: boolean;
  variant: string;
  icon: string;
  text?: string;
}) {
  return (
    <button
      type="button"
      className={"btn px-3 btn-" + variant + (enabled ? "" : " disabled")}
      onClick={onClick}
    >
      {text && <span>{text}</span>}
      <i className={"fas fa-" + icon}></i>
    </button>
  )
}
