import * as fs from 'fs-extra';
import * as path from 'path';

import { DepType, Module, Walker } from 'flora-colossus';

export type ShouldKeepModuleTest = (module: Module, isDevDep: boolean) => boolean;

export type ModuleMap = Map<string, Module>;

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

  public async destroyModule(modulePath: string, moduleMap: ModuleMap) {
    const module = moduleMap.get(modulePath);
    if (module) {
      const nodeModulesPath = path.resolve(modulePath, 'node_modules');
      if (!await fs.pathExists(nodeModulesPath)) {
        return;
      }

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

  public async collectKeptModules({ relativePaths = false }: { relativePaths: boolean }): Promise<ModuleMap> {
    const modules = await this.walker.walkTree();
    const moduleMap: ModuleMap = new Map();
    for (const module of modules) {
      if (this.shouldKeepModule(module)) {
        let modulePath = module.path;
        if (relativePaths) {
          modulePath = modulePath.replace(`${this.walker.getRootModule()}${path.sep}`, '');
        }
        moduleMap.set(modulePath, module);
      }
    }

    return moduleMap;
  }

  public async destroy() {
    await this.destroyModule(this.walker.getRootModule(), await this.collectKeptModules({ relativePaths: false }));
  }

  private shouldKeepModule(module: Module) {
    const isDevDep = module.depType === DepType.DEV;
    const shouldKeep = this.shouldKeepFn ? this.shouldKeepFn(module, isDevDep) : !isDevDep;
    return shouldKeep;
  }
}
