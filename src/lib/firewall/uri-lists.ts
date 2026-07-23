import "server-only";
import { withFirewallSession, commitPendingChanges, assertApiSuccess } from "@/lib/firewall/client";
import type { FirewallApiStatus } from "@/lib/firewall/client";
import type { FirewallConnectionConfig } from "@/lib/firewall/types";

const BASE = "/api/sonicos/content-filter/uri-list-objects";
const GROUPS_BASE = "/api/sonicos/content-filter/uri-list-groups";

export type FirewallUriListObject = {
  uuid: string;
  name: string;
  type?: string;
  uris: string[];
  domains: string[];
  keywords: string[];
};

export type FirewallUriListGroup = {
  uuid: string;
  name: string;
  objectNames: string[];
  groupNames: string[];
};

type RawUriListObject = {
  name: string;
  uuid?: string;
  type?: string;
  uri?: { uri: string }[];
  domain?: { domain: string }[];
  keyword?: { keyword: string }[];
};

type RawUriListObjectCollection = {
  content_filter?: { uri_list_object?: RawUriListObject[] };
};

type RawUriListGroup = {
  name: string;
  uuid?: string;
  uri_list_object?: { name: string }[];
  uri_list_group?: { name: string }[];
};

type RawUriListGroupCollection = {
  content_filter?: { uri_list_group?: RawUriListGroup[] };
};

function toUriListObject(raw: RawUriListObject): FirewallUriListObject {
  return {
    uuid: raw.uuid ?? "",
    name: raw.name,
    type: raw.type,
    uris: (raw.uri ?? []).map((u) => u.uri),
    domains: (raw.domain ?? []).map((d) => d.domain),
    keywords: (raw.keyword ?? []).map((k) => k.keyword),
  };
}

function toUriListGroup(raw: RawUriListGroup): FirewallUriListGroup {
  return {
    uuid: raw.uuid ?? "",
    name: raw.name,
    objectNames: (raw.uri_list_object ?? []).map((o) => o.name),
    groupNames: (raw.uri_list_group ?? []).map((g) => g.name),
  };
}

export async function listUriListObjects(config: FirewallConnectionConfig): Promise<FirewallUriListObject[]> {
  return withFirewallSession(config, async (ctx) => {
    const result = await ctx.request<RawUriListObjectCollection>("GET", BASE);
    const items = result?.content_filter?.uri_list_object ?? [];
    return items.map(toUriListObject).sort((a, b) => a.name.localeCompare(b.name));
  });
}

export async function getUriListObject(config: FirewallConnectionConfig, uuid: string): Promise<FirewallUriListObject | null> {
  return withFirewallSession(config, async (ctx) => {
    const result = await ctx.request<RawUriListObjectCollection>("GET", `${BASE}/uuid/${uuid}`);
    const item = result?.content_filter?.uri_list_object?.[0];
    return item ? toUriListObject(item) : null;
  });
}

export async function listUriListGroups(config: FirewallConnectionConfig): Promise<FirewallUriListGroup[]> {
  return withFirewallSession(config, async (ctx) => {
    const result = await ctx.request<RawUriListGroupCollection>("GET", GROUPS_BASE);
    const items = result?.content_filter?.uri_list_group ?? [];
    return items.map(toUriListGroup).sort((a, b) => a.name.localeCompare(b.name));
  });
}

/** Busca objetos e grupos numa única sessão — evita abrir duas sessões concorrentes no firewall. */
export async function listUriListsAndGroups(
  config: FirewallConnectionConfig
): Promise<{ objects: FirewallUriListObject[]; groups: FirewallUriListGroup[] }> {
  return withFirewallSession(config, async (ctx) => {
    // Sequencial de propósito: evita duas chamadas concorrentes na mesma sessão.
    const objectsResult = await ctx.request<RawUriListObjectCollection>("GET", BASE);
    const groupsResult = await ctx.request<RawUriListGroupCollection>("GET", GROUPS_BASE);
    const objects = (objectsResult?.content_filter?.uri_list_object ?? [])
      .map(toUriListObject)
      .sort((a, b) => a.name.localeCompare(b.name));
    const groups = (groupsResult?.content_filter?.uri_list_group ?? [])
      .map(toUriListGroup)
      .sort((a, b) => a.name.localeCompare(b.name));
    return { objects, groups };
  });
}

