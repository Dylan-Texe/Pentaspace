export interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  wPos: boolean;
  wNeg: boolean;
  vPos: boolean;
  vNeg: boolean;
  sprint: boolean;
}

export function createInput(): InputState {
  return {
    forward: false,
    back: false,
    left: false,
    right: false,
    up: false,
    down: false,
    wPos: false,
    wNeg: false,
    vPos: false,
    vNeg: false,
    sprint: false,
  };
}

const KEY_MAP: Record<string, keyof InputState | undefined> = {
  KeyW: "forward",
  KeyS: "back",
  KeyA: "left",
  KeyD: "right",
  Space: "up",
    ShiftLeft: "down",
    ShiftRight: "down",
  KeyQ: "wNeg",
  KeyE: "wPos",
  KeyR: "vPos",
  KeyF: "vNeg",
  ControlLeft: "sprint",
  ControlRight: "sprint",
};

export class Controls {
  readonly input = createInput();
  pointerLocked = false;
  sensitivity = 0.0022;

  constructor(
    private canvas: HTMLCanvasElement,
    private onAction: (action: string) => void,
  ) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.canvas.addEventListener("click", this.onClick);
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    document.addEventListener("pointerlockchange", this.onLock);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("contextmenu", (e) => {
      if (this.pointerLocked) e.preventDefault();
    });
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("click", this.onClick);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    document.removeEventListener("pointerlockchange", this.onLock);
    document.removeEventListener("mousemove", this.onMouseMove);
  }

  private onLock = (): void => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  };

  private onClick = (): void => {
    if (!this.pointerLocked) this.canvas.requestPointerLock();
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (!this.pointerLocked) return;
    if (e.button === 0) this.onAction("select");
    if (e.button === 2) this.onAction("throw");
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.pointerLocked) return;
    this.onAction(`look:${e.movementX}:${e.movementY}`);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat && e.code !== "KeyQ" && e.code !== "KeyE" && e.code !== "KeyR" && e.code !== "KeyF") return;
    const mapped = KEY_MAP[e.code];
    if (mapped && this.pointerLocked) {
      this.input[mapped] = true;
      if (e.code === "Space") e.preventDefault();
    }

    if (!this.pointerLocked && e.code !== "Tab" && e.target instanceof HTMLInputElement) return;

    switch (e.code) {
      case "Tab":
        e.preventDefault();
        this.onAction("menu");
        break;
      case "KeyP":
        this.onAction("pause");
        break;
      case "Digit1":
        this.onAction("mode:perspective");
        break;
      case "Digit2":
        this.onAction("mode:orthographic");
        break;
      case "Digit3":
        this.onAction("mode:slice");
        break;
      case "Digit4":
        this.onAction("mode:combined");
        break;
      case "KeyT":
        this.onAction("grab");
        break;
      case "KeyX":
        this.onAction("drop");
        break;
      case "KeyG":
        this.onAction("gravity-panel");
        break;
      case "KeyH":
        this.onAction("help");
        break;
      case "KeyM":
        this.onAction("axes");
        break;
      case "KeyI":
        this.onAction("inspect");
        break;
      case "Delete":
      case "Backspace":
        if (this.pointerLocked) this.onAction("delete");
        break;
      case "KeyN":
        this.onAction("noclip");
        break;
      case "Digit0":
        this.onAction("reset");
        break;
      case "Equal":
      case "NumpadAdd":
        this.onAction("speed-up");
        break;
      case "Minus":
      case "NumpadSubtract":
        this.onAction("speed-down");
        break;
      case "KeyK":
        this.onAction("create-cube");
        break;
      case "KeyL":
        this.onAction("create-sphere");
        break;
      case "KeyO":
        this.onAction("create-penteract");
        break;
      case "KeyU":
        this.onAction("create-portal");
        break;
      case "Escape":
        if (this.pointerLocked) document.exitPointerLock();
        else this.onAction("menu");
        break;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const mapped = KEY_MAP[e.code];
    if (mapped) this.input[mapped] = false;
  };
}
