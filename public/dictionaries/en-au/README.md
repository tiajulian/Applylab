# AU English dictionary (vendored)

`en-au.aff` and `en-au.dic` are the raw Hunspell affix/dictionary files from
[`dictionary-en-au@3.0.0`](https://www.npmjs.com/package/dictionary-en-au), copied here as static
assets because that package reads its files via Node's `fs/promises` at import time and can't run
in a browser bundle. See `lib/text/spellcheck.ts` for how they're fetched and fed into `nspell`.

`dictionary-en-au` stays a real `package.json` dependency purely so this provenance is traceable
and pinned - it is never imported by application code.

To refresh after bumping the package version:

```sh
npm install dictionary-en-au@<new-version>
cp node_modules/dictionary-en-au/index.aff public/dictionaries/en-au/en-au.aff
cp node_modules/dictionary-en-au/index.dic public/dictionaries/en-au/en-au.dic
```
