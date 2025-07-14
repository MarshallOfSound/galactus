import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import * as galactus from '../dist/index.js';

async function moduleExists(modulePath: string) {
  try {
    await fs.access(path.join(modulePath, 'package.json'));
  } catch {
    return false;
  }
  return true;
}

describe('DestroyerOfModules', () => {
  describe('no rootDirectory or walker', () => {
    const creator = () => new galactus.DestroyerOfModules({});

    it('should throw an error', () => {
      expect(creator).toThrow(/Must either provide rootDirectory or walker argument/);
    });
  });

  describe('valid package', () => {
    let tempDir: string;
    let tempPackageDir: string;
    let nodeModulesPath: string;

    function appropriateDependenciesExist(description: string, prefix: string) {
      describe(description, () => {
        it('keeps production dependencies', async () =>
          expect(await moduleExists(path.join(nodeModulesPath, `${prefix}-prod`))).toBe(true));

        it('keeps optional dependencies', async () =>
          expect(await moduleExists(path.join(nodeModulesPath, `${prefix}-optional`))).toBe(true));

        it('prunes devDependencies', async () =>
          expect(await moduleExists(path.join(nodeModulesPath, '${prefix}-dev'))).toBe(false));
      });
    }

    function appropriateDependencyClassesExist() {
      appropriateDependenciesExist('direct dependencies', 'test');
      appropriateDependenciesExist('indirect dependencies', 'dep');
      appropriateDependenciesExist('scoped dependencies', '@scoped/scoped');
    }

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.resolve(os.tmpdir(), 'galactus-spec-'));
      tempPackageDir = path.join(tempDir, 'package');
      nodeModulesPath = path.join(tempPackageDir, 'node_modules');

      await fs.cp(
        path.join(new URL('.', import.meta.url).pathname, 'fixtures', 'package'),
        tempPackageDir,
        {
          recursive: true,
        },
      );
      await fs.rename(path.join(tempPackageDir, '_node_modules'), nodeModulesPath);
    });

    describe('rootDirectory only specified', () => {
      beforeEach(async () => {
        const destroyer = new galactus.DestroyerOfModules({
          rootDirectory: tempPackageDir,
        });
        await destroyer.destroy();
      });

      appropriateDependencyClassesExist();
    });

    describe('specify walker', () => {
      beforeEach(async () => {
        const walker = new galactus.Walker(tempPackageDir);
        const destroyer = new galactus.DestroyerOfModules({
          walker,
        });
        await destroyer.destroy();
      });

      appropriateDependencyClassesExist();
    });

    describe('specify shouldKeepModuleTest', () => {
      beforeEach(async () => {
        const destroyer = new galactus.DestroyerOfModules({
          rootDirectory: tempPackageDir,
          shouldKeepModuleTest: (_module: galactus.Module, _isDevDep: boolean) => false,
        });
        await destroyer.destroy();
      });

      it('should delete node_modules', async () =>
        // node_modules is deleted because it's the root Module in the walked tree
        expect(await moduleExists(nodeModulesPath)).toBe(false));
    });

    describe('relativePaths for collectKeptModules', () => {
      let moduleMap: galactus.ModuleMap;
      beforeEach(async () => {
        const destroyer = new galactus.DestroyerOfModules({
          rootDirectory: tempPackageDir,
        });
        moduleMap = await destroyer.collectKeptModules({ relativePaths: true });
      });

      it('should use relative paths', () =>
        expect(moduleMap.has(path.join('node_modules', 'dep-prod'))).toBe(true));
    });

    describe('relativePaths for collectKeptModules with a relative root directory', () => {
      let moduleMap: galactus.ModuleMap;
      let oldCurrentDir: string;
      beforeEach(async () => {
        oldCurrentDir = process.cwd();
        process.chdir(tempPackageDir);
        const destroyer = new galactus.DestroyerOfModules({
          rootDirectory: '.',
        });
        moduleMap = await destroyer.collectKeptModules({ relativePaths: true });
      });

      it('should use relative paths', () =>
        expect(moduleMap.has(path.join('node_modules', 'dep-prod'))).toBe(true));

      afterEach(() => {
        process.chdir(oldCurrentDir);
      });
    });

    afterEach(async () => {
      await fs.rm(tempDir, {
        recursive: true,
        force: true,
      });
    });
  });
});
