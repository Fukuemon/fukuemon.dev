// Go の lib/wasm/wasm_exec.js の、使う部分だけの型。wasm_exec.js は Go のものをそのままコミットする
declare global {
  class Go {
    importObject: WebAssembly.Imports;
    exit: (code: number) => void;
    run(instance: WebAssembly.Instance): Promise<void>;
  }
  var fs: { writeSync: (fd: number, buf: Uint8Array) => number };
  var goRunnerInput: string;
}

export {};
