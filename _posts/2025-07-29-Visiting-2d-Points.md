---
layout: post
title:  "Visiting 2d Points"
date:   2025-07-29
categories:
---

Let's say you have a CNC machine of some kind and a list of 2d points the machine needs to visit and want to determine what order to visit the points in. Given the freedom to visit the points in any order, we probably want to visit them in a way that minimizes the total distance traveled. This is the classic traveling salesman problem (which in my memory was for a given graph, but apparently it is for the complete graph ie. you can move between every point). Because of its NP-hardness, we can ignore trying to get _the_ optimal solution and instead focus on how to get pretty good solutions. And it would also be nice if we could operate on a large number of points, so ideally avoid computing every pairwise distance.

I had implemented some version of this many years ago for pen plotter gcode generation from an SVG. Recently I was thinking about this again and came up with a better idea that is fairly simple. I couldn't easily find something exactly like it so thought I'd write it down.

Divide the points into `B` bands/stripes in the y direction and visit them alternating from left-to-right and right-to-left. Complexity is O(n logn) because we only ever sort.

What value of `B` to use? One cheesy way to answer this is to try a bunch of values and measure the cost and return the least. Or iterate starting at `B=1` and stopping when the cost starts going up. This is a bit unsatisfying because we have to do the sort a bunch of times and either copy to try the next `B` or redo the winning `B` at the end.

My heuristic to find the right `B` without doing the sort is to estimate the cost. If we have `P` points lying in a bounding box of size `(xspan, yspan)`  and we use `B` bands, the average or expected distance between points within a band is `yspan/B/2` (ie. half the length of the band's height) in y and `xspan/P/B` (ie. each band has `P/B` points in it and they are evenly spaced across the width) in x. The final cost is then `(yspan/B/2)**2 + (xspan/P/B) ** 2`; we can skip the `sqrt` and multiplying by `P`. This quadratic equation is solvable [wolfram](https://www.wolframalpha.com/input?i=solve+for+B%3A+c+%3D+%28y%2FB%2F2%29**2+%2B+%28x%2FP%2FB%29+**+2), but we need an integer solution and empirically it is simple enough to iterate from `B=1` and it will decrease until we hit a minimum. From my brief testing, this cost is an over-approximation (ie. the best `B` will be less than the computed `B`) especially when points tend to be clustered at all since the cost is computed under the assumption that points are uniformly distributed.

One extra thing you might do is handle the case of different aspect ratios, where a short and wide bounding box (bbox) might do well with our Y bands and a tall and narrow bbox would want X bands. But by computing the number of bands, we actually do pretty well to only use Y bands and for a tall and narrow bbox, we will just have more bands.

Here's a little plot of some test cases with different algorithms (strat). It includes the networkx christofides approximation for TSP which is O(n^2) for constructing the graph and O(n^3) for execution. The js one looks slow because it includes total process execution time. [gist here](https://gist.github.com/aconz2/210b3a805759aa630ca1daaf2a3bd3bb)

<img src="/images/visiting-2d-points.svg" />

And two implementations in python and js (in place).

```python
# public domain or Unlicense or MIT licensed

import numpy as np

def sort_points(points, bands=None):
    if bands is None:
        bands = compute_bands(points)
    ymin = points[:, 1].min()
    ymax = points[:, 1].max()
    yspan = ymax - ymin
    yspan += 1  # this forces the ymax point into the last band with the others
    def key(xy):
        x, y = xy
        band = int(np.floor((y - ymin) / yspan * bands))
        if band % 2 == 1:
            x *= -1
        # tie break those in the same band with the same x by increasing y
        return band, x, y

    return np.array(sorted(points, key=key))

def compute_bands(points):
    xmin = points[:, 0].min()
    xmax = points[:, 0].max()
    ymin = points[:, 1].min()
    ymax = points[:, 1].max()
    yspan = ymax - ymin
    xspan = xmax - xmin
    P = len(points)
    bs = np.arange(1, 20)
    p = P / bs
    l = yspan / bs
    c = (l/2) ** 2 + (xspan/p) ** 2

    bands = bs[np.argmin(c)]
    return sort_points(points, bands=bands)

```

```js
// public domain or Unlicense or MIT licensed

// operates in place
function sortPoints(points) {
    let bb = bbox(points);
    let bands = numberOfBands(points, bb);
    sortYbandsX(points, bb, bands);
}

function sortYbandsX(points, bbox, bands) {
    let [_1, _2, ymin, ymax] = bbox;
    let yspan = ymax - ymin + 1;
    let band = (p) => Math.floor((p.y - ymin) / yspan * bands);
    let cmp = (a, b) => {
        let band_a = band(a);
        let band_b = band(b);
        if (band_a < band_b) return -1;
        if (band_a > band_b) return 1;
        // bands are equal, sort ltr on even bands and rtl on odd bands
        let sign = band_a % 2 === 0 ? 1 : -1;
        if (a.x < b.x) return sign * -1;
        if (a.x > b.x) return sign * 1;
        // if x's are equal, sort by y
        return a.y - b.y;

    };
    points.sort(cmp);
    return points;
}

function numberOfBands(points, bbox) {
    const maxBands = 20;
    let [xmin, xmax, ymin, ymax] = bbox;
    let bestScore = Infinity;
    let P = points.length;
    let xspan = xmax - xmin;
    let yspan = ymax - ymin;
    for (let b = 1; b < maxBands; b++) {
        let p = P / b;
        let h = yspan / b;
        let w = xspan / p;
        let c = Math.pow(h/2, 2) + Math.pow(w, 2);
        if (c > bestScore) return b - 1;
        bestScore = c;
    }
    return maxBands;
}

function bbox(points) {
    return points.reduce(
        ([xmin, xmax, ymin, ymax], p) => [
            Math.min(xmin, p.x),
            Math.max(xmax, p.x),
            Math.min(ymin, p.y),
            Math.max(ymax, p.y),
        ],
        [Infinity, -Infinity, Infinity, -Infinity]
    );
}
```
