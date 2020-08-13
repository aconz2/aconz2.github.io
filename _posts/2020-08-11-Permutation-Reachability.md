---
layout: post
title:  "Permutation Reachability"
date:   2020-08-11
categories:
---

Here's a problem I couldn't find any search results for: given two sequences `a` and `b` and a fixed permutation `p`, is `b` reachable by repeated applications of `p` to `a`? And if so, can you efficiently return the number of applications necessary?

```
Find i s.t. pⁱ(a) = b if it exists or return None
where pⁱ is i applications of the permutation p.
```

The straightforward solution is to check each `pⁱ(a)` for `0 < i < |p|` where `|p|` is the order of `p`, or cycle length. This is potentially expensive for large `|p|`.

For certain classes of permutations `p`, I have found what I believe to be a solution; here's the explanation and the code is down below.

We require that the cycles of `p` in its cycle decomposition have lengths which are pairwise coprime and that their sum is equal to the length of `a` & `b` (this just means every element is permuted). If not every element is permuted, we can first check those corresponding elements of `a` and `b` are equal before going any further. We then check each disjoint cycle, looking to see if the corresponding elements of `a` and `b` are rotations of one another, and if so, record the offset `x`.

If any of the cycles are not rotations in `a` and `b`, we know `b` is not reachable and can be done. We now have a list of equations `i = x_k mod len(cycles_k)` for `k` over the cycles. Applying the Chinese remainder theorem gives us `i`.

The worst case running time is proportional to the sum of the cycle lengths, instead of their product (which is what gives us the order of `p` if we were to check all of them). The rotation checks can be improved with a better matching algorithm like KMP or BM.

A simple example of why we need pairwise coprime cycle lengths:
```
a = 'abcd'
b = 'bacd'
p = {(0, 1), (2, 3)}  # two swaps, swap 0⇔1 and 2⇔3
```

The offsets returned would be 1 and 0. Both cycles pass the test of having the corresponding elements be rotations of one another, but we could never have an `i` which is both `0 mod 2` and `1 mod 2`.

```python
from functools import reduce
from operator import mul, itemgetter

# taken from https://rosettacode.org/wiki/Chinese_remainder_theorem#Python_3.6
def mul_inv(a, b):
    b0 = b
    x0, x1 = 0, 1
    if b == 1:
        return 1
    while a > 1:
        q = a // b
        a, b = b, a % b
        x0, x1 = x1 - q * x0, x0
    if x1 < 0:
        x1 += b0
    return x1

def chinese_remainder(xs):
    """
    each element of xs is a (value, modulus)
    assuming that all modulus are pairwise coprime
    """
    sum = 0
    prod = reduce(mul, map(itemgetter(1), xs))
    for a_i, n_i in xs:
        p = prod // n_i
        sum += a_i * mul_inv(p, n_i) * p
    return sum % prod

# could be sped up with a better matching algo like KMP or BM
def calc_rotation_of(a, b):
    n = len(a)
    for i in range(n):
        if all(a[j] == b[(i + j) % n] for j in range(n)):
            return i
    return None

def possible_permutation_cycle(a, b, cycles):
    # NOTE: this doesn't handle checking the non-permuted elements; assumes sum(map(len, cycles)) == len(a) == len(b)
    ret = []
    for cycle in cycles:
        i = calc_rotation_of([a[i] for i in cycle], [b[i] for i in cycle])
        if i is None:
            return None
        ret.append((i, len(cycle)))
    return ret

def is_possible_permutation(a, b, cycles):
    """
    length of all cycles must be pairwise coprime
    """
    offsets = possible_permutation_cycle(a, b, cycles)
    if offsets is None:
        return None
    return chinese_remainder(offsets)

assert is_possible_permutation('abcde', 'cabed', [[0, 1, 2], [3, 4]]) == 1
assert is_possible_permutation('abcde', 'bcaed', [[0, 1, 2], [3, 4]]) == 5
assert is_possible_permutation('abcde', 'acbed', [[0, 1, 2], [3, 4]]) is None
```
