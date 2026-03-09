declare module "mime/lite.js" {
  export function getType(path: string): string | null;
  export function getExtension(mime: string): string | null;
  export function define(
    mimes: { [key: string]: string[] },
    force?: boolean,
  ): void;
}
