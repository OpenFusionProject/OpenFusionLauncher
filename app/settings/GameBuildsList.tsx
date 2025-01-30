import { ProgressBar } from "react-bootstrap";
import Button from "../components/Button";

import {
  VersionCacheData,
  VersionCacheProgressItem,
  VersionEntry,
} from "@/app/types";
import { invoke } from "@tauri-apps/api/core";

const BYTES_PER_GB = 1024 * 1024 * 1024;

const DEFAULT_VERSION_UUIDS = [
  "ec8063b2-54d4-4ee1-8d9e-381f5babd420", // beta-20100104
  "793ed605-9a36-490c-95e1-6d1df8d7568b", // beta-20100119
  "3d18aab5-95a5-49cb-8cde-ddcf809ad623", // beta-20100207
  "b3d94727-906d-4d94-ab8b-2360bf15cca1", // beta-20100307
  "908a5fec-5723-4c4a-af51-b268b8904776", // beta-20100322
  "7d79b3d1-1e20-4d25-ba03-f2d4a6cf8cf5", // beta-20100413
  "23bbdbe5-8639-4f13-8dee-1e9ff72102ac", // beta-20100502
  "c5981846-a3e0-4598-a6a4-1b0eaf9dba2c", // beta-20100524
  "83797b94-f137-4637-b376-38c9b6ed70b2", // beta-20100604
  "967240a1-8047-4de3-a070-06276faf58c3", // beta-20100616
  "72a5c13a-bdcf-4b23-acc7-c95d9e9c72bb", // beta-20100711
  "ec1bd459-9f07-4c2e-9073-99cd7d2062be", // beta-20100728
  "86c57a2c-ce46-4429-b5b5-3936fda8e7e9", // beta-20100909
  "2a2be828-bd05-42a6-9b33-b837f2766773", // beta-20101003
  "61b8e04a-4c75-4f41-b0a8-65eb9ba9ca60", // beta-20101011
  "bf5e00c8-29e8-4541-97f6-15ea26509cdd", // beta-20101028
  "f0d3541f-152d-42ef-816f-63272c392a2c", // beta-20101123
  "ff73017d-dea2-4a72-a23d-066944460c67", // beta-20110213
  "1bb7cda3-c463-4856-b8bc-6918fc06f057", // beta-20110314
  "7ce68356-872f-427d-9935-581f24d93bff", // beta-20110330
  "232f6405-9eec-4cbc-a4d7-e1003446474a", // beta-20110424
  "b9d9c8ee-0a73-4d4c-b5e3-fa1d25213870", // beta-20110523
  "f7e6c55c-5dfc-404f-b0d5-14f3a1fa791c", // beta-20110725
  "d1ccb15f-bbfe-4cf7-9c25-84d0a0f759da", // beta-20110818
  "bc988161-b425-4b50-88c6-4c9947cb73ea", // beta-20110912
  "6543a2bb-d154-4087-b9ee-3c8aa778580a", // beta-20111013
];

const formatBytesToGB = (bytes?: number) => {
  if (bytes == undefined) {
    return undefined;
  }
  return (bytes / BYTES_PER_GB).toFixed(2);
};

const isCorrupt = (
  items: Record<string, VersionCacheProgressItem>,
  countMissing?: boolean,
) => {
  return Object.values(items).some(
    (item) => item.corrupt && (!item.missing || countMissing),
  );
};

const getTooltipForItem = (name: string, item: VersionCacheProgressItem) => {
  const status = item.missing ? "Missing: " : item.corrupt ? "Corrupt: " : "";
  return status + name;
};

const getVariantForProgress = (
  data: VersionCacheData,
  item: VersionCacheProgressItem,
  offline: boolean,
) => {
  if (item.missing) {
    return "danger";
  }

  if (item.corrupt) {
    return "warning";
  }

  const done = offline ? data.offlineDone : data.gameDone;
  const items = offline ? data.offlineItems : data.gameItems;
  const corrupt = isCorrupt(items, false);
  if (done && !corrupt) {
    return "success";
  }
  return "primary";
};

const getValidatedSize = (
  items: Record<string, VersionCacheProgressItem>,
  includeMissing?: boolean,
) => {
  if (Object.keys(items).length == 0) {
    return undefined;
  }
  return Object.values(items).reduce(
    (acc, item) => acc + (item.missing && !includeMissing ? 0 : item.item_size),
    0,
  );
};

const getDisplaySize = (data: VersionCacheData, offline: boolean) => {
  const items = offline ? data.offlineItems : data.gameItems;
  return getValidatedSize(items, false);
};

const getTotalOfflineSize = (version: VersionEntry) => {
  if (!version.total_compressed_size || !version.main_file_info) {
    return undefined;
  }
  return version.total_compressed_size + version.main_file_info.size;
};

const getMissingTooltip = (items: Record<string, VersionCacheProgressItem>) => {
  const missingItems = Object.entries(items).filter(
    ([_, item]) => item.missing,
  );
  if (missingItems.length == 0) {
    return undefined;
  }

  let tooltip = "Missing:\n";
  for (const [name, _] of missingItems) {
    tooltip += `${name}\n`;
  }
  return tooltip;
};

