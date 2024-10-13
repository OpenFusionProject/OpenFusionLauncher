export type ServerEntry = {
  uuid: string;
  description: string;
  ip: string;
  version: string;
  endpoint: string;
};

export type Servers = {
  servers: ServerEntry[];
  favorites: string[];
};

export type VersionEntry = {
  name: string;
  url: string;
};

export type Versions = {
  versions: VersionEntry[];
};
