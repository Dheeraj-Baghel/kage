import { createRoot } from "react-dom/client";
import { Scene } from "./Scene";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Kage application root is missing.");
createRoot(root).render(<Scene />);