export default function GameBuildsList({
  versions,
  versionDataList,
  clearGameCache,
  downloadOfflineCache,
  repairOfflineCache,
  deleteOfflineCache,
  removeVersion,
}: {
  versions?: VersionEntry[];
  versionDataList: VersionCacheData[];
  clearGameCache: (uuid: string) => void;
  downloadOfflineCache: (uuid: string) => void;
  repairOfflineCache: (uuid: string) => void;
  deleteOfflineCache: (uuid: string) => void;
  removeVersion: (uuid: string) => void;
}) {
  return (
    <div className="table-responsive" id="builds-table">
      <table className="table table-striped table-hover mb-0">
        <thead>
          <tr>
            <th>Version</th>
            <th className="text-center cache-col">Game Cache</th>
            <th className="text-center px-5 cache-col">Offline Cache</th>
            <th className="text-end"></th>
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
              <td colSpan={3}>No builds available</td>
            </tr>
          ) : (
            versions.map((version) => {
              const versionData: VersionCacheData = versionDataList.find(
                (vd) => vd.versionUuid == version.uuid,
              ) ?? {
                versionUuid: version.uuid,
                gameDone: false,
                gameItems: {},
                offlineDone: false,
                offlineItems: {},
              };
              return (
                !version.hidden && (
                  <tr key={version.uuid}>
                    <td className="font-monospace align-middle">
                      <h3 className="mb-0">
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
                      </h3>
                      {version.name && <h6 className="mb-0 text-muted">{version.uuid}</h6>}
                    </td>
                    <td className="text-center cache-col px-5">
                      <p>
                        {formatBytesToGB(getDisplaySize(versionData, false)) ??
                          "--"}
                        {" / "}
                        {formatBytesToGB(version.total_uncompressed_size) ??
                          "?.??"}
                        {" GB"}
                      </p>
                      <ProgressBar
                        data-bs-toggle="tooltip"
                        data-bs-placement="top"
                        title={getMissingTooltip(versionData.gameItems)}
                      >
                        {Object.entries(versionData.gameItems).map(
                          ([itemName, item]) =>
                            !item.missing && (
                              <ProgressBar
                                data-bs-toggle="tooltip"
                                data-bs-placement="top"
                                title={getTooltipForItem(itemName, item)}
                                key={itemName}
                                now={item.item_size}
                                max={version.total_uncompressed_size ?? 1}
                                variant={getVariantForProgress(
                                  versionData,
                                  item,
                                  false,
                                )}
                                className="contrast-border-hover"
                              />
                            ),
                        )}
                      </ProgressBar>
                      <br />
                      <Button
                        enabled={Object.keys(versionData.gameItems).length > 0}
                        icon="folder"
                        onClick={() => invoke("open_folder_for_version", { uuid: version.uuid, offline: false })}
                        tooltip="Open game cache folder"
                      />{" "}
                      <Button
                        loading={!versionData.gameDone}
                        enabled={!!getValidatedSize(versionData.gameItems)}
                        icon="trash"
                        onClick={() => clearGameCache(version.uuid)}
                        variant="danger"
                        tooltip="Clear game cache"
                      />
                    </td>
                    <td className="text-center cache-col">
                      <p>
                        {formatBytesToGB(getDisplaySize(versionData, true)) ??
                          "--"}
                        {" / "}
                        {formatBytesToGB(getTotalOfflineSize(version)) ??
                          "?.??"}
                        {" GB"}
                      </p>
                      <ProgressBar>
                        {Object.entries(versionData.offlineItems).map(
                          ([itemName, item]) => (
                            <ProgressBar
                              data-bs-toggle="tooltip"
                              data-bs-placement="top"
                              title={getTooltipForItem(itemName, item)}
                              key={itemName}
                              now={item.item_size}
                              max={version.total_compressed_size ?? 1}
                              variant={getVariantForProgress(
                                versionData,
                                item,
                                true,
                              )}
                              className="contrast-border-hover"
                            />
                          ),
                        )}
                      </ProgressBar>
                      <br />
                      <Button
                        enabled={Object.keys(versionData.offlineItems).length > 0}
                        icon="folder"
                        onClick={() => invoke("open_folder_for_version", { uuid: version.uuid, offline: true })}
                        tooltip="Open offline cache folder"
                      />{" "}
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
                      />{" "}
                      <Button
                        loading={!versionData.offlineDone}
                        enabled={isCorrupt(versionData.offlineItems, true)}
                        icon="screwdriver-wrench"
                        onClick={() => repairOfflineCache(version.uuid)}
                        variant="warning"
                        tooltip="Repair offline cache"
                      />{" "}
                      <Button
                        loading={!versionData.offlineDone}
                        enabled={!!getValidatedSize(versionData.offlineItems)}
                        icon="trash"
                        onClick={() => deleteOfflineCache(version.uuid)}
                        variant="danger"
                        tooltip="Delete offline cache"
                      />
                    </td>
                    <td className="text-end p-1">
                      <Button
                        loading={!versionData.gameDone || !versionData.offlineDone}
                        enabled={!DEFAULT_VERSION_UUIDS.includes(version.uuid)}
                        className="d-block w-50 h-100"
                        icon="x"
                        onClick={() => removeVersion(version.uuid)}
                        variant="danger"
                        tooltip={DEFAULT_VERSION_UUIDS.includes(version.uuid) ? "Cannot remove default build" : "Remove build"}
                      />
                    </td>
                  </tr>
                )
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
