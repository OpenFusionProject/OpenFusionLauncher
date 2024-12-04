import { ServerEntry, VersionEntry } from "./types";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

const findVersion = (versions: VersionEntry[], uuid: string) => {
  return versions.find((version) => version.uuid == uuid);
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

function PlayerCount({ server }: { server: ServerEntry }) {
  const [playerCount, setPlayerCount] = useState<number | undefined>(undefined);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    const fetchPlayerCount = async () => {
      try {
        const count = await getPlayerCountForServer(server);
        setPlayerCount(count);
        setError(false);
      } catch (e) {
        setError(true);
      }
    };

    fetchPlayerCount();
  }, [server]);

  if (playerCount !== undefined) {
    const text = playerCount == 1 ? " player" : " players";
    return <span className="fw-bold text-success">{playerCount + text}</span>;
  }

  if (server.endpoint) {
    if (error) {
      return <span className="fw-bold text-danger">Offline</span>;
    }
    return (
      <span
        className="spinner-border spinner-border-sm"
        role="status"
        aria-hidden="true"
      ></span>
    );
  }

  return <span>--</span>;
}

export default function ServerList({
  servers,
  versions,
  selectedServer,
  setSelectedServer,
  onConnect,
}: {
  servers?: ServerEntry[];
  versions: VersionEntry[];
  selectedServer?: string;
  setSelectedServer: (server: string) => void;
  onConnect: (server: string) => void;
}) {
  return (
    <div
      className="table-responsive text-center border rounded border-primary"
      id="server-table"
    >
      <table className="table table-striped table-hover mb-0">
        <thead>
          <tr>
            <th>Description</th>
            <th>Game Versions</th>
            <th>Status</th>
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
                <td>{server.description}</td>
                <td className="font-monospace">
                  {server.versions.length === 0 ? (
                    <span className="badge bg-danger me-1">no versions</span>
                  ) : (
                    server.versions.map((version) => {
                      const versionEntry = findVersion(versions, version);
                      if (!versionEntry) {
                        return (
                          <span key={version} className="badge bg-danger me-1">
                            unknown
                          </span>
                        );
                      }
                      const label = versionEntry.name ?? versionEntry.uuid;
                      return (
                        <span
                          key={version}
                          className={
                            "badge " +
                            (server.endpoint ? "bg-success" : "bg-secondary") +
                            " me-1"
                          }
                        >
                          {label}
                        </span>
                      );
                    })
                  )}
                </td>
                <td className="font-monospace">
                  <PlayerCount server={server} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
