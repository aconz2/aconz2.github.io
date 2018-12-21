---
layout: post
title:  "Efficiency of Problem Decomposition"
date:   2018-12-21
categories:
---

This post will bounce between math/programming and the "real world" as I attempt to tease apart how efficiency can change when a problem is decomposed.

# Decomposition

To `decompose` some problem `P`, we want to split it apart so that the `size` of each component part is less than the whole. We define (in a circular fashion) an inverse operator `compose` that given two sub-problems, combines them into a single problem. The easiest way to interpret `compose` at this point is taking it to just be like a data constructor for list or something; ie compose doesn't do anything, just holds onto sub-problems `p0` and `p1` along with some `ϵ` that captures anything lost in the decomposition process.

```
decompose P = compose p0 p1 ϵ
size P ≥ (size p0) + (size p1)
```

# Solving Problems

To `solve` some problem `P`, we assume we have some function `f` that solves it! And to solve the solve sub-problems, we have to combine the solutions to the sub-problems. Here I've used a primed `'` versions of `solve` and `compose` to work on the sub-problem/solution level (and that `solve{N}'` may be different for each sub-problem). Note that we have lost the solution to `ϵ` when combining our sub-problems.

```
solve P = f P
solve (decompose P) = compose' (solve0' p0) (solve1' p1)
```

# Wins

We don't only have to think of decomposing a problem _instance_, we can also think about decomposing the space of all problems and special-casing each. For example, if your problem is "sort a list of numbers", you could have a case for first inspecting whether the list is already sorted in which case you're done. The efficiency gain from this check is a win for those cases where the list is already sorted, but we incur a penalty on every list (and in the worst case, we have to check up until the last letter; the asymptotic worst case doesn't change, but in reality, it would be a penalty).

So to be more precise, even if we gain efficiency in some sub-problems because of some information we've gained through the decomposition process, we must account for the efficiency of the decomposition, the solutions to each sub-problem, and then finally combining the sub-solutions. This math is a bit hand-wavy because like in the above example, the decomposition is mutually exclusive, ie we are walking down a decision tree to figure out which `solve{N}'` to use and so `compose'` is free. In other problems, `compose'` might actually combine results, like in a divide and conquer algorithm.

```
# E for efficiency
# F for frequency
efficiency solve (decompose P) = E decompose + E compose' + (E solve0' * F p0) + (E solve1' * F p1)
F p0 + F p1 = 1

# In most cases we'd expect
efficiency solve P ≤ efficiency solve0' p0
# but maybe the efficiency is greater in some sub-problems, and less in others; still a win so long as they are favorable overall
# also need to account for the frequency in which sub-problems are encountered, as that weights the overall benefit you get
```

# Losses

We can imagine having many `decompose` steps for large problems, splitting a sub-problem `p0` into `compose p00 p01`. For the time being, we'll assume we always split into a full binary tree, ending up with `2^k` sub-problems (1 split gives 2 sub-problems, 2 splits gives 4 sub-problems etc). This gives us `2^k - 1` internal nodes, which means we have `2^k - 1` decompose steps, and `2^k - 1` compose steps. Notice that this grows linear with the number of sub-problems. You can see that it is possible to end up with less efficient solutions if either a) compose/decompose are costly wrt the cost of of `solve{N}'` b) the efficiency of `solve{N}'` grows slower than the cost of the compose/decompose. And remember, all this has to consider the frequency in which you encounter each sub-problem to know when you actually win. Even if `solve0'` gives you a super-win, if it happens 1 in 100 and `solve1'` is slightly slower, then you'll have lost in the average case.

# Communication

One nice part is that for `2^k` sub-problems, there are only `k` hops to get from the root to the sub-problem (ie logarithmic growth). This tells us that if `solve0'` and `solve1'` can happen independently, we can "hear back from" a sub-problem in only `k` steps. This is most relevant in something like company structures, where the latency of communication can be very high (answering emails!). A company structure decomposes the problem the company is trying to solve by introducing managers, departments, etc. For `2^k` worker drones, we have `2^k - 1` managers, and the CEO should be able to get an answer from a worker drone in a mere `2k` email-response-times (the email has to go down the tree _and_ back up).

# Context

Often times in programming, special-cases _are_ a big win because of assumed properties which means we can ignore the cost of `decompose` and likely even `compose'`. This can happen because of reasoning that the output of some part of the program ensures a property, or perhaps the decision tree used in `decompose` can actually be shared between many problem instances, so we only have to pay it once, but get to reap the benefit across many `solve{N}'` instances.

# Cost of Being Wrong

In many cases, the decision trees that `decompose` a problem are not perfect and so they incorrectly classify an instance of `P` to be a `p0` when it's actually a `p1`. We can think of adding a penalty each time we use `solve0' p1` or `solve1' p0`. As with decision trees in ML theory, we can see that as you increase the depth of your tree (ie. make more decisions), you have more chances to make the wrong classification, and start accumulating more errors. On top of that, I'll claim that the penalty for `solve010101' p001100` increases with depth also. These two penalty's combine to really push for short trees, even if you theoretically have awesome solutions to very small subsets of your population. The optimal structure then comes at the frontier of having better sub-problem solvers and having too large of a tree to give worse results.

# Real World Impact

I think the world tends to overvalue the wins of solving sub-problems and undervalues the loss of growing a tree too big. We _do_ know this at some level because people like "cutting out the middleman", but it's not as pervasive as the popularity of that phrase would suggest. Also worth keeping in mind that often times cutting out the middleman just means someone is hiding the middleman from you and other times the middleman is actually important and shouldn't be cut out.

The types of problems I think this is most relevant to are large-scale government level issues like welfare and healthcare. I find things like UBI and single-payer as viable solutions because they are very shallow trees.
