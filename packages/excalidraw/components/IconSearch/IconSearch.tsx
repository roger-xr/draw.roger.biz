import { useEffect, useMemo, useRef, useState } from "react";

import {
  EVENT,
  KEYS,
  THEME,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import { SVGStringToFile } from "../../data/blob";
import { useUIAppState } from "../../context/ui-appState";
import { t } from "../../i18n";
import { getShortcutKey } from "../../shortcut";
import { useApp, useExcalidrawSetAppState } from "../App";
import { Dialog } from "../Dialog";
import { TextField } from "../TextField";

import {
  fetchMaterialIconSvg,
  materialIconSvgUrl,
  searchMaterialIcons,
} from "./googleMaterialIcons";

import "./IconSearch.scss";

import type { ReactNode } from "react";

const LIGHT_ICON_FILL = "#1e1e1e";
const DARK_ICON_FILL = "#f5f5f5";

const isIconSearchShortcut = (event: KeyboardEvent) => {
  return (
    !event.altKey &&
    !event.shiftKey &&
    !event.repeat &&
    event[KEYS.CTRL_OR_CMD] &&
    event.key.toLowerCase() === KEYS.I
  );
};

export const IconSearch = () => {
  const app = useApp();
  const setAppState = useExcalidrawSetAppState();
  const uiAppState = useUIAppState();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isIconSearchShortcut(event)) {
        return;
      }
      if (app.state.editingTextElement || app.state.viewModeEnabled) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setAppState((state) => ({
        openDialog:
          state.openDialog?.name === "iconSearch"
            ? null
            : { name: "iconSearch" },
      }));
    };

    app.ownerWindow.addEventListener(EVENT.KEYDOWN, onKeyDown, {
      capture: true,
    });
    return () => {
      app.ownerWindow.removeEventListener(EVENT.KEYDOWN, onKeyDown, {
        capture: true,
      });
    };
  }, [app, setAppState]);

  if (uiAppState.openDialog?.name !== "iconSearch") {
    return null;
  }

  return <IconSearchDialog />;
};

const ShortcutHint = ({
  shortcut,
  children,
}: {
  shortcut: string;
  children?: ReactNode;
}) => (
  <div className="shortcut">
    {shortcut.split(" ").map((item) => (
      <div className="shortcut-wrapper" key={item}>
        <div className="shortcut-key">{item}</div>
      </div>
    ))}
    {children && <div className="shortcut-desc">{children}</div>}
  </div>
);

const IconSearchDialog = () => {
  const app = useApp();
  const setAppState = useExcalidrawSetAppState();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const insertingRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  const aliveRef = useRef(true);
  const results = useMemo(() => searchMaterialIcons(query), [query]);
  const resultsRef = useRef(results);
  const activeIndexRef = useRef(activeIndex);
  resultsRef.current = results;
  activeIndexRef.current = activeIndex;

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      requestRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const close = () => {
    requestRef.current?.abort();
    setAppState({ openDialog: null });
  };

  const insertIcon = async (name: string | undefined) => {
    if (!name || insertingRef.current || app.state.viewModeEnabled) {
      return;
    }
    insertingRef.current = true;

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setStatus(t("iconSearch.adding"));

    try {
      const fill =
        app.state.theme === THEME.DARK ? DARK_ICON_FILL : LIGHT_ICON_FILL;
      const svg = await fetchMaterialIconSvg(
        name,
        fill,
        app.ownerDocument,
        controller.signal,
      );
      if (!aliveRef.current || controller.signal.aborted) {
        insertingRef.current = false;
        return;
      }

      const { x, y } = viewportCoordsToSceneCoords(
        {
          clientX: app.state.width / 2 + app.state.offsetLeft,
          clientY: app.state.height / 2 + app.state.offsetTop,
        },
        app.state,
      );
      await app.insertImages([SVGStringToFile(svg, `${name}.svg`)], x, y);
      if (!aliveRef.current) {
        return;
      }
      setAppState({ openDialog: null });
    } catch (error) {
      if (controller.signal.aborted || !aliveRef.current) {
        return;
      }
      console.error(error);
      setStatus(t("iconSearch.insertError"));
      insertingRef.current = false;
    }
  };

  const insertIconRef = useRef(insertIcon);
  insertIconRef.current = insertIcon;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === KEYS.ARROW_DOWN || event.key === KEYS.ARROW_UP) {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex((index) => {
          const count = resultsRef.current.length;
          if (!count) {
            return 0;
          }
          const delta = event.key === KEYS.ARROW_DOWN ? 1 : -1;
          return (index + delta + count) % count;
        });
        return;
      }

      if (event.key === KEYS.ENTER) {
        event.preventDefault();
        event.stopPropagation();
        void insertIconRef.current(resultsRef.current[activeIndexRef.current]);
      }
    };

    app.ownerWindow.addEventListener(EVENT.KEYDOWN, onKeyDown, {
      capture: true,
    });
    return () => {
      app.ownerWindow.removeEventListener(EVENT.KEYDOWN, onKeyDown, {
        capture: true,
      });
    };
  }, [app]);

  return (
    <Dialog
      onCloseRequest={close}
      closeOnClickOutside
      title={false}
      size={640}
      autofocus
      className="icon-search-dialog"
    >
      <TextField
        value={query}
        placeholder={t("iconSearch.placeholder")}
        onChange={(value) => {
          setQuery(value.slice(0, 64));
          setStatus(null);
        }}
        selectOnRender
        type="search"
      />
      <div className="icon-search-status" aria-live="polite">
        {status || t("iconSearch.attribution")}
      </div>
      {app.editorInterface.formFactor !== "phone" && (
        <div className="shortcuts-wrapper">
          <ShortcutHint shortcut="↑↓">
            {t("commandPalette.shortcuts.select")}
          </ShortcutHint>
          <ShortcutHint shortcut="↵">
            {t("commandPalette.shortcuts.confirm")}
          </ShortcutHint>
          <ShortcutHint shortcut={getShortcutKey("Esc")}>
            {t("commandPalette.shortcuts.close")}
          </ShortcutHint>
        </div>
      )}
      <div
        className="commands"
        role="listbox"
        aria-label={t("iconSearch.title")}
      >
        {results.length ? (
          results.map((name, index) => (
            <div
              key={name}
              role="option"
              aria-selected={index === activeIndex}
              className={
                index === activeIndex
                  ? "command-item item-selected"
                  : "command-item"
              }
              ref={(node) => {
                if (index === activeIndex) {
                  node?.scrollIntoView?.({ block: "nearest" });
                }
              }}
              onMouseMove={() => setActiveIndex(index)}
              onClick={() => {
                void insertIcon(name);
              }}
            >
              <img
                className="icon-search-preview"
                alt=""
                width={24}
                height={24}
                draggable={false}
                referrerPolicy="no-referrer"
                src={materialIconSvgUrl(name)}
              />
              <span className="icon-search-name">
                {name.replace(/_/g, " ")}
              </span>
            </div>
          ))
        ) : (
          <div className="no-match">{t("iconSearch.noMatch")}</div>
        )}
      </div>
    </Dialog>
  );
};
