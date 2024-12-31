import { ProgressBar } from "react-bootstrap";
import Button from "../components/Button";

import {
  VersionCacheData,
  VersionCacheProgressItem,
  VersionEntry,
} from "@/app/types";

const BYTES_PER_GB = 1024 * 1024 * 1024;

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
}: {
  versions?: VersionEntry[];
  versionDataList: VersionCacheData[];
  clearGameCache: (uuid: string) => void;
  downloadOfflineCache: (uuid: string) => void;
  repairOfflineCache: (uuid: string) => void;
  deleteOfflineCache: (uuid: string) => void;
}) {
  return (
    <div className="table-responsive">
      <table className="table table-striped table-hover mb-0">
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
                      <h3>
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
                    </td>
                    <td className="text-center">
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
