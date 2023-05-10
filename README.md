<h1 align="center">hyper-adapter-sqlite</h1>
<p align="center">A cache adapter for hyper</p>
<p align="center">
  <a href="https://nest.land/package/hyper-adapter-sqlite"><img src="https://nest.land/badge.svg" alt="Nest Badge" /></a>
  <a href="https://github.com/hyper63/hyper-adapter-sqlite/actions/workflows/test-and-publish.yml"><img src="https://github.com/hyper63/hyper-adapter-sqlite/actions/workflows/test-and-publish.yml/badge.svg" alt="Test" /></a>
  <a href="https://github.com/hyper63/hyper-adapter-sqlite/tags/"><img src="https://img.shields.io/github/tag/hyper63/hyper-adapter-sqlite" alt="Current Version" /></a>
</p>

---

## Table of Contents

- [Getting Started](#getting-started)
- [Installation](#installation)
- [Features](#features)
- [Methods](#methods)
- [Contributing](#contributing)
- [License](#license)

---

Welcome to the sqlite hyper adapter for the cache port, a cache allows you to store key,value pairs
where the key is a unique string and the value is a JSON document. Using this simple pattern, you
can store highly accessible data for lighting fast reading.

Add the cache adapter to your hyper config

```js
import { default as sqlite } from 'https://x.nest.land/hyper-adapter-sqlite/mod.js'

export default {
  app: opine,
  adapter: [
    {
      port: 'cache',
      plugins: [sqlite({ dir: '/tmp' })],
    },
  ],
}
```

## Installation

This is a Deno module available to import from
[nest.land](https://nest.land/package/hyper-adapter-sqlite)

deps.js

```js
export { default as sqlite } from 'https://x.nest.land/hyper-adapter-sqlite/mod.js'
```

## Features

- Create a named store in `sqlite`
- Destroy a named store in `sqlite`
- Create a document in a store in `sqlite`
- Get a document from a store in `sqlite`
- Update a document in a store in `sqlite`
- Delete a document from a store in `sqlite`
- List documents in a sttore in `sqlite`

## Methods

This adapter fully implements the Cache port and can be used as the
[hyper Cache service](https://docs.hyper.io/cache-api) adapter

See the full port [here](https://nest.land/package/hyper-port-cache)

## Contributing

Contributions are welcome! See the hyper
[contribution guide](https://docs.hyper.io/contributing-to-hyper)

## Testing

```
./scripts/test.sh
```

To lint, check formatting, and run unit tests

## License

Apache-2.0
