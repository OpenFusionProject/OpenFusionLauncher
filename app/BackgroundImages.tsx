import { CSSProperties, useEffect, useState } from "react";
import { ServerEntry } from "./types";

const getBackgroundImageUrlForServer = (server?: ServerEntry) => {
  if (server?.endpoint) {
    return "http://" + server.endpoint + "/launcher/background.png";
  }
  return undefined;
};

const OPACITY = 0.25;

const getStyleForServer = (imageUrl: string | undefined, selected: boolean) => {
  return {
    backgroundImage: imageUrl ? `url(${imageUrl})` : "none",
    opacity: selected ? OPACITY : 0,
  };
};

export default function BackgroundImages({
  servers,
  selectedServer,
}: {
  servers: ServerEntry[];
  selectedServer?: ServerEntry;
}) {

  // Preload images
  useEffect(() => {
    servers.forEach((server) => {
      const imageUrl = getBackgroundImageUrlForServer(server);
      if (imageUrl) {
        const img = new Image();
        img.src = imageUrl;
      }
    });
  }, [servers]);

  return (
    <>
      {servers.map((server) => {
        const imageUrl = getBackgroundImageUrlForServer(server);
        const selected = server.uuid === selectedServer?.uuid;
        const style = getStyleForServer(imageUrl, selected);
        return (
          <div key={server.uuid} className="background-image" style={style} />
        );
      })}
    </>
  );
}
