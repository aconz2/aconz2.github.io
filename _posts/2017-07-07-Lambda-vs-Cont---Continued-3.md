---
layout: post
title:  "Lambda vs Cont - Continued 3"
date:   2017-07-07
categories:
---

I want to pick up where I left off looking at order of evaluation with `if` and perhaps this can shed some light on the order of effects. In a typical language, `if` delays evaluation of the body only if the condition is true, in a similar way that `lambda` delays evaluation until it is applied. Without any special evaluation rules, can we recover the benefits of `if` with only delimited continuations.

The reasons we want `if` are for two reasons: 1) don't evaluate expensive computations unless necessary (`(if (coin-flip) (ackerman 100))`) and 2) don't effect the outside world unless we want to (`(if (coin-flip) (fire-the-missiles))`).

You see that reason 1 deals only with expressions and if we had lazy evaluation, we would get this for free. I can imagine other strategies for approximating this behavior; the first that comes to mind is to limit the out-of-order execution by some time and or gas so that we don't spend too much time evaluating redexes that aren't in the "primary" position.

Reason 2 is far more important and needs to be dealt with. Eagerly `shift`-ing would be dangerous if our runtime fired the missiles before we even decided whether or not we wanted to. Let's play around with some code and see if we can get this to work. (Imagine there is a top-level handler called `MISSILES`)

```
;; Option 1: shift with a bool to tell runtime whether or not to fire missiles
(shift MISSILES k (k . (coin-flip)))
```

Here we just punted on the whole `if` thing and pushed it into the run-time. This is unsatisfactory for the obvious reason, but also because we still have the effect `MISSILES` occurring.

```
;; Option 2: shift to a conditional handler
(shift (if (coin-flip) MISSILES 'NOOP) k k)
```

Here you can see that evaluating all sub-expressions of `if` is no big deal, so no worries there. But even though we conditionally evaluate the `MISSILES` effect, we still always have an effect.

```
;; Option 3: conditional prompt
(reset-if MISSILES (coin-flip) (shift MISSILES k k))
```

Here I've created a new form, `(reset-if prompt bool body)`, that conditionally creates a new prompt with the given name based on the boolean value. We always raise the effect in the body, but it can only reach so far. This still doesn't seem pleasing, but I'll leave it at this for now.

