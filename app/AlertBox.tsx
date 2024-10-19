import Alert from "react-bootstrap/Alert";

function variantToLabel(variant: string) {
  switch (variant) {
    case "success":
      return "Success";
    case "danger":
      return "Error";
    case "warning":
      return "Warning";
    case "primary":
      return "Info";
    default:
      return "";
  }
}

export default function AlertBox({
  variant,
  text,
}: {
  variant: string;
  text: string;
}) {
  return (
    <Alert
      variant={variant}
      className={"mb-2 border border-" + variant + " btn-" + variant}
      dismissible={false}
    >
      <span>
        <strong>{variantToLabel(variant)}:</strong> {text}
      </span>
      <button
        type="button"
        className="btn shadow-none float-right fas fa-times"
      ></button>
    </Alert>
  );
}
