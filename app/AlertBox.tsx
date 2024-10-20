import { useState, useEffect, use } from "react";
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
  timeout
}: {
  variant: string;
  text: string;
  timeout?: number;
}) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (timeout) {
      const timer = setTimeout(() => {
        setShow(false);
      }, timeout);
      return () => clearTimeout(timer);
    }
  }, []);

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
