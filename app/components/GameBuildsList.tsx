import { Stack } from "react-bootstrap";
import Button from "./Button";

import { VersionCacheData, VersionEntry } from "@/app/types";

const BYTES_PER_GB = 1024 * 1024 * 1024;

const formatBytesToGB = (bytes?: number) => {
  if (bytes == undefined) {
    return undefined;
  }
  return (bytes / BYTES_PER_GB).toFixed(2);
};

const getVersionData = (
  version: VersionEntry,
  versionData: Record<string, VersionCacheData>
) => {
  return versionData[version.uuid];
};

const isDoneValidatingOffline = (
  version: VersionEntry,
  versionData: Record<string, VersionCacheData>
) => {
  return getVersionData(version, versionData)?.offlineDone ?? false;
};

const isDoneValidatingGame = (
  version: VersionEntry,
  versionData: Record<string, VersionCacheData>
) => {
  return getVersionData(version, versionData)?.gameDone ?? false;
};

const getValidatedOfflineSize = (
  version: VersionEntry,
  versionData: Record<string, VersionCacheData>
) => {
  const data = getVersionData(version, versionData);
  if (!data) {
    return undefined;
  }
  return data.offlineSize;
};

const getValidatedGameSize = (
  version: VersionEntry,
  versionData: Record<string, VersionCacheData>
) => {
  const data = getVersionData(version, versionData);
  if (!data) {
    return undefined;
  }
  return data.gameSize;
};

const getTotalOfflineSize = (version: VersionEntry) => {
  if (!version.total_compressed_size || !version.main_file_info) {
    return undefined;
  }
  return version.total_compressed_size + version.main_file_info.size;
};

export default function GameBuildsList({
  versions,
  versionData,
  clearGameCache,
  downloadOfflineCache,
  repairOfflineCache,
  deleteOfflineCache,
}: {
  versions?: VersionEntry[];
  versionData: Record<string, VersionCacheData>;
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
            versions.map(
              (version) =>
                !version.hidden && (
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
                        {formatBytesToGB(
                          getValidatedGameSize(version, versionData)
                        ) ?? "--"}{" "}
                        /{" "}
                        {formatBytesToGB(version.total_uncompressed_size) ??
                          "?.??"}{" "}
                        GB
                      </p>
                      <Button
                        loading={!isDoneValidatingGame(version, versionData)}
                        enabled={!!getValidatedGameSize(version, versionData)}
                        icon="trash"
                        onClick={() => clearGameCache(version.uuid)}
                        variant="danger"
                        tooltip="Clear game cache"
                      />
                    </td>
                    <td className="text-center">
                      <p>
                        {formatBytesToGB(
                          getValidatedOfflineSize(version, versionData)
                        ) ?? "--"}{" "}
                        /{" "}
                        {formatBytesToGB(getTotalOfflineSize(version)) ??
                          "?.??"}{" "}
                        GB
                      </p>
                      <Button
                        loading={!isDoneValidatingOffline(version, versionData)}
                        enabled={
                          !getValidatedOfflineSize(version, versionData) &&
                          !!version.main_file_info &&
                          !!version.total_compressed_size
                        }
                        icon="download"
                        onClick={() => downloadOfflineCache(version.uuid)}
                        variant="success"
                        tooltip="Download offline cache"
                      />{" "}
                      <Button
                        loading={!isDoneValidatingOffline(version, versionData)}
                        enabled={
                          !!getValidatedOfflineSize(version, versionData) &&
                          getVersionData(version, versionData)?.offlineCorrupted
                        }
                        icon="screwdriver-wrench"
                        onClick={() => repairOfflineCache(version.uuid)}
                        variant="warning"
                        tooltip="Repair offline cache"
                      />{" "}
                      <Button
                        loading={!isDoneValidatingOffline(version, versionData)}
                        enabled={
                          !!getValidatedOfflineSize(version, versionData)
                        }
                        icon="trash"
                        onClick={() => deleteOfflineCache(version.uuid)}
                        variant="danger"
                        tooltip="Delete offline cache"
                      />
                    </td>
                  </tr>
                )
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
