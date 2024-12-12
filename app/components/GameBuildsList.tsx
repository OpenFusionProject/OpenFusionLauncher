import { ProgressBar, Stack } from "react-bootstrap";
import Button from "./Button";

import { VersionCacheData, VersionEntry } from "@/app/types";

const BYTES_PER_GB = 1024 * 1024 * 1024;

const formatBytesToGB = (bytes?: number) => {
  if (bytes == undefined) {
    return undefined;
  }
  return (bytes / BYTES_PER_GB).toFixed(2);
};

const getVariantForStatus = (status: VersionCacheData, offline: boolean) => {
  const exists = offline ? !!status.offlineSize : !!status.gameSize;
  const corrupted = offline ? status.offlineCorrupted : status.gameCorrupted;
  const done = offline ? status.offlineDone : status.gameDone;
  if (!exists) {
    return "danger";
  }
  if (corrupted) {
    return "warning";
  }
  if (done) {
    return "success";
  }
  return "primary";
}

const getTotalOfflineSize = (version: VersionEntry) => {
  if (!version.total_compressed_size || !version.main_file_info) {
    return undefined;
  }
  return version.total_compressed_size + version.main_file_info.size;
};

export default function GameBuildsList({
  versionData,
  clearGameCache,
  downloadOfflineCache,
  repairOfflineCache,
  deleteOfflineCache,
}: {
  versionData?: VersionCacheData[];
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
          {!versionData ? (
            <tr>
              <td colSpan={3} className="text-center">
                <span
                  className="spinner-border spinner-border-sm m-2"
                  role="status"
                  aria-hidden="true"
                ></span>
              </td>
            </tr>
          ) : versionData.length == 0 ? (
            <tr>
              <td colSpan={3}>No builds available</td>
            </tr>
          ) : (
            versionData.map(
              (versionData) => {
                const version = versionData.version;
                return !version.hidden && (
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
                      <p>
                        {formatBytesToGB(versionData.gameSize) ?? "--"}
                        {" / "}
                        {formatBytesToGB(version.total_uncompressed_size) ?? "?.??"}
                        {" GB"}
                      </p>
                      <ProgressBar
                        max={version.total_uncompressed_size ?? 1}
                        now={versionData.gameSizeValidated ?? 0}
                        animated={!versionData.gameDone}
                        variant={getVariantForStatus(versionData, false)}
                      />
                      <br />
                      <Button
                        loading={!versionData.gameDone}
                        enabled={!!versionData.gameSize}
                        icon="trash"
                        onClick={() => clearGameCache(version.uuid)}
                        variant="danger"
                        tooltip="Clear game cache"
                      />
                    </td>
                    <td className="text-center">
                      <p>
                        {formatBytesToGB(versionData.offlineSize) ?? "--"}
                        {" / "}
                        {formatBytesToGB(getTotalOfflineSize(version)) ?? "?.??"}
                        {" GB"}
                      </p>
                      <ProgressBar
                        max={getTotalOfflineSize(version) ?? 1}
                        now={versionData.offlineSizeValidated ?? 0}
                        animated={!versionData.offlineDone}
                        variant={getVariantForStatus(versionData, true)}
                      />
                      <br />
                      <Button
                        loading={!versionData.offlineDone}
                        enabled={
                          !versionData.offlineSize &&
                          !!version.main_file_info &&
                          !!version.total_compressed_size
                        }
                        icon="download"
                        onClick={() => downloadOfflineCache(version.uuid)}
                        variant="success"
                        tooltip="Download offline cache"
                      />
                      {" "}
                      <Button
                        loading={!versionData.offlineDone}
                        enabled={versionData.offlineCorrupted}
                        icon="screwdriver-wrench"
                        onClick={() => repairOfflineCache(version.uuid)}
                        variant="warning"
                        tooltip="Repair offline cache"
                      />
                      {" "}
                      <Button
                        loading={!versionData.offlineDone}
                        enabled={!!versionData.offlineSize}
                        icon="trash"
                        onClick={() => deleteOfflineCache(version.uuid)}
                        variant="danger"
                        tooltip="Delete offline cache"
                      />
                    </td>
                  </tr>
                );
              }
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
