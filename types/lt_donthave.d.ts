declare module "lt_donthave" {
  import { EventEmitter } from "events";

  export default class LTDonthave extends EventEmitter {
    constructor(wire: any);

    on(event: "donthave", listener: (index: number) => void): this;
    on(event: "warning", listener: (err: Error) => void): this;

    dontHave(index: number): void;
    reset(): void;
  }
}
