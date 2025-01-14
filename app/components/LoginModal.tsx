import { useState, useEffect } from "react";

import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Tabs from "react-bootstrap/Tabs";
import Tab from "react-bootstrap/Tab";

import Button from "./Button";

import { EndpointInfo, ServerEntry } from "@/app/types";
import { Overlay, Tooltip } from "react-bootstrap";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import { parse } from "marked";
import DOMPurify  from "dompurify";
import get_seed from "../seed";

const TAB_LOGIN = "login";
const TAB_REGISTER = "register";

const CONTROL_ID_USERNAME = "username";
const CONTROL_ID_PASSWORD = "password";
const CONTROL_ID_NEW_USERNAME = "newUsername";
const CONTROL_ID_NEW_PASSWORD = "newPassword";
const CONTROL_ID_CONFIRM_PASSWORD = "confirmPassword";
const CONTROL_ID_EMAIL = "email";

const getPrivacyPolicyUrl = (server: ServerEntry) => {
  return "http://" + server.endpoint + "/privacy";
};

const getUpsellImage = (server?: ServerEntry) => {
  if (server?.endpoint) {
    // HACK: add the counter to the url as a parameter to prevent caching across launches
    return (
      "http://" + server.endpoint + "/upsell/sponsor.png?seed=" + get_seed()
    );
  }
  return undefined;
};

const checkEmailRequired = async (server: ServerEntry) => {
  if (!server.endpoint) return false;
  const info: EndpointInfo = await invoke("get_info_for_server", {
    uuid: server.uuid,
  });
  return info.email_required ?? false;
};

const validateUsername = (username: string) => {
  // From OpenFusion:
  // Login has to be 4 - 32 characters long and can't contain
  // special characters other than dash and underscore
  const regex = /^[a-zA-Z0-9_-]{4,32}$/;
  return regex.test(username);
};

const validatePassword = (password: string) => {
  // From OpenFusion:
  // Password has to be 8 - 32 characters long
  const regex = /^.{8,32}$/;
  return regex.test(password);
};

const validateEmail = (email: string, required: boolean) => {
  if (!required && email.length === 0) return true;

  // normal email regex
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
};

function AnnouncementsPanel({ server }: { server?: ServerEntry }) {
  const ERROR_TEXT = "This server has no announcements.";

  const [showUpsell, setShowUpsell] = useState<boolean>(false);
  const [showAnnouncements, setShowAnnouncements] = useState<boolean>(false);
  const [announcements, setAnnouncements] = useState<string>("");
  const [error, setError] = useState<boolean>(false);

  const show = showUpsell || showAnnouncements;

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const announcements: string = await invoke(
          "get_announcements_for_server",
          {
            uuid: server!.uuid,
          },
        );
        setError(false);
        const parsed: string = await parse(announcements);
        setAnnouncements(parsed);
        setShowAnnouncements(true);
      } catch (e) {
        console.warn(e);
        setError(true);
      }
    };

    setShowUpsell(false);
    setShowAnnouncements(false);
    setAnnouncements("");
    setError(false);
    if (server) {
      fetchAnnouncements();
    }
  }, [server]);

  return (
    <div className={"server-landing " + (!show ? "d-none" : "")}>
      <img
        src={getUpsellImage(server)}
        className={!showUpsell ? "d-none" : ""}
        onLoad={() => setShowUpsell(true)}
        alt="Upsell"
      />
      <div className="announcements">
        {error ? ERROR_TEXT : <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(announcements) }} />}
      </div>
    </div>
  );
}

function RequirementsTooltip({
  focusedControlId,
  controlId,
  children,
}: {
  focusedControlId: string | null;
  controlId: string;
  children: React.ReactNode;
}) {
  const target = document.getElementById(controlId);
  const show = !!(focusedControlId && focusedControlId === controlId);
  return (
    <Overlay target={target} show={show} placement="right">
      <Tooltip id={controlId + "Tooltip"}>{children}</Tooltip>
    </Overlay>
  );
}

