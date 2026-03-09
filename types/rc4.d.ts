declare module "rc4" {
  export default class RC4 {
    constructor(key: number[]);
    randomByte(): number;
  }
}
