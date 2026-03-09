declare module "speed-limiter" {
  import { Transform } from "stream";

  export default class SpeedLimiter extends Transform {
    constructor(options?: { bytesPerSecond?: number });

    setSpeed(bytesPerSecond: number): void;
    getSpeed(): number;
  }
}
