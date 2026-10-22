import { render } from "preact";
import { App } from "./app";
import { startConnection } from "./net/socket";
import "./styles.css";

render(<App />, document.getElementById("app")!);
startConnection();
