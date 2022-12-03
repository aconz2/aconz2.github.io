---
layout: post
title:  "reimplement-all-the-things"
date:   2022-11-30
categories:
---

I want to reimplement all useful functions and I don't want humans writing the implementations, we just aren't that good at programming.

I don't have a hard definition of "useful", but you can start with math, strings, data structures, algorithms, graphics, etc. These "useful" functions are things you'd find in libraries, utility packages, gist/stackoverflow snippets that nobody has taken on the burden of maintaining. They are things that humans tend to agree upon and can for the most part spot check the correctness of an input/output pair by "hand" or with the aid of existing implementations (an oracle). They are the heart of image editors, video codecs, scientific simulations, 3d CAD, etc etc and web browsers. These functions are functions or classes not only for organizational purposes (like `int main()`; or what some may distinguish as procedures depending on the language), they are things intended to be reused in multiple code locations within your function or application and others. We know that there are many close-but-not-identical variants of these useful functions, each with different assumptions about what part of the domain they should handle, which parts should be error conditions, and what even constitutes an error. Other categories are those which are same-name-different-thing and same-thing-different-name.

I'd like to bring all these useful functions under one roof -- The Library -- and give them UUIDs, specifications, properties (as in property testing), long names and short names, documentation, multi-platform benchmarking and conformance testing, and then begin a search effort to find implementations for each one. The Library is a place to unite all packages and libraries we think of today and ensure they are meant to work together and where not seamless, there will be sufficient metadata to generate the glue between them.

Most of these useful functions will have -- and should have -- more than one implementation (and here different implementations are more than just eg. different variable names) to be used under certain circumstances chosen by benchmarking your application specific data distribution.

My estimates are that there are between 10k and 100k of these useful functions and between 1 and 10 useful implementations of each. This is not that many and quite refreshing to put an upper bound on our efforts. I do believe this is within reach, more on that now.

How do we do this given that program synthesis hasn't already taken over the world? My take is that given the enormous amount of cheap parallel compute and storage we have available, we should find a decent guess and check approach and let it rip. Here are the properties I would want in a system whose goal it is to satisfy:

```python
for spec in TheLibrary:
   for impl in find(spec):
       for i, o in input_output_pairs(spec):
           assert impl(i) == o
       for property in properties_of(spec):
           assert property_holds(proerty, impl)
```

1) The iteration state or progress of a given search attempt for a given spec:
  a) Can be (cheaply) saved
  b) Can be introspected
  c) Can sometimes (ie partial order) be compared with other iteration states for inclusion/containment
  d) Can be unioned with other states in time less than building the union from scratch (ie parallel is beneficial)
  e) Can be scored on multiple metrics to decide whether this seems like a promising state
2) When we have exhausted an iteration state:
  a) Can expand the search in an incremental way, with complexity proportional to the size of the new unexplored space
  b) Can share whole sub-searches from other states to avoid redundant work
  c) Can provide a list of inputs that are not yet specified that would expand the search space & then resume the search
3) When we have found a plausible iteration state:
  a) Can shrink it (ideally in log time) to the smallest plausible iteration state

Remember that we need to be gearing up for a long hard search, so we are expecting to have some search algorithm crunch for eg 10 minutes at a time and checkpoint its results so that when the machine crashes or is pre-empted, we don't lose that knowledge we have gained -- even though the search space is large we still learn something if we know what hasn't worked yet. And we will have 10k - 100k of these searches happening, so unless we're rich we can't run them all at once so we'll have to schedule them based on some priority. And when we have a new idea for a place to search, we don't want to redo the last 1k compute-hours we spent by searching the same places. And when we realize the spec is wrong or lacking a key example, we'd like to be able to restart all searches we have done and all those which are dependent upon it.

My plan is to split this search problem in two: the first step satisfies the above properties and is responsible for ruling out large parts of the search space and finding plausible over-approximations of what could be a viable implementation. Then, we examine these states more closely and attempt to extract a working implementation that is executable. This extraction step is necessary because the search state represents a multitude of concrete program executions, but not a single program source.

To be more specific, we will be building a directed graph where the nodes (objects) are values and the edges (morphisms) are functions. We initialize the graph with nodes whose values correspond to each input and output. Each node carries one bit per input/output pair that tracks the reachability from the corresponding input node. This reachability can be incrementally propagated when adding edges (to a fixpoint) in time bounded above by |V|. The goal is to find a graph such that each output node is reachable from its corresponding input node. We then know that for each input, there exists a path of functions that reach the desired output. This condition is necessary but not sufficient for having found an executable function that works for all the inputs, since each path may follow a different set of functions.

