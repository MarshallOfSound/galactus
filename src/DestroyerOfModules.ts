import * as fs from 'fs-extra';
import * as path from 'path';

import { DepType, Module, Walker } from 'flora-colossus';

export type ShouldKeepModuleTest = (module: Module, isDevDep: boolean) => boolean;

export class DestroyerOfModules {
  private walker: Walker;
  private shouldKeepFn: ShouldKeepModuleTest;

  constructor({
    rootDirectory,
    walker,
    shouldKeepModuleTest,
  }: {
    rootDirectory?: string;
    walker?: Walker;
    shouldKeepModuleTest?: ShouldKeepModuleTest,
  }) {
    if (rootDirectory) {
      this.walker = new Walker(rootDirectory);
    } else if (walker) {
      this.walker = walker;
    } else {
      throw new Error('Must either provide rootDirectory or walker argument');
    }
    if (shouldKeepModuleTest) {
      this.shouldKeepFn = shouldKeepModuleTest;
    }
  }

  private shouldKeepModule(module: Module) {
    const isDevDep = module.depType === DepType.DEV;
    const shouldKeep = this.shouldKeepFn ? this.shouldKeepFn(module, isDevDep) : !isDevDep;
    return shouldKeep;
  }

  async destroyModule(modulePath: string, moduleMap: {
    [path: string]: Module
  }) {
    const module = moduleMap[modulePath];
    if (module && this.shouldKeepModule(module)) {
      const nodeModulesPath = path.resolve(modulePath, 'node_modules');
      if (!await fs.pathExists(nodeModulesPath)) return;

      for (const subModuleName of await fs.readdir(nodeModulesPath)) {
        if (subModuleName.startsWith('@')) {
          for (const subScopedModuleName of await fs.readdir(path.resolve(nodeModulesPath, subModuleName))) {
            await this.destroyModule(
              path.resolve(nodeModulesPath, subModuleName, subScopedModuleName),
              moduleMap,
            );
          }
        } else {
          await this.destroyModule(
            path.resolve(nodeModulesPath, subModuleName),
            moduleMap,
          );
        }
      }
    } else {
      await fs.remove(modulePath);
    }
  }

  async destroy() {
    const modules = await this.walker.walkTree();
    const moduleMap: {
      [path: string]: Module
    } = {};
    for (const module of modules) {
      moduleMap[module.path] = module;
    }
    await this.destroyModule(this.walker.getRootModule(), moduleMap);
  }
}
