import Button from "../components/Button";
import { LoginSession, ServerEntry } from "@/app/types";
import {
  getBackgroundImageStyle,
  getBackgroundImageUrlForServer,
  getLogoImageUrlForServer,
} from "@/app/util";
import { invoke } from "@tauri-apps/api/core";
import { CSSProperties, useEffect, useState } from "react";

function ListEntry({
  server,
  logOut,
}: {
  server: ServerEntry;
  logOut: (uuid: string) => void;
}) {
  const [logo, setLogo] = useState<string | undefined>(undefined);
  const [session, setSession] = useState<LoginSession | undefined | null>(
    undefined
  );

  useEffect(() => {
    const loadSession = async () => {
      try {
        const session: LoginSession = await invoke("get_session", {
          serverUuid: server.uuid,
        });
        setSession(session);
      } catch (e) {
        setSession(null);
      }
    };

    const logoUrl = getLogoImageUrlForServer(server);
    if (logoUrl) {
      const img = new Image();
      img.src = logoUrl;
      img.onload = () => {
        setLogo(logoUrl);
      };
    }

    loadSession();
  }, []);

  const bgUrl = getBackgroundImageUrlForServer(server);
  const rowStyle: CSSProperties = {
    ...getBackgroundImageStyle(bgUrl),
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };
  return (
    <tr>
      <td colSpan={2} className="bg-blend p-3" style={rowStyle}>
        <div className="d-flex justify-content-between align-items-center">
          <div className="font-monospace ps-3">
            {logo ? (
              <img
                src={logo}
                height={60}
                className="d-block"
                title={server.description}
              />
            ) : (
              <h3 className="mb-0">{server.description}</h3>
            )}
            <small className="text-muted">{server.endpoint}</small>
          </div>
          {session === undefined ? (
            <span
              className="spinner-border spinner-border-lg mx-3"
              role="status"
              aria-hidden="true"
            ></span>
          ) : session === null ? (
            <div className="text-end">
              <small className="mb-1 d-block text-muted">not logged in</small>
              <Button
                icon="sign-in-alt"
                iconLeft
                text="Log In"
                onClick={() => {}}
                variant="success"
                tooltip="Log in"
              />
            </div>
          ) : (
            <div className="text-end">
              <span className="mb-1 d-block">
                <small className="text-muted">logged in as</small><h4 className="d-inline">{" " + session.username}</h4>
              </span>
              <Button
                icon="sign-out-alt"
                iconLeft
                text="Log Out"
                onClick={() => logOut(server.uuid)}
                variant="danger"
                tooltip="Log out"
              />
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function AuthenticationList({
  servers,
  logOut,
}: {
  servers?: ServerEntry[];
  logOut: (uuid: string) => void;
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
              <td colSpan={3}>No servers available.</td>
            </tr>
          ) : (
            servers.map((server: ServerEntry) => {
              return (
                server.endpoint && (
                  <ListEntry
                    key={server.uuid}
                    server={server}
                    logOut={logOut}
                  />
                )
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
