import { ProgressBar, Stack } from "react-bootstrap";
import Button from "./Button";

import { VersionCacheData, VersionCacheProgressItem, VersionEntry } from "@/app/types";
import { get } from "http";

const BYTES_PER_GB = 1024 * 1024 * 1024;

const min = (a: number | undefined, b: number | undefined) => {
  if (a == undefined) {
    return b;
  }
  if (b == undefined) {
    return a;
  }
  return Math.min(a, b);
}

const formatBytesToGB = (bytes?: number) => {
  if (bytes == undefined) {
    return undefined;
  }
  return (bytes / BYTES_PER_GB).toFixed(2);
};

const isCorrupt = (items: Record<string, VersionCacheProgressItem>) => {
  return Object.values(items).some((item) => item.corrupt);
};

const getVariantForProgress = (data: VersionCacheData, item: VersionCacheProgressItem, offline: boolean) => {
  if (item.corrupt) {
    return "warning";
  }

  const done = offline ? data.offlineDone : data.gameDone;
  const items = offline ? data.offlineItems : data.gameItems;
  const corrupt = isCorrupt(items);
  if (done && !corrupt) {
    return "success";
  }
  return "primary";
};

const getValidatedSize = (items: Record<string, VersionCacheProgressItem>) => {
  if (Object.keys(items).length == 0) {
    return undefined;
  }
  return Object.values(items).reduce((acc, item) => acc + item.item_size, 0);
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
                        {formatBytesToGB(min(getValidatedSize(versionData.gameItems), versionData.gameSize)) ?? "--"}
                        {" / "}
                        {formatBytesToGB(version.total_uncompressed_size) ?? "?.??"}
                        {" GB"}
                      </p>
                      <ProgressBar>
                        {Object.entries(versionData.gameItems).map(([itemName, item]) => (
                          <ProgressBar
                            data-bs-toggle="tooltip"
                            data-bs-placement="top"
                            title={itemName}
                            key={itemName}
                            now={item.item_size}
                            max={version.total_uncompressed_size ?? 1}
                            variant={getVariantForProgress(versionData, item, false)}
                            className="contrast-border-hover"
                          />
                        ))}
                      </ProgressBar>
                      <br />
                      <Button
                        loading={!versionData.gameDone}
                        enabled={!!getValidatedSize(versionData.gameItems)}
                        icon="trash"
                        onClick={() => clearGameCache(version.uuid)}
                        variant="danger"
                        tooltip="Clear game cache"
                      />
                    </td>
                    <td className="text-center">
                      <p>
                        {formatBytesToGB(min(getValidatedSize(versionData.offlineItems), versionData.offlineSize)) ?? "--"}
                        {" / "}
                        {formatBytesToGB(getTotalOfflineSize(version)) ?? "?.??"}
                        {" GB"}
                      </p>
                      <ProgressBar>
                        {Object.entries(versionData.offlineItems).map(([itemName, item]) => (
                          <ProgressBar
                            data-bs-toggle="tooltip"
                            data-bs-placement="top"
                            title={itemName}
                            key={itemName}
                            now={item.item_size}
                            max={version.total_compressed_size ?? 1}
                            variant={getVariantForProgress(versionData, item, true)}
                            className="contrast-border-hover"
                          />
                        ))}
                      </ProgressBar>
                      <br />
                      <Button
                        loading={!versionData.offlineDone}
                        enabled={
                          !getValidatedSize(versionData.offlineItems) &&
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
                        enabled={isCorrupt(versionData.offlineItems)}
                        icon="screwdriver-wrench"
                        onClick={() => repairOfflineCache(version.uuid)}
                        variant="warning"
                        tooltip="Repair offline cache"
                      />
                      {" "}
                      <Button
                        loading={!versionData.offlineDone}
                        enabled={!!getValidatedSize(versionData.offlineItems)}
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
