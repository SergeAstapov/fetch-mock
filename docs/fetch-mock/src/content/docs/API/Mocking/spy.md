---
title: '.spy(matcher)'
sidebar:
  label: .spy()
  order: 4
---

Records call history while passing each call on to `fetch` to be handled by the network. Optionally pass in a `matcher` to scope this to only matched calls, e.g. to fetch a specific resource from the network.

To use `.spy()` on a sandboxed `fetchMock`, `fetchMock.config.fetch` must be set to the same `fetch` implementation used in your application. [See how to configure this](#usagecustom-classes). By default this will be the locally installed version of `node-fetch`
