const SVG_NS = "http://www.w3.org/2000/svg";

const MAX_ICON_SVG_CHARS = 64 * 1024;

const SHAPE_TAGS = new Set([
  "path",
  "circle",
  "ellipse",
  "rect",
  "line",
  "polyline",
  "polygon",
]);

const GROUP_TAGS = new Set(["g", "defs"]);

const SAFE_FILL = /^#[0-9a-fA-F]{6}$/;

const SAFE_VIEW_BOX = /^-?\d+(?:\.\d+)?(?:[\s,]+-?\d+(?:\.\d+)?){3}$/;

const SAFE_LENGTH = /^-?\d+(?:\.\d+)?$/;

const SAFE_PATH = /^[MmZzLlHhVvCcSsQqTtAaEe0-9\s,.\-+]+$/;

const SAFE_POINTS = /^-?\d+(?:\.\d+)?(?:[\s,]+-?\d+(?:\.\d+)?){1,}$/;

const SAFE_TRANSFORM =
  /^(?:(?:translate|scale|rotate|matrix|skewX|skewY)\(\s*-?\d+(?:\.\d+)?(?:\s*[, ]\s*-?\d+(?:\.\d+)?)*\s*\)\s*)+$/;

const NUMERIC_ATTRS = new Set([
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "x1",
  "x2",
  "y1",
  "y2",
  "width",
  "height",
]);

const copyShape = (
  source: Element,
  parent: Element,
  doc: Document,
  fill: string,
) => {
  const tag = source.localName?.toLowerCase();
  if (!tag || !SHAPE_TAGS.has(tag)) {
    return;
  }

  const next = doc.createElementNS(SVG_NS, tag);

  if (tag === "path") {
    const d = source.getAttribute("d") ?? "";
    if (!d || d.length > 20_000 || !SAFE_PATH.test(d)) {
      return;
    }
    next.setAttribute("d", d);
  }

  if (tag === "polyline" || tag === "polygon") {
    const points = source.getAttribute("points") ?? "";
    if (!points || points.length > 20_000 || !SAFE_POINTS.test(points)) {
      return;
    }
    next.setAttribute("points", points);
  }

  for (const attr of source.getAttributeNames()) {
    if (!NUMERIC_ATTRS.has(attr)) {
      continue;
    }
    const value = source.getAttribute(attr) ?? "";
    if (SAFE_LENGTH.test(value)) {
      next.setAttribute(attr, value);
    }
  }

  const transform = source.getAttribute("transform");
  if (transform && SAFE_TRANSFORM.test(transform)) {
    next.setAttribute("transform", transform);
  }

  const sourceFill = source.getAttribute("fill");
  next.setAttribute("fill", sourceFill === "none" ? "none" : fill);
  parent.appendChild(next);
};

const copyChildren = (
  source: Element,
  parent: Element,
  doc: Document,
  fill: string,
) => {
  for (const child of source.children) {
    const tag = child.localName?.toLowerCase();
    if (tag && GROUP_TAGS.has(tag)) {
      const group = doc.createElementNS(SVG_NS, tag);
      parent.appendChild(group);
      copyChildren(child, group, doc, fill);
      if (!group.childElementCount) {
        group.remove();
      }
      continue;
    }
    copyShape(child, parent, doc, fill);
  }
};

/**
 * Rebuilds a Material Symbol SVG from an allowlist of elements and attributes.
 * Scripts, event handlers, external URLs and embedded HTML are dropped.
 */
export const sanitizeMaterialIconSvg = (
  source: string,
  fill: string,
  ownerDocument: Document,
) => {
  if (!SAFE_FILL.test(fill)) {
    throw new Error("Invalid icon color");
  }
  if (!source || source.length > MAX_ICON_SVG_CHARS) {
    throw new Error("Invalid icon");
  }

  const DOMParser = ownerDocument.defaultView?.DOMParser;
  if (!DOMParser) {
    throw new Error("Invalid icon");
  }

  const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
  const root = parsed.documentElement;
  if (
    parsed.querySelector("parsererror") ||
    root.localName?.toLowerCase() !== "svg"
  ) {
    throw new Error("Invalid icon");
  }

  const svg = ownerDocument.createElementNS(SVG_NS, "svg");
  svg.setAttribute("xmlns", SVG_NS);

  const viewBox = root.getAttribute("viewBox");
  svg.setAttribute(
    "viewBox",
    viewBox && SAFE_VIEW_BOX.test(viewBox) ? viewBox : "0 0 48 48",
  );
  svg.setAttribute("width", "128");
  svg.setAttribute("height", "128");

  copyChildren(root, svg, ownerDocument, fill);

  if (
    !svg.querySelector("path, circle, ellipse, rect, line, polyline, polygon")
  ) {
    throw new Error("Invalid icon");
  }

  return svg.outerHTML;
};
