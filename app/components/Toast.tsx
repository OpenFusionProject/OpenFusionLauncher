import _Toast from "react-bootstrap/Toast";
import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Alert } from "@/app/types";
import { getHostnameFromLink, variantToLabel } from "@/app/util";
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
      <_Toast.Body className={"rounded-bottom glow " + alert.variant}>
        <span style={{ whiteSpace: "pre-line" }}>{alert.text}</span>
        {alert.link && (
          <Button
            className="d-block w-100 mt-2"
            onClick={() => openUrl(alert.link!)}
            variant="success"
            icon="arrow-up-right-from-square"
            text={getHostnameFromLink(alert.link)}
            tooltip={alert.link}
          />
        )}
        {alert.action && (
          <Button
            className="d-block w-100 mt-2"
            onClick={alert.action.onClick}
            variant="success"
            icon={alert.action.icon}
            text={alert.action.text}
          />
        )}
      </_Toast.Body>
    </_Toast>
  );
}
