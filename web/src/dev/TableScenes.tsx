import { useState } from "preact/hooks";
import { view } from "../state";
import { RotateOverlay } from "../ui/RotateOverlay";
import { Table } from "../ui/Table";
import { SCENES } from "./scenes";

// Dev-only page (http://localhost:5173/?table=<name>): renders the in-game table from a fixture, with no server.
export function TableScenes() {
  const name = new URLSearchParams(location.search).get("table") ?? "";
  const scene = SCENES[name];
  useState(() => { if (scene) view.value = scene; });
  if (!scene) {
    return (
      <div class="center">
        <h2>Table scenes</h2>
        <div class="row">{Object.keys(SCENES).map((n) => <a key={n} href={`?table=${n}`} style="color:var(--paper)">{n}</a>)}</div>
      </div>
    );
  }
  return (
    <>
      <Table room={scene.room!} initialPanel={name === "board" ? "herds" : undefined} initialFocusId={name === "board" ? "anna" : undefined} />
      <RotateOverlay />
    </>
  );
}
