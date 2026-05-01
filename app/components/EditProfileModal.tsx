import { useState, useEffect } from "react";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";

import Button from "./Button";

import { LaunchProfile } from "@/app/types";

const DEFAULT_NAME = "New Profile";
const DEFAULT_COMMAND = "{}";

export default function EditProfileModal({
  profile,
  isAdd,
  show,
  setShow,
  saveProfile,
}: {
  profile?: LaunchProfile;
  isAdd: boolean;
  show: boolean;
  setShow: (newShow: boolean) => void;
  saveProfile: (name: string, command: string, uuid?: string) => void;
  deleteProfile?: (uuid: string) => void;
}) {
  const doHide = () => {
    setShow(false);
  };

  const [name, setName] = useState<string>("");
  const [command, setCommand] = useState<string>("");

  useEffect(() => {
    setName(isAdd ? "" : profile?.name || "");
    setCommand(isAdd ? "" : profile?.command || "");
  }, [profile, isAdd, show]);

  const isValid = () => {
    const nameTrimmed = name.trim();
    const commandTrimmed = command.trim();
    if (nameTrimmed === "") {
      return false;
    }
    if (commandTrimmed === "" || !commandTrimmed.includes("{}")) {
      return false;
    }
    return true;
  };

  const isPreset = !isAdd && (profile !== undefined) && profile!.preset;

  return (
    <Modal show={show} onHide={() => doHide()} centered={true} size="lg">
      <Modal.Header>
        <Modal.Title>
          {isAdd ? "Add Launch Profile" : "Edit Launch Profile"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group className="mb-3" controlId="editProfileName">
            <Form.Label>Profile Name</Form.Label>
            <Form.Control
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={DEFAULT_NAME}
            />
          </Form.Group>
          <Form.Group className="mb-3" controlId="editProfileCommand">
            <Form.Label>Launch Command</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder={DEFAULT_COMMAND}
              isInvalid={command.trim() !== "" && !command.includes("{}")}
              readOnly={isPreset}
              disabled={isPreset}
            />
            <Form.Text className="text-muted">
              Use <code>{"{}"}</code> as a placeholder for the game executable.
            </Form.Text>
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={() => doHide()} variant="primary" text="Cancel" />
        {!isAdd && <Button icon="copy" text="Duplicate" onClick={() => {
          const profileToDuplicate = profile!;
          saveProfile(profileToDuplicate.name + " (copy)", profileToDuplicate.command);
          doHide();
        }} />}
        {
          !isPreset && <Button
            onClick={() => {
              const nameTrimmed = name.trim();
              const commandTrimmed = command.trim();
              saveProfile(nameTrimmed, commandTrimmed, profile?.uuid);
              doHide();
            }}
            variant="success"
            text={isAdd ? "Add Profile" : "Save Profile"}
            enabled={isValid()}
          />
        }
      </Modal.Footer>
    </Modal>
  );
}
