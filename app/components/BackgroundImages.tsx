import { useEffect } from "react";
import { ServerEntry } from "@/app/types";
import get_seed from "@/app/seed";

const getBackgroundImageUrlForServer = (server?: ServerEntry) => {
  if (server?.endpoint) {
    // HACK: add the counter to the url as a parameter to prevent caching across launches
    return "http://" + server.endpoint + "/launcher/background.png?seed=" + get_seed();
  }
  return undefined;
};

const getStyleForServer = (imageUrl: string | undefined) => {
  return {
    backgroundImage: imageUrl ? `url(${imageUrl})` : "none",
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
        const className = selected ? "opacity-on" : "opacity-off";
        const style = getStyleForServer(imageUrl);
        return (
          <div key={server.uuid} className={"background-image " + className} style={style} />
        );
      })}
    </>
  );
}