export type UriListObjectParams = {
  name: string;
  uris: string[];
  domains: string[];
  keywords: string[];
};

function buildObjectPayload(params: UriListObjectParams): RawUriListObjectCollection {
  return {
    content_filter: {
      uri_list_object: [
        {
          name: params.name,
          ...(params.uris.length ? { uri: params.uris.map((uri) => ({ uri })) } : {}),
          ...(params.domains.length ? { domain: params.domains.map((domain) => ({ domain })) } : {}),
          ...(params.keywords.length ? { keyword: params.keywords.map((keyword) => ({ keyword })) } : {}),
        },
      ],
    },
  };
}

export async function createUriListObject(config: FirewallConnectionConfig, params: UriListObjectParams): Promise<void> {
  return withFirewallSession(config, async (ctx) => {
    const result = await ctx.request<FirewallApiStatus>("POST", BASE, buildObjectPayload(params));
    assertApiSuccess(result);
    await commitPendingChanges(ctx);
  });
}

export async function updateUriListObject(
  config: FirewallConnectionConfig,
  uuid: string,
  params: UriListObjectParams
): Promise<void> {
  return withFirewallSession(config, async (ctx) => {
    const result = await ctx.request<FirewallApiStatus>("PUT", `${BASE}/uuid/${uuid}`, buildObjectPayload(params));
    assertApiSuccess(result);
    await commitPendingChanges(ctx);
  });
}

export async function deleteUriListObject(config: FirewallConnectionConfig, uuid: string): Promise<void> {
  return withFirewallSession(config, async (ctx) => {
    const result = await ctx.request<FirewallApiStatus>("DELETE", `${BASE}/uuid/${uuid}`);
    assertApiSuccess(result);
    await commitPendingChanges(ctx);
  });
}

export type UriListGroupParams = {
  name: string;
  objectNames: string[];
  groupNames: string[];
};

function buildGroupPayload(params: UriListGroupParams): RawUriListGroupCollection {
  return {
    content_filter: {
      uri_list_group: [
        {
          name: params.name,
          ...(params.objectNames.length ? { uri_list_object: params.objectNames.map((name) => ({ name })) } : {}),
          ...(params.groupNames.length ? { uri_list_group: params.groupNames.map((name) => ({ name })) } : {}),
        },
      ],
    },
  };
}

export async function createUriListGroup(config: FirewallConnectionConfig, params: UriListGroupParams): Promise<void> {
  return withFirewallSession(config, async (ctx) => {
    const result = await ctx.request<FirewallApiStatus>("POST", GROUPS_BASE, buildGroupPayload(params));
    assertApiSuccess(result);
    await commitPendingChanges(ctx);
  });
}

export async function updateUriListGroup(
  config: FirewallConnectionConfig,
  uuid: string,
  params: UriListGroupParams
): Promise<void> {
  return withFirewallSession(config, async (ctx) => {
    const result = await ctx.request<FirewallApiStatus>("PUT", `${GROUPS_BASE}/uuid/${uuid}`, buildGroupPayload(params));
    assertApiSuccess(result);
    await commitPendingChanges(ctx);
  });
}

export async function deleteUriListGroup(config: FirewallConnectionConfig, uuid: string): Promise<void> {
  return withFirewallSession(config, async (ctx) => {
    const result = await ctx.request<FirewallApiStatus>("DELETE", `${GROUPS_BASE}/uuid/${uuid}`);
    assertApiSuccess(result);
    await commitPendingChanges(ctx);
  });
}