One excellent property of using a graph for this purpose is that we get to share sub-computations. Imagine for a moment we were instead trying to synthesize our desired function by enumerating source code programs and then executing them. In the simplest form, we would be recomputing all the shared sub-expressions present in each enumerated function. Even with a fancier approach like snapshotting the program state at some point and then varying the "tail" of the program (similar to a fuzzing approach), we still don't get to share the sub-expressions in the tails. You might then choose to memoize all the things, and that might be a viable strategy, but I find the graph nicely reifies the tabled results and next we'll see how these graphs are captured in a reified iteration state.

In order to save, compare, and expand our search, we'd like a data structure that represents one of these graphs. For that, we'll use what I'm calling a "recipe" for now because it gives a recipe for how to construct one of these graphs that is deterministic. Currently, the idea for the recipe is that we record the input/output pairs we start with and then have a list of stages. Each stage can add constants or execute functions. When executing a function, we find all possible inputs in the graph that are valid for that function, evaluate using those arguments, add these outputs as nodes if they are missing, and add edges between the used inputs and the generated outputs. Right now, I'm thinking that functions of multiple arguments will need to have their inputs packaged into a single node with a special product operator whose node is the tuple of the inputs. The propagation of reachability for these nodes is the intersection of their input's reachability (bitwise). Functions listed in the same stage see the graph in isolation of each other and each function is only run once and not to a fixpoint (otherwise something like `inc`/`plus1` would grow the graph pointlessly large). One idea to capture loops is to have an iteration count where the function is applied `count` times (equivalent to naming that function in the next `count` stages, but more compact).

Expanding a recipe which currently produced graph `g` by appending another stage will give a graph `g'` where `g ⊂ g'`. It is much easier to compare recipes for this inclusion/containment than it is to check the graphs themselves. We can also expand a recipe by adding a function to an existing stage, or inserting a new stage somewhere in the middle of the stage list. We can still reuse work by starting with `g` and should only require work proportional to what we've added, and not what we've already done. To do this correctly, we do need to annotate each node with the index of the stage which introduced it, since a function in a stage `i` should only act on nodes that existed before it. We then re-run all subsequent stages until they have all been run or no new nodes are introduced, at which point we have reached early stopping (which parallels build systems).

Since we expect our specifications to change while we work on them, we should track the latest version (a monotonically increasing integer) of each function used in a recipe so that we can track which recipes need to be updated. One version of this whole approach would not even permit execution of functions at all, but instead view each function as a table in a database, where "executing" a function for all possible inputs is equivalent to doing a join between the table and nodes in the graph. There is of course a nice hybrid approach where we trust that we have agreement in what basic functions like `bigint-addition` should do, but trickier things would instead "ask" us what the right answer is before using that in its own implementation.

To spell out what a recipe might look like, consider something like (sorry for the junk example):

```json
{
    "input-outputs": [
        {"input": "abc", "output": "10"},
        {"input": "bcd", "output": "11"},
        {"input": "def", "output": "12"}
    ],
    "versions": {"foo": 2, "bar": 1, "baz": 10},
    "stages": [
        {"functions": ["foo"]},
        {"functions": ["bar", "baz"]},
        {"functions": ["foo"]},
    ]
}
```

As mentioned, once we find a graph which satisifies the reachability property, we then need to attempt to extract a single path -- which represents a composition of functions -- which we can follow from any input to its corresponding output. And its not quite that simple; remember our multi-argument functions which use a product operator? We'll need to actually extract the subgraph which contains any nodes used while walking along the path we've extracted. This can be because we use a constant or a computed value of a constant. We also face a challenge with conditionals/branches, since many functions have a shape like:

```python
def typical_function(*args):
    var1 = f1(*subset1(args))
    var2 = f2(*subset2(args))
    ...
    tag = branching(var1)
    match tag:
        case tag1: return case1(var1, var2, ..., *args)
        case tag2: return case2(var1, var2, ..., *args)
        ...
```

Here, we might have successfully found the paths for `input1 -case1-> output1` and `intput2 -case2-> output2` (ignoring var1 and var2 for simplicity), but we are missing the gluing of those two paths that gives us one function which takes care of doing the case matching for us. I think there is something very interesting going on here in general, where so many functions can be viewed as the composition of these disjoint subdomains. They can also tend to share common tails (which would correspond to some code after the `match` above and without returning from inside each case). My one thought on tackling this is that, in anticipation/expectation of using a loop in the implementation, a recipe would use a higher order function called `tag`, where `tag(f, x) = Tagged(f(x), x)`, and the `Tagged(t, x)` value becomes a node. We then proceed as before, but instead of plain function application when building the graph stage, we use `map(f, Tagged(t, x)) = Tagged(t, f(x))`. (This lifting of application could either happen explicitly or automatically and would be applicable when finding implementations for functions operating on other structures (functors) like lists, tuples, etc.) The nice thing about the `Tagged` approach is that we get to essentially follow all branches of the conditional.

Loops fall into a similar category as branches and the best approach I can think of is to only extract loops at the lowest level functions and instead prefer to extract structured loops like `map` and friends.
