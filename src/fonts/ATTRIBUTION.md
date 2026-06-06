# Legend fonts

Fonts are stored as three.js `typeface.json` data. The decorative faces were
converted from their original TrueType files with three.js's `TTFLoader` and
**subset to the characters a legend needs** (Latin letters, digits and common
punctuation) to keep bundle size small. Each is lazy-loaded as its own chunk
and only fetched when selected.

| File                        | Font            | Copyright / Author                                   | License |
|-----------------------------|-----------------|------------------------------------------------------|---------|
| `helvetiker.typeface.json`  | Helvetiker      | typeface.js (bundled with three.js examples)         | Free for commercial use (see three.js `examples/fonts`) |
| `optimer.typeface.json`     | Optimer         | typeface.js (bundled with three.js examples)         | Free for commercial use (see three.js `examples/fonts`) |
| `pirata.typeface.json`      | Pirata One      | Copyright (c) Rodrigo Fuenzalida & Nicolás Massi     | SIL OFL 1.1 |
| `bungee.typeface.json`      | Bungee          | Copyright (c) The Bungee Project Authors (David Jonathan Ross) | SIL OFL 1.1 |
| `rye.typeface.json`         | Rye             | Copyright (c) 2011 Sorkin Type Co                    | SIL OFL 1.1 |
| `bangers.typeface.json`     | Bangers         | Copyright (c) The Bangers Project Authors (Vernon Adams) | SIL OFL 1.1 |
| `bevan.typeface.json`       | Bevan           | Copyright (c) The Bevan Project Authors (Vernon Adams) | SIL OFL 1.1 |
| `creepster.typeface.json`   | Creepster       | Copyright (c) Sideshow / The Creepster Project Authors | SIL OFL 1.1 |
| `specialelite.typeface.json`| Special Elite   | Copyright (c) Astigmatic (AOETI)                     | Apache License 2.0 |
| `pressstart.typeface.json`  | Press Start 2P  | Copyright (c) CodeMan38 (Cody Boisclair)             | SIL OFL 1.1 |

The full text of the SIL Open Font License, Version 1.1 is in `OFL.txt`. It
applies to every font marked "SIL OFL 1.1" above. The "Reserved Font Name"
clause means the converted/subset data here is not distributed under the
original font names as installable system fonts. Special Elite is distributed
under the Apache License 2.0 (https://www.apache.org/licenses/LICENSE-2.0).
