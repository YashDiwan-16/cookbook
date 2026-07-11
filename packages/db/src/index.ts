import { env } from "@cookbook/env/server";

const processWithBuiltinModule = globalThis.process as
  | {
      getBuiltinModule?: (moduleName: string) => unknown;
    }
  | undefined;
const originalGetBuiltinModule = processWithBuiltinModule?.getBuiltinModule?.bind(processWithBuiltinModule);

if ("Bun" in globalThis && processWithBuiltinModule && originalGetBuiltinModule) {
  processWithBuiltinModule.getBuiltinModule = (moduleName: string) => {
    if (moduleName === "v8") return undefined;
    return originalGetBuiltinModule(moduleName);
  };
}

const { default: mongoose } = await import("mongoose");

await mongoose.connect(env.DATABASE_URL);

const client = mongoose.connection.getClient().db();

export { client };
