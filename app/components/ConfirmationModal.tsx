import { useMemo } from "react";
import { Modal } from "react-bootstrap";
import Button from "./Button";
import { parse } from "marked";
import DOMPurify from "dompurify";

export default function ConfirmationModal({
  show,
  setShow,
  title,
  message,
  confirmText,
  confirmVariant,
  onConfirm,
}: {
  show: boolean;
    setShow: (show: boolean) => void;
  title: string;
  message: string;
  confirmText: string;
  confirmVariant: string;
  onConfirm: () => void;
}) {
  const html = useMemo(() => {
    return DOMPurify.sanitize(parse(message) as string);
  }, [message]);

  return (
    <Modal show={show} onHide={() => setShow(false)} centered>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          onClick={() => setShow(false)}
          text="Cancel"
        />
        <Button
          variant={confirmVariant}
          onClick={onConfirm}
          text={confirmText}
        />
      </Modal.Footer>
    </Modal>
  );
}
