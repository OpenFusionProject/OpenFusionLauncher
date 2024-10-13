import { ServerEntry } from "./types";

export default function ServerList({
  servers,
  selectedServer,
  setSelectedServer,
}: {
  servers: ServerEntry[];
  selectedServer: string;
  setSelectedServer: (server: string) => void;
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
            <th>Game Version</th>
          </tr>
        </thead>
        <tbody id="server-tablebody">
          {servers.length == 0 ? (
            <tr id="server-listing-placeholder">
              <td colSpan={2}>
                No servers added yet... perhaps you should find one?
              </td>
            </tr>
          ) : (
            servers.map((server) => (
              <tr
                key={server.uuid}
                className={
                  "server-listing-entry " +
                  (selectedServer == server.uuid ? "bg-primary" : "")
                }
                onClick={() => setSelectedServer(server.uuid)}
              >
                <td>{server.description}</td>
                <td className="text-monospace">{server.version}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
