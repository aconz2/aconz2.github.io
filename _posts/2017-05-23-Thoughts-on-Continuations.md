---
layout: post
title:  "Thoughts on Continuations"
date:   2017-05-23
categories:
---

Disclaimer: I don't have a hard point here, only thoughts. Hence the title.

A hot topic in programming languages these days is continuations/callbacks. Javascript is perhaps the language which has brought continuations to the mainstream along with all the headaches they can cause in an async world. But, as we've seen in Python, Rust, C#, Haskell, OCaml, this is an issue that gets addressed everywhere.

Monads, disguised under a different name (and without the types), came in to bring sanity back to nested callback-hell. People seem to enjoy chaining `.then` calls in JS/Rust because it can be nicer to read than heavily indented nested functions.

Taking it another step further, languages can provide support to make those functions "disappear". Examples:

	- Haskell - `do`
	- Python 3.4 & ES6 - generators
	- Python 3.5+ & ES7 - async def (generators with restrictions)
	- OCaml - lwt macros (not up to date on this)
	- C# - compiler makes state machine
	- Clojure core.async - macros make state machine

The goal of these mechanisms is to remove the explicit creation of a continuation and instead put the burden on the compiler/whatever. Why? Because code reads more like a boring old set of assignments. It turns: `foo(10, λ x: bar(x))` into `let x = foo(10); bar(x)`. This is most obvious to me when thinking about how Python & JS hijack generators to do this; generators suspend a function (creating a continuation) with some value that needs to be fulfilled and then the generator can be resumed when its fulfilled.

The drawback to these approaches is the same as its advantages. While it may *look* like normal code again, it really is still restricted and calling `await` (or the like) has to happen in an `async` function (or the like) and so on up the chain. And this shouldn't be too surprising because the whole reason we're using continuations in the first place is to adhere to a "restricted permission" execution.

## Why are we using continuations?

Let's take a step back from the async world and look at continuations elsewhere.

### Iterators

If you're in a language with opaque types (to hide the implementation), then you might want to use a callback to give your users a way to iterate over the structure. Since they don't know the internal structure (and you don't want them to), you restrict their access by accepting a callback which you call on every element.

### Case analysis

This one only applies to languages with static typing. The following uses a continuation (if you squint hard) as the enforcement that `i` is actually an int, and is not bound in the `None` arm.

```
match maybe_an_int with
	| Some i -> i + 1
	| None   -> 0
```

### Async

And we're back. Async needs continuations to let multiple computations, which may have to wait an arbitrary time until they can proceed, interleave with each other to provide concurrency. Continuations let these computations pause and be resumed by a scheduler.

## One of these isn't like the other

I haven't nailed down exactly why, but async seems like a different use-case for continuations than something like iteration. To explain why, I must take a slight detour on "alternatives" to continuations

### Threads are continuations

All that talk about suspending, scheduling, and resuming a computation sounds an awful lot like an OS and processes/thread (memory access aside) management. The OS can do this without any knowledge of the language, runtime, etc. you're using because it can a) interrupt your computation whenever it wants and b) maintain the whole state of the computation. There are pros/cons of using threads as the solution for async operations, but just remember that a language with async stuff is acting like a mini-kernel all over.

### Punchline

<Still working this out in my head. Was thinking something about how it would seem odd to use threads in a place of the callback for iteration>

## What about Scheme?

Scheme has awesome and mind-bending powers over the continuation of *wherever you are* in your program. I can't do justice to explaining them right here (as there are many flavors of continuations as well), but the thing which made them make the most sense was implementing an interpreter in the CEK/CESK style (I don't think it's even necessary to implement call/cc per se, just getting to grips with what current continuation is).

I bring up Scheme because it uses continuations for more than async concurrency or data hiding, but for control flow too. I don't know where this fits on the landscape of use-cases I outlined above.

## What about coroutines?

I'll gloss over the details and distinctions between coroutines/generators etc, but I want to mention them because there's a kinda funny inverse issue that comes up when using coroutines. The reason generators are useful (think in Python) is that it lets you write code which `yield`s, and when you get resumed, the surrounding state is restored, without you having to pass it back into a function and jump to where you want. And if you did, you're essentially re-implementing the job of an interpreter.

However, if you wanted to use a list of generators to model agents in a world for example and allow the state of the world to be saved, then you're at a sticking point. The implicit-ness of the saving and restoring state makes it very hard to then explicitly capture the state and serialize it to disk. And so then you have to explicitly model the state of the whole world and write an interpreter over it. This gives you the ability to serialize the state, but now you're doing your own bookkeeping.

Compare this to callbacks in the async world where before you were explicitly creating the continuation and wanted to move to the compiler capturing the continuation for you. Very interesting.

#### Compared to Closures

Going back to the point about serializing generators/coroutines, I've also run into this when thinking about serializing closures (in some sense these are the same issue, just probably not from an implementation standpoint). There is a lovely representation of a set which just uses closures:

```
set_empty  _   = False
set_insert s x = λ y: y == x or (s y) 
set_union  s t = λ y: (s y) or (t y)
```

But which cannot easily be serialized because most languages don't let you save a closure. Compare this to a "standard" set representation like a tree or hash table which lets you explicitly capture its representation. Also interesting to note that an explicit representation can be interpreted in many ways (lookup algorithm), but the above cannot without reflecting the closure and feeding it into a compiler. Speaking of which, I think (and I've toyed around with) a language which lets you reflect closures and continuations into a reified program would be very interesting.

#### Explicit vs Implicit

This distinction sometimes haunts me when I'm writing code that feels a lot like an interpreter. To be fair, *all code* is in some sense an interpreter over the data it's given, but some programs which require a lot of bookkeeping always feel like I should just be "directly" (whatever directly looks like) writing the program and not writing an interpreter for the program. For example, using an explicit stack to iterate a tree vs using the runtime's stack (performance and overflow issues aside).
