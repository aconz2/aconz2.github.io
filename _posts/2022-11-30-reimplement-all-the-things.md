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
  c) Can sometimes (ie partial order) be compared with other iteration states for inclusion
  d) Can be unioned with other states in time less than building the union from scratch (ie parallel is beneficial)
  e) Can be scored on multiple metrics to decide whether this seems like a promising state
2) When we have exhausted an iteration state:
  a) Can expand the search in an incremental way, with complexity proportional to the size of the new unexplored space
  b) Can share whole sub-searches from other states to avoid redundant work
  c) Can provide a list of inputs that are not yet specified that would expand & then resume the search
3) When we have found a plausible iteration state:
  a) Can shrink it (ideally in log time) to the smallest plausible iteration state

Remember that we need to be gearing up for a long hard search, so we are expecting to have some search algorithm crunch for eg 10 minutes at a time and checkpoint its results so that when the machine crashes or is pre-empted, we don't lose that knowledge we have gained -- even though the search space is large we still learn something if we know what hasn't worked yet. And we will have 10k - 100k of these searches happening, so unless we're rich we can't run them all at once so we'll have to schedule them based on some priority. And when we have a new idea for a place to search, we don't want to redo the last 1k compute-hours we spent by searching the same places. And when we realize the spec is wrong or lacking a key example, we'd like to be able to restart all searches we have done and all those which are dependent upon it.

My plan is to split this search problem in two: the first step satisfies the above properties and is responsible for ruling out large parts of the search space and finding plausible over-approximations of what could be a viable implementation. Then, we examine these states more closely and attempt to extract a working implementation that is executable.
