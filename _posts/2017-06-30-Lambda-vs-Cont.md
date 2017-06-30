---
layout: post
title:  "Lambda vs Cont"
date:   2017-06-30
categories:
---

I've been thinking a lot about the similarities and differences of lambda terms and continuations. I want to know whether you can dispense lambda from your programming language if you have delimited continuations. For many cases this is simple:

```
(lambda (x) (+ x 10))

(reset (+ (shift k k) 10))

```
Both of these terms give you something that looks like `(+ [] 10)` and applying that term will fill in the (single) hole.

However, compare this to when you multiple arguments (I show the derivation for the latter because it looks neat):

```
(lambda (x y) (+ x y))

         (+        9               2     )
  (reset (+        9               2     ))
  (reset (+ (shift k (k 9))        2     ))
  (reset (+ (shift k (k 9)) (shift k (k 2))))
 ((reset (+ (shift k   k )  (shift k (k 2)))) 9)
(((reset (+ (shift k   k )  (shift k   k )))  9) 2)
```

Here we see that using shift/reset gives us what we want, but in two steps. This resembles something from Haskell where functions get curried and there is no notion of multiple arguments.

Let's try taking a single argument that is a tuple with members `left` and `right` and using that instead to try and fix that.

```
(lambda (t) (+ (left t) (right t)))

(reset (+ (left (shift k k)) (right (shift k k))))
```

As you can see, this doesn't work. We've again called `shift` twice which will require the caller to resume the continuation with the same argument twice. This is no better. If we were okay with using a single list as the argument, we could use `apply` like so:

```
(reset (apply + (shift k k)))
```

But this breaks down once you have anything more complicated like:

```
(lambda (x) (+ (left x) (* (right y) 10)))
```

What we'd really like to be able to do with `shift` is to specify that multiple different uses are the same. Which is exactly what `(lambda x (+ x x))` does, but `shift`/`reset` does in a mechanical fashion. Here is where I think the operational semantics of a language need to change to enable this.

In a sense, we'd like to evaluate all children expressions in parallel until they `shift`, then be able to resume each of those holes at once (just like regular function application). In this way, the parents of an expression with a `shift` (can) depend on the resumed value, like in a monad, while the children of a parent are independent, like in an applicative.

One interesting thing to note is that for all my examples (save for the derivation), don't use the `k` from `shift` in any other way than to just return it.

Also, in a higher order context like map:

```
(map (reset (+ (shift k k) 10)) '(1 2 3))
```

we will be resuming the continuation multiple times. Which is fine, but comes at the cost of remembering the original continuation `(+ [] 10)`. In other cases, the continuation will be used once, or perhaps not at all. If we knew this, we wouldn't have to keep the original copy laying around. One idea would be to require duplication of a continuation to make this explicit. This is a similar distinction that `FnOnce` gives in Rust.

Lastly, we haven't talked about lexical closures, which I haven't quite figured out. I think you may need multiple named prompts to support this, but I'm not sure.
