import { describe, expect, it, vi } from "vitest";

import {
  MATERIAL_SYMBOL_NAMES,
  fetchMaterialIconSvg,
  isMaterialIconName,
  materialIconSvgUrl,
  searchMaterialIcons,
} from "../components/IconSearch/googleMaterialIcons";
import { sanitizeMaterialIconSvg } from "../components/IconSearch/sanitizeIconSvg";

const FILL = "#112233";

const ICON_URL =
  "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/home/default/48px.svg";

describe("icon search", () => {
  it("keeps the drawing and drops active content", () => {
    const svg = sanitizeMaterialIconSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><script>alert(1)</script><path d="M0 0h10v10z" onclick="alert(1)" fill="red" style="fill:url(https://evil.test)" href="https://evil.test"/><foreignObject><body xmlns="http://www.w3.org/1999/xhtml">hi</body></foreignObject></svg>`,
      FILL,
      document,
    );

    expect(svg).toContain(`fill="${FILL}"`);
    expect(svg).toContain('d="M0 0h10v10z"');
    expect(svg).toContain('viewBox="0 -960 960 960"');
    expect(svg.toLowerCase()).not.toContain("script");
    expect(svg).not.toContain("onclick");
    expect(svg.toLowerCase()).not.toContain("foreignobject");
    expect(svg).not.toContain("evil.test");
    expect(svg).not.toContain("alert");
    expect(svg).not.toContain("style");
  });

  it("rejects a document that is not an icon", () => {
    expect(() =>
      sanitizeMaterialIconSvg("<html></html>", FILL, document),
    ).toThrow(/Invalid icon/);
    expect(() =>
      sanitizeMaterialIconSvg(
        `<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1"/></svg>`,
        "red",
        document,
      ),
    ).toThrow(/Invalid icon color/);
  });

  it("only builds urls for names in the catalog", () => {
    expect(materialIconSvgUrl("home")).toBe(ICON_URL);
    expect(isMaterialIconName("10k")).toBe(true);
    expect(() => materialIconSvgUrl("../home")).toThrow(/Invalid icon name/);
    expect(() => materialIconSvgUrl("home.svg")).toThrow(/Invalid icon name/);
    expect(() => materialIconSvgUrl("Home")).toThrow(/Invalid icon name/);
    expect(() => materialIconSvgUrl("not_a_real_icon_zz")).toThrow(
      /Invalid icon name/,
    );
  });

  it("ships an allowlist of plain icon names", () => {
    expect(MATERIAL_SYMBOL_NAMES.length).toBeGreaterThan(1000);
    expect(new Set(MATERIAL_SYMBOL_NAMES).size).toBe(
      MATERIAL_SYMBOL_NAMES.length,
    );
    for (const name of MATERIAL_SYMBOL_NAMES) {
      expect(name).toMatch(/^[a-z0-9_]{1,64}$/);
    }
  });

  it("ranks an exact icon name first", () => {
    expect(searchMaterialIcons("home")[0]).toBe("home");
    expect(searchMaterialIcons("Home")[0]).toBe("home");
    expect(searchMaterialIcons("")).toContain("search");
    expect(searchMaterialIcons("<script>").join(" ")).not.toMatch(/[<>]/);
  });

  it("does not request an icon outside the catalog", async () => {
    const fetchSpy = vi.spyOn(window, "fetch");
    await expect(
      fetchMaterialIconSvg("not_a_real_icon_zz", FILL, document),
    ).rejects.toThrow(/Invalid icon name/);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("rejects a response that is not the svg from the icon host", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response("<svg></svg>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );

    await expect(fetchMaterialIconSvg("home", FILL, document)).rejects.toThrow(
      /Could not load icon/,
    );
    vi.restoreAllMocks();
  });

  it("sanitizes the svg returned by the icon host", async () => {
    const response = new Response(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M0 0h10v10z"/><script>alert(1)</script></svg>`,
      {
        status: 200,
        headers: { "content-type": "image/svg+xml" },
      },
    );
    Object.defineProperty(response, "url", { value: ICON_URL });
    const fetchSpy = vi.spyOn(window, "fetch").mockResolvedValue(response);

    const svg = await fetchMaterialIconSvg("home", FILL, document);

    expect(fetchSpy).toHaveBeenCalledWith(
      ICON_URL,
      expect.objectContaining({
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer",
      }),
    );
    expect(svg).toContain(`fill="${FILL}"`);
    expect(svg.toLowerCase()).not.toContain("script");
    vi.restoreAllMocks();
  });
});
