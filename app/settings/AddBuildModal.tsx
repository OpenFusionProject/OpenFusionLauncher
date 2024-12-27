import { Form, Modal } from "react-bootstrap";
import { Tabs, Tab } from "react-bootstrap";
import Button from "@/components/Button";
import { useEffect, useState } from "react";

const TAB_IMPORT = "import";
const TAB_MANUAL = "manual";

export default function AddBuildModal({
  show,
  setShow,
  onImport,
  onManualAdd,
}: {
  show: boolean;
  setShow: (show: boolean) => void;
  onImport: (manifest: File) => void;
  onManualAdd: (name: string, assetUrl: string) => void;
}) {
  const [tab, setTab] = useState(TAB_IMPORT);

  // Import tab
  const [manifest, setManifest] = useState<File | undefined>(undefined);
  const validateImport = () => {
    return !!manifest;
  };

  // Manual tab
  const [name, setName] = useState<string>("");
  const [assetUrl, setAssetUrl] = useState<string>("");
  const validateManual = () => {
    return assetUrl.trim() != "";
  };

  useEffect(() => {
    if (show) {
      setTab(TAB_IMPORT);
      setManifest(undefined);
      setName("");
      setAssetUrl("");
    }
  }, [show]);

  return (
    <Modal show={show} onHide={() => setShow(false)} centered>
      <Modal.Header closeButton>
        <Modal.Title>Add Build</Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-0">
        <Tabs activeKey={tab} onSelect={(k) => setTab(k || TAB_IMPORT)} fill>
          <Tab eventKey={TAB_IMPORT} title="Import">
            <Form className="p-3">
              <Form.Group className="mb-3" controlId="editManifestPath">
                <Form.Label>Manifest</Form.Label>
                <Form.Control
                  type="file"
                  accept=".json"
                  onChange={(e: any) => {
                    const file = e.target.files[0];
                    setManifest(file);
                  }}
                />
              </Form.Group>
            </Form>
          </Tab>
          <Tab eventKey={TAB_MANUAL} title="Add Manually">
            <Form className="p-3">
              <Form.Group className="mb-3" controlId="editName">
                <Form.Label>Name</Form.Label>
                <Form.Control
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Build"
                />
              </Form.Group>
              <Form.Group className="mb-3" controlId="editAssetUrl">
                <Form.Label>Asset URL</Form.Label>
                <Form.Control
                  type="text"
                  value={assetUrl}
                  onChange={(e) => setAssetUrl(e.target.value)}
                  placeholder="http://cdn.example.com/build"
                />
              </Form.Group>
            </Form>
          </Tab>
        </Tabs>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          onClick={() => setShow(false)}
          text="Cancel"
        />
        <Button
          variant="success"
          text={tab == TAB_MANUAL ? "Add" : "Import"}
          enabled={tab == TAB_MANUAL ? validateManual() : validateImport()}
          onClick={() => {
            if (tab == TAB_MANUAL) {
              onManualAdd(name, assetUrl);
            } else {
              onImport(manifest!);
            }
            setShow(false);
          }}
        />
      </Modal.Footer>
    </Modal>
  );
}
