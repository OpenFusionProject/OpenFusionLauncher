export type ServerEntry = {
  uuid: string;
  description: string;
  ip?: string;
  versions: string[];
  endpoint?: string;
};

export type NewServerDetails = {
  description: string;
  ip?: string;
  version?: string;
  endpoint?: string;
};

export type Servers = {
  servers: ServerEntry[];
  favorites: string[];
};

export type VersionEntry = {
  uuid: string;
  name?: string;
  description?: string;
  hidden?: boolean;
};

export type Versions = {
  versions: VersionEntry[];
};

export type Alert = {
  variant: string;
  text: string;
  id: number;
};

export type LoadingTask = {
  id: string;
  text?: string;
};

export type ImportCounts = {
  version_count: number;
  server_count: number;
};
