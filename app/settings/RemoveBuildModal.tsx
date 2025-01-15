import { Modal } from "react-bootstrap";
import Button from "@/components/Button";
import { VersionEntry } from "@/app/types";

export default function RemoveBuildModal({
  show,
  setShow,
  version,
  onConfirm,
}: {
  show: boolean;
  setShow: (show: boolean) => void;
  version?: VersionEntry,
  onConfirm: (uuid: string, deleteCaches: boolean) => void;
}) {

  return (
    <Modal show={show} onHide={() => setShow(false)} centered>
      <Modal.Header closeButton>
        <Modal.Title>Remove Build</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        Are you sure you want to remove build <strong>{version?.name ?? version?.uuid}</strong>?
        It will be automatically fetched again if it is required by a server.
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          onClick={() => setShow(false)}
          text="Cancel"
        />
        <Button
          variant="danger"
          text="Remove and Clear Caches"
          onClick={() => onConfirm(version!.uuid, true)}
        />
        <Button
          variant="success"
          text="Remove"
          onClick={() => onConfirm(version!.uuid, false)}
        />
      </Modal.Footer>
    </Modal>
  );
}
