type ProcessWithBuiltinModule = {
  getBuiltinModule?: (moduleName: string) => unknown;
};

const runtimeGlobal = globalThis as {
  Bun?: unknown;
  process?: ProcessWithBuiltinModule;
};
const runtimeProcess = runtimeGlobal.process;
const originalGetBuiltinModule: ((moduleName: string) => unknown) | undefined =
  runtimeProcess?.getBuiltinModule?.bind(runtimeProcess);

if (runtimeGlobal.Bun && runtimeProcess && originalGetBuiltinModule) {
  runtimeProcess.getBuiltinModule = (moduleName: string) => {
    if (moduleName === "v8") return undefined;
    return originalGetBuiltinModule(moduleName);
  };
}

export {};
