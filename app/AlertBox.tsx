import { useState } from "react";
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
  const [show, setShow] = useState(true);
  return (
    show && (
      <Alert
        variant={variant}
        className={"mb-2 pr-0 border border-" + variant + " btn-" + variant}
      >
        <span>
          <strong>{variantToLabel(variant)}:</strong> {text}
        </span>
        <button
          type="button"
          className="btn shadow-none float-right fas fa-times"
          onClick={() => setShow(false)}
        ></button>
      </Alert>
    )
  );
}
