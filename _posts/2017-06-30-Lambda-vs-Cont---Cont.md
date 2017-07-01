---
layout: post
title:  "Lambda vs Cont - Continued"
date:   2017-06-30
categories:
---

We continue our exploration of replacing/implementing lambda terms in terms of continuations by trying to address lexical closures.

With multiple prompts (which are named via a symbol, and not created as a value like in `make-continuation-prompt-tag`), we can explore this problem.

```
(reset-at 'A (+ (shift-at 'A k k) 10))
```
is the same as

```
(reset 'A (+ (shift k k) 10))
```

but for the rest of this, I'm just going to use `shift/reset` for `{shift,reset}-at`.

Our map example is then something like

```
;; GOAL
(lambda (y)
  (map (lambda (x) (+ x y)) '(1 2 3)))

;; Version A
(reset 'OUTER
  (map (reset 'F (+ (shift 'F k k) (shift 'OUTER k k))) '(1 2 3)))

;; Version B
(reset 'OUTER
  (map (reset 'F (+ (shift 'OUTER k k) (shift 'F k k))) '(1 2 3)))
```

A couple things to look at: 
  - the named prompts become almost identical to a lambda with a variable binding
  - In Version A, the "lookup" of the "variable" `'OUTER` is a dynamic binding because it will not `shift` until after `map` resumes the continuation with the "variable" `'F`. If `map` has a `(reset 'OUTER ...)` somewhere in it's implementation, it will shadow it.
  - However if we had our parameters to `+` reversed, like in Version B the binding of `'OUTER` would be lexically bound because we `shift` to `'OUTER` before starting any calls to `map`. (Remember, we are evaluating arguments before function application)
  - In Version A, we `shift` to `'OUTER` 3 times (once for each element of the list), whereas Version B will only do this once


What we still don't get is the notion of resuming a continuation in two places with the exact same value. The following are not (always) the same, even with named prompts:

```
(λ (x) (+ x x))

(reset 'x (+ (shift 'x k k) (shift 'x k k)))
```

One way to achieve this would be to introduce a "fork" prompt which would encode this. Let's try:

```
(fork 'x (+ (shift 'x k k) (shift 'x k k)))
```

which, given the right operational semantics, could give us what we want.

To answer the problem from the previous post about passing multiple arguments, we can now use `fork` to access a list or other structure of arguments passed as a single value to resume the continuation:

```
(fork 'x (+ (left (shift 'x k k)) (right (shift 'x k k))))
```

But this unsatisfying because a continuation which expects two values to resume may be able to make progress even if only one of them is available; and in fact in may just abort the whole computation if the one resumed value is satisfactory. A real-world example might be querying two DNS name servers and returning with the first to reply. In terms of a lambda, this would be kind of like being able to partially apply its arguments in any order.

This is where we will pick up in the next post
