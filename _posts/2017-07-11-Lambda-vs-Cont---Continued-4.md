---
layout: post
title:  "Lambda vs Cont - Continued 4"
date:   2017-07-11
categories:
---

I'm jumping back to order of effects visible to the outside world. I'll use the same example from Part 2 (where the `'WRITE` handler writes to `stdout`):

```
;; we pass the string to write and our current continuation as a pair
(+ (shift 'WRITE k ("hello " . k)) (shift 'WRITE k ("world" . k)))
```

We need to order these effects so that `stdout` gets "hello world" printed and not "worldhello ". In this case, we have a total ordering of the events in mind. Compare this to the case where you have multiple file descriptors: is it important to control the total ordering of effects across *all* file descriptors? Or is it sufficient to only have a total ordering of effects on the same file descriptor (ie. partial overall, but total on each partitioned set)?

I'm going to stick with the latter because I want as many things to happen "out of order" (scare quotes because there is no order) and so we need to look at how to specify a total ordering on some effects. Remember that `shift`s happen eagerly, so the effect handler will need to decide which effects to execute when it gets them.

Let's take a look at some ideas:

```
;; Option 1: use the builtin semantics to give ordering by passing some third value to discard
(shift 'WRITE k `("world" ,k ,(shift 'WRITE k `("hello " ,k nil))))
```

This actually delays the `shift` of "world" until "hello" has resumed because the resumed value needs to be passed to the handler in the second `shift`. This creates a faux data dependence and will execute in a way we're used to. I say faux because the third thing passed to the handler is garbage and can be discarded. We have encoded a data dependence using only existing rules. This is nice for simplicity reasons, but 1) it nests the code in a slightly weird way 2) encodes an explicit desire into a implicit data dependence.

Explicit vs implicit is definitely a fuzzy phrase so I'll make the comparison as to what I would consider an explicit encoding in the second example here:

```
;; Option 2: explicit ordering
(+ (shift 'WRITE k `("hello " 0 ,k)) (shift 'WRITE k `("world" 1 ,k)))
```

Here I've just given a sequence number to the effects in the order I want to see them execute. This has some obvious shortcomings when you get into bigger programs and have to think about composition. It might work if you label these things locally, but globally you'll need to label whole subtrees as well. Then, when an effect is raised, it's ordering-label is the list of labels currently active as the effect bubbles up so that `(0 0)` should happen before `(1 0)` (ie. lexical order).

What would it look like to order a whole subtree of computation? Let's try:

```
(+ (with-append-label 'WRITE 0 (something-with-lots-of-output))
   (with-append-label 'WRITE 1 (something-else-with-lots-of-output)))
```

Here `with-append-label` would install a prompt for the given effect(s), in this case `'WRITE` and append the given label. Something to think about is where the label is attached? Do we place it in a list like in the example above and have a convention (or something more structured; about the same) on where the label goes. What if an effect doesn't need a label for ordering? Does it warrant special treatment that `shift` may specify the order-label as another argument, so that it looks like `(shift 'WRITE k ("world" . k) LABEL)`. Are these labels useful for things besides just ordering numbers?

