---
layout: post
title:  "Cached computation with a database"
date:   2020-04-01
categories:
---

I've been working on a system that is concerned with 4 things:

1) Store some data - full history is not recorded but we do want a revision number per row
2) Derive some data - we have functions that take a row in our database and produce some other row. This can be repeated if you have a pipeline like `parse → compile → run` and we want to store all intermediate computations
3) Recompute derived data when the input data changes
4) Recompute derived data when the functions change
5) Figure out if a particular derived data is stale
6) Figure out all derived rows that are stale and run them
7) Given a changed row in your input data, know which derived rows are stale and run them
8) Demand a derived value and run it if not already computed

There are multiple design choices to make. Let's assume you have some rows of data in table `D` and a chain of functions `F`, `G` and `H` that get stored in tables `FT`, `GT`, and `HT` respectively (`FT = F(D)`, `GT = G(FT)`, `HT H(GT`).

### How much provenance does derived data remember?

Each derived table needs to have some record of where its derived data comes from. You could store:
1) Your predecessor
2) The root (`D` in this case)
3) The full chain
4) Some combination

I have been going with the root.

### Can you have processes which read from more than table?

Let's add a process `J` which consumes rows from `GT` and `HT` (`JT = J(GT, HT)`). The two obvious ways to interpret this process are that a) it runs over the cross-product of `GT ❌ HT` b) it runs over "parallel" rows (ie joined by some common key). I don't yet see a use for a) so let's assume b). From above, if we keep a root provenance key, it is easy to see that we can do something like (in pseudo SQL)

```
select g, h from G join H on G.rootkey = H.rootkey
insert J(g, h) into JT
```

Note that `JT` still only needs one `rootkey` since `G` and `H` have a common root (`D`). This would not work if you wanted to compute some result from two root tables `D` and `E` (the first thing you need to answer is which rows of `D` and `E` go together).

### Are your derived values demand-driven?

Normal caches demand-driven, so that you have to ask for some row of `FT` before the value gets computed (if necessary). But since we are in a database, we can pretty easily be proactive and figure out which values are missing and compute them. And further, if we a a revision number stored on all tables, we can figure out which values are stale.

```
# missing
select d from D left join F on D.key = F.rootkey where F.rootkey is null
insert F(d) into FT

# stale
select d from D join F on D.key = F.rootkey where D.revision > F.revision
update F(d) into FT
```

### What's your consistency model?

When you want to make an update to a row in `D`, do you require (re-)computing all derived values and storing them in the same transaction? If not, and you just accept the change to `D`, do you mark all transitively derived values as dirty somehow? Do you delete them (if you're using foreign keys, you could always delete with cascade from D)?

For my usecase, I'm going with eventual consistency. Updates to `D` cannot be blocked by derived computations (they could take a while) and I'll leave stale results around. It's easy to support a staleness check on-demand by comparing revision numbers and that could be polled by the client after submitting updates to the `D`.

One gotcha here is that when you store the result of your computation, you need to check (in a transaction) whether your revision is bigger than the one you're overwriting (if it already exists). For example, let's say your input is at rev 22. You then have this sequence of events: begin F on row:22, change data to rev 23, begin F on row:23, finish F and store FT on rev 23, finish F and store FT on rev 22. That last store overwrites the newer value and should never happen. This isn't broken as we can detect this after the fact but is a waste of computation.

### How to track changes in the computations?

Let's say all derived data is up to date. You then change the code for `G`. You now need to recompute *all* of `GT` and `HT` (conservatively; some results might be the same in which case recomputing the corresponding row in `HT` is not necessary). Here is where we hit some interface boundaries, because existing languages/programs aren't great at tracking these kinds of changes. For now I've settled on listing the dependency between the process `G` and files on disk which it depends on. We can then check on startup for changes to these files and know what to re-run, as well as consume notifications from `inotify` for a long running process.

### How to track computation dependencies?

In order to be proactive about what to compute, you need to statically know which tables a computation will read from and what it will produce. Thanks to type annotations in python3, I have gone with the approach of annotating each function with the table models as args and return type. Then, we can just inspect those annotations and have the full graph of tables and computations and how they relate. We can verify it has no cycles, visualize it, and topologically sort it to get a linear running order for the functions.

### Long running computations

For long running computations, you likely want to track that a stale or non-existent row is currently being worked on (as in a task queue) so that you don't duplicate work. You also want to debounce their launch time so that you only start the task after the input has "settled". Lunchtime or overnight might be a nice time if the input data were only ever edited by humans.

### Errors

Each process is likely capable of failing and this adds one more check to the mix. You can only process `G` if `F` succeeded and you can only process `H` if `F` and `G` succeeded (for a particular row). You *do* want to store the error as a result, otherwise you would just keep recomputing the same thing, and because you probably want to show the error to a human. You also don't want to needlessly run a downstream function when there is no valid input for it because its predecessor failed.

## Closing

I'm building a toy programming language on this idea and find it very compelling. Each function or top-level expression is a row in `D` and all steps of the compilation are represented as derived values. The thing I have not addressed above, is that dependencies may exist *between* items in `D`. If you are early-binding or statically-linking, then your compilation result must be recomputed when any *transitive* item in `D` is changed. Right now the language is late-bound so that's not an issue but something I am still mulling over. I also would like to incorporate derived computations defined in the language itself eventually.
