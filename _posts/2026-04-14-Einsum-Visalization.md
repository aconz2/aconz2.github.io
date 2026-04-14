---
layout: post
title:  "Einsum Visalization"
date:   2026-04-14
categories:
---

The `einsum` function in [numpy](https://numpy.org/doc/stable/reference/generated/numpy.einsum.html#numpy-einsum), [jax](https://docs.jax.dev/en/latest/_autosummary/jax.numpy.einsum.html) or [pytorch](https://docs.pytorch.org/docs/stable/generated/torch.einsum.html#torch-einsum) is a compact way of describing tensor operations which involve pairing up values, multiplying the pairs, and summing their products. The two operations `dot` and `matmul` can be written in einsum notation as `i,i->` and `mn,no->mo` respectively. These strings assign letters to the dimensions of each input and output. Repeated letters from the input must match in length because those are the indices from which the pairs are generated. `dot` is slightly special here because it returns a scalar so its output dimension is empty. Matrix multiplication clearly shows the shape relationship where the number of columns of the first (ie. length of row) and the number of rows of the second (ie. length of column) must match so that we can form the output by taking the dot product of the `i`th row and `j`th column.

The einsum expression also tells us where to put these sum of products in the output tensor: at each cell of the output we assign the indices to their symbolic letters, substitute them in the input expression, and any free (non-substituted) letters must be iterated over, multiplied, and summed. For example, in `matmul`

```
let m=4 n=3 o=2
mn,no->mo

at m=0 o=0: mn,no -> 0n,n0 -> c[0, 0] = sum(a[0, i] * b[i, 0] for i in range(n))
...
at m=3 o=1: mn,no -> 3n,n1 -> c[3, 1] = sum(a[3, i] * b[i, 1] for i in range(n))
```

The real utility of this notation comes from tensors/nd-arrays of higher dimension. For example, it is common to use `einsum` in an attention block to compute the QKV values as seen [here](https://github.com/google-deepmind/gemma/blob/ae84d95268c506d981928054383e239f33d39b42/gemma/gm/nn/gemma4/_modules.py#L254) in gemma4. To compute the queries, the expression is

```
B = batch size
T = sequence len
D = embedding dim
N = num query heads
H = head dim
K = num kv heads
C = constant 2

first arg: input
second arg: Q/KV

queries: BTD,NDH->BTNH
keys+values: BSD,CKDH->CBSKH
```

Gemma4 is slightly more complicated than a more vanilla MHA block because the number of query heads and kv heads don't have to match. The constant 2 shape `C` is there because we do one operation for keys and one for values. In a more vanilla MHA where `N == K`, we could do it in one expression where `C = 3`. In both cases, the missing dimension on the output side is `D` which tells us we are taking the dot product of each token with the corresponding dimension in the second argument.

I really wanted to visualize examples of `einsum` to see how each output cell is produced, so I made a thing. I have some premade examples below but you can update the expression and shapes and update to visualize the output.

I am drawing the tensors as repeated rows and columns. A 3-tensor could be displayed in 3d and might be the most intuitive for volumetric things, but beyond that we're stuck so I've stuck to 2d. One way to think of 4-tensor is as a sudoku, which is a 3x3 grid of 3x3 cells; it has shape `3,3,3,3`. I stick to the convention that a 1-tensor is `cols` 2-tensor is `rows,cols`, a 3-tensor is `c1,r0,c0`, 4-tensor is `r1,c1,r0,c0` etc. This puts the rightmost two indices as the "2d matrix" which gets repeated and we grow leftwards alternating rows and columns. For odd dimensioned tensors, I draw them as if a `1` was inserted like `1,c1,r0,c0` so each `r0,c0` matrix is repeated `c1` times horizontally (as columns) in a single row.

Hover over each output cell to show which input cells are multiplied and summed. The input cells have one or more of their indices underlined which come from the repeated dimension. Cells with matching underlined indices will get multiplied together.

Note that I didn't implement a) scalar output b) implicit mode c) repeated indices d) ellipsis

<style>
svg {
    margin-top: 10px;
    shape-rendering: crispEdges;
}

svg rect {
    pointer-events: visible;
    fill: none;
}

svg text,tspan {
    pointer-events: none;
}

svg text {
    text-anchor: middle;
}

@media (prefers-color-scheme: dark) {
    text {
       fill: white;
    }
}

@media (prefers-color-scheme: light) {
    text {
       fill: black;
    }
    rect {
        stroke-width: 2;
    }
}

svg tspan.shared-index {
    text-decoration: underline;
}

svg .hide {
    visibility: hidden;
}

.controls input {
    font-family: monospace;
}

.overflow {
    width: 100%;
    overflow-x: scroll;
}

hr {
    margin-bottom: 20px;
}
</style>

### Matrix Multiplication

<div class="overflow" id="ex1"></div>

---

### KV MHA Attention

You can increase the shape from 2 to 3 for QKV but the output gets a bit big. This example shows 3 tokens with an embedding dimension of 8, 4 KV heads of dimension 2.

<div class="overflow" id="ex2"></div>

---

### Image Summary

As a contrived example, imagine we have an RGB image and we want to compute some weighted average of each channel. Really just want an example to show multiplying over more than axis at a time.

<div class="overflow" id="ex3"></div>

---

### Image Collection Summary

Now imagine we have a collection of RGB images and we want to compute that summary over each image

<div class="overflow" id="ex4"></div>

### Just a tensor

Here you can visualize whatever tensor shape with all indices shown

<div class="overflow" id="ex-tensor"></div>

---

<script type="module" src="/scripts/einsum.js"></script>
<script type="module">
import {make_einsum_widget, make_tensor_widget} from '/scripts/einsum.js';

make_einsum_widget(document.getElementById('ex1'), {
    shape1: [2, 3],
    shape2: [3, 4],
    einsum: 'mn,no->mo',
});

make_einsum_widget(document.getElementById('ex2'), {
    shape1: [1, 3, 8],
    shape2: [2, 4, 8, 2],
    einsum: 'BSD,CKDH->CBSKH',
});

make_einsum_widget(document.getElementById('ex3'), {
    shape1: [3, 4, 4],
    shape2: [4, 4],
    einsum: 'CWH,WH->C',
});

make_einsum_widget(document.getElementById('ex4'), {
    shape1: [5, 3, 4, 4],
    shape2: [4, 4],
    einsum: 'BCWH,WH->BC',
});

make_tensor_widget(document.getElementById('ex-tensor'), [2, 3, 4]);
</script>

