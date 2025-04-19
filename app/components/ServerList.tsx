import { ServerEntry, VersionEntry } from "@/app/types";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

const findVersion = (versions: VersionEntry[], uuid: string) => {
  return versions.find((version) => version.uuid == uuid);
};

const getVersionsForServer = async (server: ServerEntry) => {
  if (!server.endpoint) {
    // Not available for simple servers
    throw new Error("Server is not an endpoint server");
  }

  const versions: string[] = await invoke("get_versions_for_server", {
    uuid: server.uuid,
  });
  return versions;
};

const getPlayerCountForServer = async (server: ServerEntry) => {
  if (!server.endpoint) {
    // Not available for simple servers
    return undefined;
  }

  // Call the backend
  const count: number = await invoke("get_player_count_for_server", {
    uuid: server.uuid,
  });
  return count;
};

function PlayerCount({
  server,
  refreshes,
}: {
  server: ServerEntry;
  refreshes: number;
}) {
  const [playerCount, setPlayerCount] = useState<number | undefined>(undefined);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    const fetchPlayerCount = async () => {
      try {
        const count = await getPlayerCountForServer(server);
        setPlayerCount(count);
        setError(false);
      } catch (e) {
        console.warn(e);
        setError(true);
      }
    };

    setError(false);
    setPlayerCount(undefined);
    fetchPlayerCount();
  }, [server, refreshes]);

  if (playerCount !== undefined) {
    return (
      <span className="fw-bold text-success" title="Current player count">
        <i className="fa fa-user fa-sm"></i> {playerCount}
      </span>
    );
  }

  if (server.endpoint) {
    if (error) {
      return (
        <span className="fw-bold text-danger">
          <i
            className="fa fa-plug-circle-xmark"
            title="Could not connect to server"
          ></i>
        </span>
      );
    }
    return (
      <span
        className="spinner-border spinner-border-sm"
        role="status"
        aria-hidden="true"
      ></span>
    );
  }

  return (
    <span>
      <i
        className="fa-solid fa-circle-question"
        title="No information provided"
      ></i>
    </span>
  );
}

function VersionBadges({
  server,
  versions,
  reloadVersions,
  refreshes,
}: {
  server: ServerEntry;
  versions: VersionEntry[];
  reloadVersions: () => Promise<void>;
  refreshes: number;
}) {
  const [endpointVersions, setEndpointVersions] = useState<
    string[] | undefined
  >(undefined);

  useEffect(() => {
    const fetchEndpointVersions = async () => {
      try {
        const versionUuids: string[] = await getVersionsForServer(server);
        // FEAT: maybe store which versions are new so we can show badges for them
        await reloadVersions();
        setEndpointVersions(versionUuids);
      } catch (e) {
        console.warn(e);
        setEndpointVersions([]);
      }
    };

    setEndpointVersions(undefined);
    if (server.endpoint) {
      fetchEndpointVersions();
    }
  }, [server, refreshes]);

  if (server.endpoint) {
    if (!endpointVersions) {
      return (
        <span
          className="spinner-border spinner-border-sm"
          role="status"
          aria-hidden="true"
        ></span>
      );
    } else if (endpointVersions.length == 0) {
      return <span className="badge bg-danger">no versions</span>;
    } else {
      return (
        <>
          {endpointVersions.map((versionUuid) => {
            const version = findVersion(versions, versionUuid);
            if (!version) {
              return (
                <span key={versionUuid} className="badge bg-danger me-1">
                  unknown
                </span>
              );
            }
            const label = version.name ?? version.uuid;
            return (
              <span
                key={version.uuid}
                className="badge bg-success me-1"
                title={version.uuid}
              >
                {label}
              </span>
            );
          })}
        </>
      );
    }
  } else {
    const versionUuid = server.version!;
    const version = findVersion(versions, versionUuid);
    if (!version) {
      return <span className="badge bg-danger">unknown</span>;
    }
    const label = version.name ?? version.uuid;
    return (
      <span className="badge bg-secondary" title={version.uuid}>
        {label}
      </span>
    );
  }
}

export default function ServerList({
  servers,
  versions,
  selectedServer,
  setSelectedServer,
  onConnect,
  reloadVersions,
}: {
  servers?: ServerEntry[];
  versions: VersionEntry[];
  selectedServer?: string;
  setSelectedServer: (server: string) => void;
  onConnect: (server: string) => void;
  reloadVersions: () => Promise<void>;
}) {
  const [statusRefreshes, setStatusRefreshes] = useState(0);
  const [supportedVersionRefreshes, setSupportedVersionRefreshes] = useState(0);

  return (
    <div
      className="table-responsive text-center border rounded border-primary"
      id="server-table"
    >
      <table className="table table-striped table-hover mb-0">
        <thead>
          <tr>
            <th className="text-start name-column">Server Name</th>
            <th className="versions-column">
              Game Versions
              <i
                onClick={() => setSupportedVersionRefreshes((r) => r + 1)}
                className="fa fa-rotate-right ms-2 clickable"
              ></i>
            </th>
            <th className="text-end status-column">
              Status
              <i
                onClick={() => setStatusRefreshes((r) => r + 1)}
                className="fa fa-rotate-right ms-2 clickable"
              ></i>
            </th>
          </tr>
        </thead>
        <tbody id="server-tablebody">
          {!servers ? (
            <tr>
              <td colSpan={3}>
                <span
                  className="spinner-border spinner-border-md m-2"
                  role="status"
                  aria-hidden="true"
                ></span>
              </td>
            </tr>
          ) : servers.length === 0 ? (
            <tr>
              <td colSpan={3}>No servers available.</td>
            </tr>
          ) : (
            servers.map((server) => (
              <tr
                key={server.uuid}
                className={
                  "server-listing-entry " +
                  (selectedServer == server.uuid ? "table-active" : "")
                }
                onClick={() => setSelectedServer(server.uuid!)}
                onDoubleClick={() => onConnect(server.uuid!)}
              >
                <td className="text-start name-column">{server.description}</td>
                <td className="font-monospace versions-column">
                  <VersionBadges
                    server={server}
                    versions={versions}
                    reloadVersions={reloadVersions}
                    refreshes={supportedVersionRefreshes}
                  />
                </td>
                <td className="font-monospace text-end status-column">
                  <PlayerCount server={server} refreshes={statusRefreshes} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
