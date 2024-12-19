import _Toast from "react-bootstrap/Toast";
import { useState } from "react";
import { Alert } from "@/app/types";
import { variantToLabel } from "@/app/util";

export default function Toast({ alert }: { alert: Alert }) {
  const [show, setShow] = useState(true);

  return (
    <_Toast
      bg={alert.variant}
      className={"shadow-none border border-" + alert.variant}
      show={show}
      delay={5000}
      autohide={alert.variant == "success"}
      onClose={() => setShow(false)}
    >
      <_Toast.Header>
        <strong className="me-auto">{variantToLabel(alert.variant)}</strong>
      </_Toast.Header>
      <_Toast.Body className={"rounded-bottom btn-" + alert.variant}>
        {alert.text}
      </_Toast.Body>
    </_Toast>
  );
}
