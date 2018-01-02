Galactus
-----------

> A JS implementation of `prune --production`

## Installation

```bash
npm i --save-dev galactus
```

## API

### Class: `DestroyerOfModules`

```js
import { DestroyerOfModules } from 'galactus';

// modulePath is the root folder of your module
const destroyer = new DestroyerOfModules({
  rootDirectory: __dirname,
  // Optionally provide your own walker from 'flora-colossus'
  walker: myWalker,
  // Optionally provide a method to override the default
  // keep or destroy test
  shouldKeepModuleTest: (module, isDepDep) => true,
});
```

#### `destroyer.destroy()`

Returns a `Promise` that resolves once the destruction is complete. By default
it will destroy all dependencies that aren't required for production or
optional dependencies. You can override this behavior by providing a
`shouldKeepModuleTest` function in the constructor.