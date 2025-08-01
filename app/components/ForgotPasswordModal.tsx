import { Form, Modal } from "react-bootstrap";
import Button from "@/components/Button";
import { useState, useEffect } from "react";
import { ServerEntry } from "@/app/types";
import { validateEmail } from "@/app/util";
import { useT } from "@/app/i18n";

export default function ForgotPasswordModal({
  show,
  setShow,
  server,
  onSubmit,
}: {
  show: boolean;
  setShow: (show: boolean) => void;
  server?: ServerEntry,
  onSubmit: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const t = useT();

  useEffect(() => {
    setEmail("");
  }, [server]);

  const onHitSubmit = async () => {
    if (server) {
      setLoading(true);
      await onSubmit(email);
      setLoading(false);
    }
  }

  return (
    <Modal show={show} onHide={() => setShow(false)} centered>
      <Modal.Header closeButton>
        <Modal.Title>{t("Forgot Password")}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-0">
        <p className="px-3 pt-3 mb-0">
          {t(
            "Enter the email address associated with your account below to receive a one-time password that can be used to log in."
          )}
        </p>
        <Form className="p-3">
          <Form.Group controlId="editEmail">
            <Form.Control
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("Email")}
              isInvalid={
                email.length > 0 && !validateEmail(email, false)
              }
            />
          </Form.Group>
        </Form>
        <p className="px-3">
          {t(
            "Once you have logged in, you can change your password in Settings -> Authentication -> Manage Account -> Change Password."
          )}
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          onClick={() => setShow(false)}
          text="Cancel"
        />
        <Button
          variant="success"
          text={t("Send Temporary Password")}
          loading={loading}
          enabled={validateEmail(email, false)}
          onClick={() => onHitSubmit()}
        />
      </Modal.Footer>
    </Modal>
  );
}
