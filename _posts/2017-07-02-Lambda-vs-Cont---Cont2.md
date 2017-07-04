---
layout: post
title:  "Lambda vs Cont - Continued 2"
date:   2017-07-02
categories:
---

We resume on our exploration of replacing lambda with delimited continuations by trying to tackle the problem of resuming a continuation with two (possibly) independent values. For example, a lambda term which looks like this:

```
(defun (big x) (something-very-time-consuming x))

(lambda (x y) (+ (big x) (big y)))
```

can proceed (wlog `x`) on computing `(big x)` even if `y` is unavailable. This is like partial application of either argument and then partially evaluating the `lambda` term. I will come back to partial evaluation eventually but I will note that this is what initially drove me to explore this path.

So what does this look like for delimited continuations? Well we need to be able to shift to the same prompt, but with some notion of provenance to track the difference in shift points. Let's try just adding a name to our `shift` calls. (For convenience, I'll named `prompt`s in upper case and these provenance identifiers (which look *a lot* like variable identifiers) in lower case).

```
(reset 'R (+ (big (shift 'R 'x k k)) (big (shift 'R 'y k k))))
```

Which begs the question, what value does the `reset` evaluate to? Normally, we would get a function of a single argument with the hole of `(shift 'R 'x k k)`. But remember I want the possibility that `(shift 'R 'y k k)` may be available first, or perhaps both `shift` at the same time. For this reason, the caller must either be able to determine which values (`'x` or `'y` or both) have `shifted` or be able to specify which to resume with (again paralleling the partial application of a lambda term in either order). If the caller specifies, then the caller blocks on commiting to resuming the computation at the given hole. But if the caller queries, then we have to poll in order to wait for something to `shift`.

Without answering the above questions (because I don't know the answer), let's look at another issue. This whole time I've been assuming that we have an operational semantics which allow stepping on any part of the program. The only time we can't is when we have a continuation which is shifted and no part of its expression can be simplified without resuming it. Compare:

```
(reset (+ (shift k k) (+ 10 2))) => (reset (+ (shift k k) 12))
;; with
(reset (+ 10 (+ (shift k k) 2)))
```

Can we control the order of evaluation when it matters, like interacting with the outside world? Haskell uses a monad for this purpose by binding lots of functions together. Whoever runs the monad controls the computation via controlling function application. But in our world, we don't have `lambda` to explicitly delay evaluation. So what's to do?

First, I think we should dive into how we interact with the outside world; which in this language world will be done in an effect handler style. We can imagine there is a top-level prompt named `'WRITE` which is a request to write to `stdout`, and will resume the `shift` call with the number of bytes it wrote.

So now returning to order of evaluation, when we have the code:

```
;; we pass the string to write and our current continuation as a pair
(+ (shift 'WRITE k ("hello " . k)) (shift 'WRITE k ("world" . k)))
```

what is printed to `stdout`? The two subexpressions to `+` are data independent as it stands. Can we force them to depend on one another? What is it that programmers know about order-dependence of effects that we aren't encoding currently? Can we write these down in a "direct" fashion instead of encoding them by nested `lambda` terms (like monads)?

Another way to look at this is from the perspective of the runtime managing the execution of the code. A `shift` to `'WRITE` is really like handling asynchronous events, either the left or right expression could `shift`. I think it's better to permit the `shift` to occur eagerly than to block the subexpression's computation until its permitted (this gives you batching of I/O requests for example). So do we annotate the `shift` expression with a sequence number of some sort? Is that an absolute number or just relative to a certain subset of operations (total vs partial order)? Or maybe you just punt on ordering and to get the order you want is to concatenate things how you want and then `shift` a single time (or submit a list of strings like `writev` in linux)?

Next time I think I'll try to write some thoughts on `if`, which has some considerations similar to the above but also some of its own issues.
