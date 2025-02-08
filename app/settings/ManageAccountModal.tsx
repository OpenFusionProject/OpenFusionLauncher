import { Form, Modal } from "react-bootstrap";
import { Tabs, Tab } from "react-bootstrap";
import Button from "@/components/Button";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AccountInfo, LoginSession, ServerEntry } from "@/app/types";
import { getPrivacyPolicyUrlForServer, validateEmail, validatePassword } from "@/app/util";

const TAB_UPDATE_EMAIL = "update_email";
const TAB_UPDATE_PASSWORD = "update_password";

const TAB_DEFAULT = TAB_UPDATE_EMAIL;

export default function ManageAccountModal({
  show,
  setShow,
  server,
  session,
  onUpdateEmail,
  onUpdatePassword,
}: {
  show: boolean;
  setShow: (show: boolean) => void;
  server?: ServerEntry;
  session?: LoginSession
  onUpdateEmail: (newEmail: string) => Promise<void>;
  onUpdatePassword: (newPassword: string) => Promise<void>;
}) {
  const [tab, setTab] = useState(TAB_DEFAULT);
  const [accountInfo, setAccountInfo] = useState<AccountInfo | undefined | null>(undefined);

  // Update email tab
  const [newEmail, setNewEmail] = useState<string>("");
  const [newEmailConfirm, setNewEmailConfirm] = useState<string>("");
  const validateNewEmail = () => {
    return validateEmail(newEmail, false) && newEmail == newEmailConfirm;
  };

  // Update password tab
  const [newPassword, setNewPassword] = useState<string>("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState<string>("");
  const validateNewPassword = () => {
    return validatePassword(newPassword) && newPassword == newPasswordConfirm;
  };

  useEffect(() => {
    const fetch = async () => {
      try {
        const accountInfo: AccountInfo = await invoke("get_account_info", {
          serverUuid: server!.uuid,
          sessionToken: session!.session_token,
        });
        setAccountInfo(accountInfo);
      } catch (e) {
        setAccountInfo(null);
      }
    };

    if (show) {
      setAccountInfo(undefined);
      setTab(TAB_DEFAULT);
      setNewEmail("");
      setNewEmailConfirm("");
      setNewPassword("");
      setNewPasswordConfirm("");
    }

    if (server && session) {
      fetch();
    }
  }, [show]);

  return (
    <Modal show={show} onHide={() => setShow(false)} centered>
      <Modal.Header closeButton>
        <Modal.Title>Manage Account</Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-0">
        {accountInfo === undefined ? (
          <div className="p-3 text-center">
            <span
              className="spinner-border spinner-border-sm"
              role="status"
              aria-hidden="true"
            ></span>
          </div>
        ) : accountInfo === null ? (
          <div className="p-3 text-center">
            <span>Could not load account information</span>
          </div>
        ) : (
          <div className="p-3">
            <span><strong>Username: </strong>{accountInfo.username}</span>
            <br />
            <span><strong>Current email: </strong>{accountInfo.email ?? "(not set)"}</span>
          </div>
        )}
        <Tabs activeKey={tab} onSelect={(k) => setTab(k || TAB_DEFAULT)} fill>
          <Tab eventKey={TAB_UPDATE_EMAIL} title="Change Email">
            <Form className="p-3">
              <Form.Group className="mb-3" controlId="editNewEmail">
                <Form.Control
                  type="text"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="New Email"
                  isInvalid={newEmail.length > 0 && !validateEmail(newEmail, false)}
                />
              </Form.Group>
              <Form.Group controlId="editNewEmailConfirm">
                <Form.Control
                  type="text"
                  value={newEmailConfirm}
                  onChange={(e) => setNewEmailConfirm(e.target.value)}
                  placeholder="Confirm New Email"
                  isInvalid={newEmailConfirm.length > 0 && !validateNewEmail()}
                />
              </Form.Group>
            </Form>
          </Tab>
          <Tab eventKey={TAB_UPDATE_PASSWORD} title="Change Password">
            <Form className="p-3">
              <Form.Group className="mb-3" controlId="editNewPassword">
                <Form.Control
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New Password"
                  isInvalid={newPassword.length > 0 && !validatePassword(newPassword)}
                />
              </Form.Group>
              <Form.Group controlId="editNewPasswordConfirm">
                <Form.Control
                  type="text"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  placeholder="Confirm New Password"
                  isInvalid={newPasswordConfirm.length > 0 && !validateNewPassword()}
                />
              </Form.Group>
            </Form>
          </Tab>
        </Tabs>
        <div className="text-center mb-3">
          <span>
            View this server{"'s "}
            <span
              role="button"
              className="text-decoration-underline"
              onClick={() => {
                const url = getPrivacyPolicyUrlForServer(server!);
                open(url);
              }}
            >
              privacy policy
            </span>
          </span>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          onClick={() => setShow(false)}
          text="Cancel"
        />
        <Button
          variant="success"
          text={tab == TAB_UPDATE_EMAIL ? "Send Verification Email" : "Update Password"}
          enabled={tab == TAB_UPDATE_EMAIL ? validateNewEmail() : validateNewPassword()}
          onClick={() => {
            if (tab == TAB_UPDATE_EMAIL) {
              onUpdateEmail(newEmail);
            } else {
              onUpdatePassword(newPassword);
            }
          }}
        />
      </Modal.Footer>
    </Modal>
  );
}
