declare module "minimist" {
  interface MinimistOptions {
    string?: string | string[];
    boolean?: string | string[];
    alias?: { [key: string]: string | string[] };
    default?: { [key: string]: any };
    stopEarly?: boolean;
    "--"?: boolean;
    unknown?: (arg: string) => boolean;
  }

  interface ParsedArgs {
    [key: string]: any;
    _: string[];
  }

  function minimist(argv: string[], opts?: MinimistOptions): ParsedArgs;

  export = minimist;
}
