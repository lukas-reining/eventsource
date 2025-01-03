# Changelog

## [2.1.0](https://github.com/lukas-reining/eventsource/compare/v2.0.0...v2.1.0) (2025-01-03)


### Features

* include request in events ([#31](https://github.com/lukas-reining/eventsource/issues/31)) ([a39b908](https://github.com/lukas-reining/eventsource/commit/a39b908ff5f5302434bc666d8dc5e09b2c55f8f5))

## [2.0.0](https://github.com/lukas-reining/eventsource/compare/v1.7.0...v2.0.0) (2024-12-15)


### ⚠ BREAKING CHANGES

* remove deprecated extraOptions ([#28](https://github.com/lukas-reining/eventsource/issues/28))
* change credentials mode from "omit" to "same-origin" when set to false ([#27](https://github.com/lukas-reining/eventsource/issues/27))

### Bug Fixes

* change credentials mode from "omit" to "same-origin" when set to false ([#27](https://github.com/lukas-reining/eventsource/issues/27)) ([bf882f3](https://github.com/lukas-reining/eventsource/commit/bf882f3004f25b5742c6103662deedcf033bc890))


### Miscellaneous Chores

* remove deprecated extraOptions ([#28](https://github.com/lukas-reining/eventsource/issues/28)) ([5620280](https://github.com/lukas-reining/eventsource/commit/5620280009c2b1ef16cd1354de7cd248e1f6cc60))

## [1.7.0](https://github.com/lukas-reining/eventsource/compare/v1.6.4...v1.7.0) (2024-10-03)


### Features

* add request to events ([91fd2e4](https://github.com/lukas-reining/eventsource/commit/91fd2e43883a68af4bfd3b7333cde21ca4c8ba85))

## [1.6.4](https://github.com/lukas-reining/eventsource/compare/v1.6.3...v1.6.4) (2024-09-06)


### Bug Fixes

* link for globalThis.fetch ([b00a4f0](https://github.com/lukas-reining/eventsource/commit/b00a4f0f05763ff96bbff7a9ca8670268ea67b92))

## [1.6.3](https://github.com/lukas-reining/eventsource/compare/v1.6.2...v1.6.3) (2024-09-06)


### Bug Fixes

* link for globalThis.fetch ([8c71f2f](https://github.com/lukas-reining/eventsource/commit/8c71f2f8b0c1c30b0b9f6eb030094ddd2a764401))

## [1.6.2](https://github.com/lukas-reining/eventsource/compare/v1.6.1...v1.6.2) (2024-09-06)


### Bug Fixes

* do not run package publish twice ([640eb32](https://github.com/lukas-reining/eventsource/commit/640eb3293e6e2b95f675936c9f78f5086156db50))

## [1.6.1](https://github.com/lukas-reining/eventsource/compare/v1.6.0...v1.6.1) (2024-09-06)


### Bug Fixes

* add public flag to pipline publishing ([63f06b8](https://github.com/lukas-reining/eventsource/commit/63f06b83a00d1f9fa700e30f3201dbfc47da1d53))

## [1.6.0](https://github.com/lukas-reining/eventsource/compare/v1.5.2...v1.6.0) (2024-09-06)


### Features

* add jsdocs and deprecate old fetch parameter ([58a73b5](https://github.com/lukas-reining/eventsource/commit/58a73b563ccd6689f74717279005940b2fc1697e))

## [1.5.2](https://github.com/lukas-reining/eventsource/compare/v1.5.1...v1.5.2) (2024-09-06)


### Bug Fixes

* bind custom fetch to globalThis ([1cb0504](https://github.com/lukas-reining/eventsource/commit/1cb050410f14a616b8471d90d22b207c5ab5fef4))

## 1.5.1 (2024-09-06)


### Features

* add custom loggers ([14c16b6](https://github.com/lukas-reining/eventsource/commit/14c16b6ad4033b16f96da4df8f1529bca2c01b2e))


### Bug Fixes

* add module type to package.json and use correct file ending for cjs ([f07ee9b](https://github.com/lukas-reining/eventsource/commit/f07ee9b6735c42844eb0112b82e47be70789aa7d))
* broken import in readme ([eaa57db](https://github.com/lukas-reining/eventsource/commit/eaa57dbc64dadae525f0aa848546f9b8201ff0ed))
* bump version to 1.4.5 ([7c3a1a8](https://github.com/lukas-reining/eventsource/commit/7c3a1a82f40feb5191b5f9cab21a9e475708b219))
* empty message yielded after only seeing a comment ([ad8eb89](https://github.com/lukas-reining/eventsource/commit/ad8eb89b52cf6ae98338638af91faf6ceb20b247))
* misleading error message ([bcd1bbd](https://github.com/lukas-reining/eventsource/commit/bcd1bbd299828a9bda27c3e395f7318a7d5fece1))
* **package:** define exports ([48d581d](https://github.com/lukas-reining/eventsource/commit/48d581da368b9c9a444de382f42bbcfa16688a8c))
* release version with exports ([ce4c1d5](https://github.com/lukas-reining/eventsource/commit/ce4c1d568f64e6491ba1cf1363d91dfdf515f0b3))
* stop reconnecting if the eventsource is closed ([c294aae](https://github.com/lukas-reining/eventsource/commit/c294aae4bb7562db50ff7ee5e8e71a079f08c5ae))
