// A little of everything TypeScript colours differently.
class EventEmitter {
  emit(event: string, ...args: unknown[]): boolean {
    return args.length > 0 && event !== "";
  }
}

// Deliberate type error, for squiggles and the Problems panel.
const retries: number = "three";

export enum Mode {
  Idle = "idle",
  Flashing = "flashing",
}

export interface Board<T extends object = {}> {
  readonly id: string;
  serial?: number;
  meta: T;
}

@sealed
export class Flasher<T extends object> extends EventEmitter {
  static readonly TIMEOUT_MS = 5_000;
  #progress = 0;

  constructor(private readonly board: Board<T>) {
    super();
  }

  async flash(hex: Uint8Array, mode: Mode = Mode.Flashing): Promise<boolean> {
    const pattern = /^:[0-9A-F]{2}/i;
    for (let i = 0; i < hex.length; i += 64) {
      this.#progress = Math.round((i / hex.length) * 100);
      this.emit("progress", `${this.board.id}: ${this.#progress}%`);
    }
    return pattern.test("ok") && mode !== Mode.Idle;
  }
}

function sealed(constructor: Function): void {
  Object.seal(constructor);
}
