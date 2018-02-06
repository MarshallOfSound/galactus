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

      describe('direct dependencies', () => {
        it('keeps production dependencies', async () => {
          expect(await moduleExists(path.join(nodeModulesPath, 'test-prod'))).to.be.true;
        });

        it('keeps optional dependencies', async () => {
          expect(await moduleExists(path.join(nodeModulesPath, 'test-optional'))).to.be.true;
        });

        it('prunes devDependencies', async () => {
          expect(await moduleExists(path.join(nodeModulesPath, 'test-dev'))).to.be.false;
        });
      });

      describe('indirect dependencies', () => {
        it('keeps production dependencies', async () => {
          expect(await moduleExists(path.join(nodeModulesPath, 'dep-prod'))).to.be.true;
        });

        it('keeps optional dependencies', async () => {
          expect(await moduleExists(path.join(nodeModulesPath, 'dep-optional'))).to.be.true;
        });

        it('prunes devDependencies', async () => {
          expect(await moduleExists(path.join(nodeModulesPath, 'dep-dev'))).to.be.false;
        });
      });

      describe('scoped dependencies', () => {
        it('keeps production dependencies', async () => {
          expect(await moduleExists(path.join(nodeModulesPath, '@scoped/scoped-prod'))).to.be.true;
        });

        it('keeps optional dependencies', async () => {
          expect(await moduleExists(path.join(nodeModulesPath, '@scoped/scoped-optional'))).to.be.true;
        });

        it('prunes devDependencies', async () => {
          expect(await moduleExists(path.join(nodeModulesPath, '@scoped/scoped-dev'))).to.be.false;
        });
      });
    });

    afterEach(async () => {
      await fs.remove(tempDir);
    });
  });
});
