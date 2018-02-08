import * as fs from 'fs-extra';
import * as path from 'path';
import * as tempy from 'tempy';
import { expect } from 'chai';

import * as galactus from '../src';

async function moduleExists(modulePath: string) {
  return fs.pathExists(path.join(modulePath, 'package.json'));
}

describe('DestroyerOfModules', () => {
  describe('no rootDirectory or walker', () => {
    const creator = () => new galactus.DestroyerOfModules({});

    it('should throw an error', () => {
      expect(creator).to.throw(/Must either provide rootDirectory or walker argument/);
    });
  });

  describe('valid package', () => {
    let tempDir: string;
    let tempPackageDir: string;
    let nodeModulesPath: string;

    function appropriateDependenciesExist(description: string, prefix: string) {
      describe(description, () => {
        it('keeps production dependencies', async () => {
          expect(await moduleExists(path.join(nodeModulesPath, `${prefix}-prod`))).to.be.true;
        });

        it('keeps optional dependencies', async () => {
          expect(await moduleExists(path.join(nodeModulesPath, `${prefix}-optional`))).to.be.true;
        });

        it('prunes devDependencies', async () => {
          expect(await moduleExists(path.join(nodeModulesPath, '${prefix}-dev'))).to.be.false;
        });
      });
    }

    function appropriateDependencyClassesExist() {
      appropriateDependenciesExist('direct dependencies', 'test');
      appropriateDependenciesExist('indirect dependencies', 'dep');
      appropriateDependenciesExist('scoped dependencies', '@scoped/scoped');
    }

    beforeEach(async () => {
      tempDir = tempy.directory();
      tempPackageDir = path.join(tempDir, 'package');
      nodeModulesPath = path.join(tempPackageDir, 'node_modules');

      await fs.copy(path.join(__dirname, 'fixtures', 'package'), tempPackageDir);
      await fs.rename(path.join(tempPackageDir, '_node_modules'), nodeModulesPath);
    });

    describe('rootDirectory only specified', () => {
      beforeEach(async () => {
        const destroyer = new galactus.DestroyerOfModules({
          rootDirectory: tempPackageDir
        });
        await destroyer.destroy();
      });

      appropriateDependencyClassesExist();
    });

    describe('specify walker', () => {
      beforeEach(async () => {
        const walker = new galactus.Walker(tempPackageDir);
        const destroyer = new galactus.DestroyerOfModules({
          walker: walker,
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

      it('should delete node_modules', async () => {
        // node_modules is deleted because it's the root Module in the walked tree
        expect(await fs.pathExists(nodeModulesPath)).to.be.false;
      });
    });

    afterEach(async () => {
      await fs.remove(tempDir);
    });
  });
});
