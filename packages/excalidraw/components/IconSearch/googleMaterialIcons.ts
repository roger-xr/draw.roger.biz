import materialSymbolNames from "./materialSymbolNames.json";

import { sanitizeMaterialIconSvg } from "./sanitizeIconSvg";

const ICON_NAME = /^[a-z0-9_]{1,64}$/;

const ICON_HOST = "https://fonts.gstatic.com";

const ICON_PATH_PREFIX = "/s/i/short-term/release/materialsymbolsoutlined/";

const MAX_ICON_SVG_BYTES = 64 * 1024;

const MAX_RESULTS = 40;

export const MATERIAL_SYMBOL_NAMES: readonly string[] = materialSymbolNames;

const MATERIAL_SYMBOL_NAME_SET = new Set(materialSymbolNames);

export const POPULAR_MATERIAL_ICONS = [
  "home",
  "search",
  "settings",
  "person",
  "favorite",
  "delete",
  "edit",
  "share",
  "check",
  "close",
  "menu",
  "add",
  "warning",
  "info",
  "calendar_today",
  "mail",
  "folder",
  "image",
  "link",
  "lock",
  "star",
  "arrow_forward",
  "download",
  "upload",
  "play_arrow",
  "visibility",
  "thumb_up",
  "light_mode",
  "dark_mode",
  "account_circle",
  "notifications",
  "shopping_cart",
  "map",
  "phone",
  "chat",
  "code",
  "bug_report",
  "cloud",
  "description",
  "dashboard",
];

export const isMaterialIconName = (name: string) => ICON_NAME.test(name);

export const materialIconSvgUrl = (name: string) => {
  if (!isMaterialIconName(name) || !MATERIAL_SYMBOL_NAME_SET.has(name)) {
    throw new Error("Invalid icon name");
  }
  return `${ICON_HOST}${ICON_PATH_PREFIX}${encodeURIComponent(
    name,
  )}/default/48px.svg`;
};

export const searchMaterialIcons = (query: string) => {
  const normalized = query
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

  if (!normalized) {
    return POPULAR_MATERIAL_ICONS.filter((name) =>
      MATERIAL_SYMBOL_NAME_SET.has(name),
    ).slice(0, MAX_RESULTS);
  }

  const exact: string[] = [];
  const prefixToken: string[] = [];
  const prefix: string[] = [];
  const token: string[] = [];
  const contains: string[] = [];

  for (const name of MATERIAL_SYMBOL_NAMES) {
    if (name === normalized) {
      exact.push(name);
    } else if (name.startsWith(`${normalized}_`)) {
      prefixToken.push(name);
    } else if (name.startsWith(normalized)) {
      prefix.push(name);
    } else if (name.includes(`_${normalized}`)) {
      token.push(name);
    } else if (name.includes(normalized)) {
      contains.push(name);
    }
  }

  return [...exact, ...prefixToken, ...prefix, ...token, ...contains].slice(
    0,
    MAX_RESULTS,
  );
};

export const fetchMaterialIconSvg = async (
  name: string,
  fill: string,
  ownerDocument: Document,
  signal?: AbortSignal,
) => {
  const url = materialIconSvgUrl(name);
  const view = ownerDocument.defaultView;
  if (!view) {
    throw new Error("Could not load icon");
  }
  const response = await view.fetch(url, {
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
    signal,
  });

  if (!response.ok || response.url !== url) {
    throw new Error("Could not load icon");
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/svg+xml")) {
    throw new Error("Could not load icon");
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_ICON_SVG_BYTES) {
    throw new Error("Could not load icon");
  }

  const source = new view.TextDecoder("utf-8", { fatal: true }).decode(buffer);
  return sanitizeMaterialIconSvg(source, fill, ownerDocument);
};
