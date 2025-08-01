import _Toast from "react-bootstrap/Toast";
import { useState } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { Alert } from "@/app/types";
import { getHostnameFromLink, variantToLabel } from "@/app/util";
import { useT } from "@/app/i18n";
import Button from "./Button";

export default function Toast({ alert }: { alert: Alert }) {
  const [show, setShow] = useState(true);
  const t = useT();

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
        <strong className="me-auto">{variantToLabel(alert.variant, t)}</strong>
      </_Toast.Header>
      <_Toast.Body className={"rounded-bottom btn-" + alert.variant}>
        {alert.text}
        {alert.link && (
          <Button
            className="d-block w-100 mt-2"
            onClick={() => open(alert.link!)}
            variant="success"
            icon="arrow-up-right-from-square"
            text={getHostnameFromLink(alert.link)}
            tooltip={alert.link}
          />
        )}
      </_Toast.Body>
    </_Toast>
  );
}
