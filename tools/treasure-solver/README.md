# Hidden Treasure Pattern Finder v4

Open `index.html` in your browser.

## Features

- Manual square clicking.
- Exact optimal generator mode.
- Pretty guarantee mode.
- Greedy fast mode.
- Random sample mode.
- Step-by-step greedy mode.
- Green/red placement coverage overlay.
- Stable hover info panel.
- Mode comparison.

## Exact optimal mode

Exact optimal searches for the smallest number of clicks that reaches the target coverage. It uses BigInt bitmasks and pruning. If a custom case is too large and the search risks freezing the browser, it returns the best known greedy solution instead.


## v5 step optimal

- The Step button now follows the selected generator mode.
- If Generator mode is `Exact optimal`, Step places one square from the exact optimal solution at a time.
- If Generator mode is `Pretty guarantee`, Step places the clean periodic pattern one square at a time.
- Other modes keep using greedy stepping.
