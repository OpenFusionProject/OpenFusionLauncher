import _Toast from "react-bootstrap/Toast";
import { useState } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { Alert } from "@/app/types";
import { variantToLabel } from "@/app/util";
import Button from "./Button";

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
        {alert.link && (
          <Button
            className="d-block w-100 mt-2"
            onClick={() => open(alert.link!)}
            variant="success"
            icon="arrow-up-right-from-square"
            text="Open on GitHub"
          />
        )}
      </_Toast.Body>
    </_Toast>
  );
}
