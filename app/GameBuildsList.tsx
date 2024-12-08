import { Stack } from "react-bootstrap";
import Button from "./Button";

import { VersionEntry } from "./types";

const BYTES_PER_GB = 1024 * 1024 * 1024;

const formatBytesToGB = (bytes?: number) => {
  if (bytes == undefined) {
    return undefined;
  }
  return (bytes / BYTES_PER_GB).toFixed(2);
}

export default function GameBuildsList({
  versions,
  clearGameCache,
  downloadOfflineCache,
  repairOfflineCache,
  deleteOfflineCache,
}: {
  versions?: VersionEntry[];
  clearGameCache: (uuid: string) => void;
  downloadOfflineCache: (uuid: string) => void;
  repairOfflineCache: (uuid: string) => void;
  deleteOfflineCache: (uuid: string) => void;
}) {
  return (
    <div className="table-responsive mb-10">
      <table className="table table-striped table-hover">
        <thead>
          <tr>
            <th>Version</th>
            <th className="text-center">Game Cache</th>
            <th className="text-center">Offline Cache</th>
          </tr>
        </thead>
        <tbody>
          {!versions ? (
            <tr>
              <td colSpan={3} className="text-center">
                <span
                  className="spinner-border spinner-border-sm m-2"
                  role="status"
                  aria-hidden="true"
                ></span>
              </td>
            </tr>
          ) : versions.length == 0 ? (
            <tr>
              <td colSpan={3}>No versions available</td>
            </tr>
          ) : (
            versions.map((version) => (
              <tr key={version.uuid}>
                <td className="font-monospace align-middle">
                  {version.name ?? version.uuid}
                  {version.description && (
                  <>
                    {" "}
                    <i
                      className="fas fa-circle-info"
                      data-bs-toggle="tooltip"
                      data-bs-placement="top"
                      title={version.description}
                    ></i>
                  </>
                  )}
                </td>
                <td className="text-center">
                  <p>-- / {formatBytesToGB(version.total_uncompressed_size) ?? "?.??"} GB</p>
                  <Button
                    enabled={false}
                    icon="trash"
                    onClick={() => clearGameCache(version.uuid)}
                    variant="danger"
                    tooltip="Clear game cache"
                  />
                </td>
                <td className="text-center">
                  <p>-- / {formatBytesToGB(version.total_compressed_size) ?? "?.??"} GB</p>
                  <Button
                    enabled={true}
                    icon="download"
                    onClick={() => downloadOfflineCache(version.uuid)}
                    variant="success"
                    tooltip="Download offline cache"
                  />
                  {" "}
                  <Button
                    enabled={false}
                    icon="screwdriver-wrench"
                    onClick={() => repairOfflineCache(version.uuid)}
                    variant="warning"
                    tooltip="Repair offline cache"
                  />
                  {" "}
                  <Button
                    enabled={false}
                    icon="trash"
                    onClick={() => deleteOfflineCache(version.uuid)}
                    variant="danger"
                    tooltip="Delete offline cache"
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
