declare module "debug" {
  const debug: {
    (namespace: string): debug.Debugger;
    default: debug.Debugger;
    coerce: (val: any) => any;
    disable: () => void;
    enable: (namespaces: string) => void;
    enabled: (namespaces: string) => boolean;
    formatArgs: (...args: any[]) => void;
    humanize: any;
    log: (...args: any[]) => any;
    names: string[];
    skips: string[];
    useColors: () => boolean;
  };

  namespace debug {
    interface Debugger {
      (...args: any[]): void;
      color: string;
      enabled: boolean;
      log: (...args: any[]) => any;
      namespace: string;
      destroy: () => boolean;
      extend: (namespace: string, delimiter?: string) => Debugger;
    }
  }

  export = debug;
}