export default function LoginModal({
  server,
  show,
  onClose,
  onSubmitLogin,
  onSubmitRegister,
}: {
  server?: ServerEntry;
  show: boolean;
  onClose: () => void;
  onSubmitLogin: (username: string, password: string) => void;
  onSubmitRegister: (username: string, password: string, email: string) => void;
}) {
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  // I could not get this to work any other way; improvements welcome
  const [activeControl, setActiveControl] = useState<string | null>(null);

  const [tab, setTab] = useState<string>(TAB_LOGIN);

  const [emailRequired, setEmailRequired] = useState<boolean>(false);

  const validateLogin = () => {
    return username.length > 0 && password.length > 0;
  };

  const validateRegister = () => {
    return (
      validateUsername(username) &&
      validatePassword(password) &&
      password === confirmPassword &&
      validateEmail(email, emailRequired)
    );
  };

  const clear = () => {
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setEmail("");
  };

  useEffect(() => {
    clear();
    if (server) {
      checkEmailRequired(server).then(setEmailRequired);
    }
  }, [server]);

  const canSubmit = (tab: string) => {
    return tab === TAB_LOGIN ? validateLogin() : validateRegister();
  };

  const submitForm = () => {
    if (!canSubmit(tab)) return;
    onClose();
    if (tab === TAB_LOGIN) {
      onSubmitLogin(username, password);
    } else if (tab === TAB_REGISTER) {
      onSubmitRegister(username, password, email);
    }
  };

  return (
    <Modal show={show && !!server} onHide={onClose} centered={true} size="lg">
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          submitForm();
        }}
      >
        <Modal.Header>
          <Modal.Title>{server?.description}</Modal.Title>
        </Modal.Header>
        <AnnouncementsPanel server={server} />
        <Modal.Body className="p-0">
          <Tabs
            activeKey={tab}
            onSelect={(k) => setTab(k ?? TAB_LOGIN)}
            className="mb-3"
            fill
          >
            <Tab eventKey={TAB_LOGIN} title="Log In" className="p-3">
              <Form.Group className="mb-3" controlId={CONTROL_ID_USERNAME}>
                <Form.Control
                  type="text"
                  placeholder="Username"
                  value={username}
                  onFocus={() => setActiveControl(CONTROL_ID_USERNAME)}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </Form.Group>
              <Form.Group className="mb-3" controlId={CONTROL_ID_PASSWORD}>
                <Form.Control
                  type="password"
                  placeholder="Password"
                  value={password}
                  onFocus={() => setActiveControl(CONTROL_ID_PASSWORD)}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Form.Group>
            </Tab>
            <Tab eventKey={TAB_REGISTER} title="Register" className="p-3">
              <Form.Group className="mb-3" controlId={CONTROL_ID_NEW_USERNAME}>
                <Form.Control
                  type="text"
                  placeholder="Username"
                  value={username}
                  onFocus={() => setActiveControl(CONTROL_ID_NEW_USERNAME)}
                  onChange={(e) => setUsername(e.target.value)}
                  isInvalid={username.length > 0 && !validateUsername(username)}
                />
              </Form.Group>
              <Form.Group className="mb-3" controlId={CONTROL_ID_NEW_PASSWORD}>
                <Form.Control
                  type="password"
                  placeholder="Password"
                  value={password}
                  onFocus={() => setActiveControl(CONTROL_ID_NEW_PASSWORD)}
                  onChange={(e) => setPassword(e.target.value)}
                  isInvalid={password.length > 0 && !validatePassword(password)}
                />
              </Form.Group>
              <Form.Group
                className="mb-3"
                controlId={CONTROL_ID_CONFIRM_PASSWORD}
              >
                <Form.Control
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onFocus={() => setActiveControl(CONTROL_ID_CONFIRM_PASSWORD)}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  isInvalid={password !== confirmPassword}
                />
              </Form.Group>
              <Form.Group className="mb-3" controlId={CONTROL_ID_EMAIL}>
                <Form.Control
                  type="text"
                  placeholder={"Email" + (emailRequired ? "" : " (optional)")}
                  value={email}
                  onFocus={() => setActiveControl(CONTROL_ID_EMAIL)}
                  onChange={(e) => setEmail(e.target.value)}
                  isInvalid={
                    email.length > 0 && !validateEmail(email, emailRequired)
                  }
                />
              </Form.Group>
              <div className="text-center">
                <span>
                  View this server{"'s "}
                  <span
                    role="button"
                    className="text-decoration-underline"
                    onClick={() => {
                      const url = getPrivacyPolicyUrl(server!);
                      open(url);
                    }}
                  >
                    privacy policy
                  </span>
                </span>
              </div>
              <RequirementsTooltip
                focusedControlId={activeControl}
                controlId={CONTROL_ID_NEW_USERNAME}
              >
                <div className="text-start lh-small">
                  • 4 - 32 characters long
                  <br />• No special characters besides - and _
                </div>
              </RequirementsTooltip>
              <RequirementsTooltip
                focusedControlId={activeControl}
                controlId={CONTROL_ID_NEW_PASSWORD}
              >
                <div className="text-start lh-small">
                  • 8 - 32 characters long
                </div>
              </RequirementsTooltip>
            </Tab>
          </Tabs>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={onClose} variant="primary" text="Cancel" />
          <Button
            onClick={submitForm}
            variant="success"
            text={tab === TAB_LOGIN ? "Log In" : "Register"}
            enabled={canSubmit(tab)}
          />
          {/* Hidden submit button */}
          <button type="submit" style={{ display: "none" }} />
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
