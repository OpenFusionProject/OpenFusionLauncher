import Button from "../components/Button";
import { ServerEntry } from "@/app/types";

export default function GameBuildsList({
  servers,
  signOut
}: {
  servers?: ServerEntry[];
  signOut: (uuid: string) => void;
}) {
  return (
    <div className="table-responsive">
      <table className="table table-striped table-hover mb-0">
        <tbody className="align-middle">
          {!servers ? (
            <tr>
              <td colSpan={3} className="text-center">
                <span
                  className="spinner-border spinner-border-sm m-2"
                  role="status"
                  aria-hidden="true"
                ></span>
              </td>
            </tr>
          ) : servers.length == 0 ? (
            <tr>
              <td colSpan={3}>You are not signed in to any servers.</td>
            </tr>
          ) : (
            servers.map(
              (server) => {
                return server.endpoint && (
                  <tr key={server.uuid}>
                    <td className="font-monospace ps-3">
                      <h3>
                        {server.description}
                      </h3>
                      <small className="text-muted">
                        {server.endpoint}
                      </small>
                    </td>
                    <td className="text-end pe-3 pb-3">
                      <div className="mb-1">
                        <small className="text-muted">
                          signed in as
                        </small>
                        <h4>
                          {" " + "TODOTODOTODO"}
                        </h4>
                      </div>
                      <Button
                        icon="sign-out-alt"
                        iconLeft
                        text="Sign Out"
                        onClick={() => signOut(server.uuid)}
                        variant="danger"
                        tooltip="Sign out"
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
