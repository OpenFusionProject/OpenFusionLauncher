import ofLogoLight from "@/app/img/of-light.png";
import ofLogoDark from "@/app/img/of-dark.png";

import { useEffect, useState } from "react";
import { ServerEntry } from "@/app/types";
import get_seed from "@/app/seed";
import NextImage from "next/image";

const getLogoImageUrlForServer = (server?: ServerEntry) => {
  if (server?.endpoint) {
    // HACK: add the counter to the url as a parameter to prevent caching across launches
    return "http://" + server.endpoint + "/launcher/logo.png?seed=" + get_seed();
  }
  return undefined;
};

export default function BackgroundImages({
  servers,
  selectedServer,
}: {
  servers: ServerEntry[];
  selectedServer?: ServerEntry;
}) {

  // map of server UUIDs to bools indicating whether the image is loaded
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});

  const isImageLoaded = (server: ServerEntry) => {
    return loadedImages[server.uuid] || false;
  }

  // Load images
  useEffect(() => {
    servers.forEach((server) => {
      const imageUrl = getLogoImageUrlForServer(server);
      if (imageUrl) {
        const img = new Image();
        img.onload = () => {
          setLoadedImages((prev) => ({ ...prev, [server.uuid]: true }));
        };
        img.src = imageUrl;
      }
    });
  }, [servers]);

  if (selectedServer && isImageLoaded(selectedServer)) {
    const imageUrl = getLogoImageUrlForServer(selectedServer)!;
    return (
      <div className="logo-image-container">
        <img src={imageUrl} className="logo-image" alt={selectedServer.description + " Logo"} />
      </div>
    )
  }
  
  return (
    <>
      <NextImage
        id="of-logo-light"
        src={ofLogoLight}
        alt="OpenFusion Logo"
        width={256}
      />
      <NextImage
        id="of-logo-dark"
        src={ofLogoDark}
        alt="OpenFusion Logo"
        width={256}
      />
    </>
  )
}
