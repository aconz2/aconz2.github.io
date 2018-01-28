---
layout: post
title:  "Consistent Interfaces"
date:   2018-01-28
categories:
---

I have been thinking a lot about the future of programming, which to me looks like a lot more programmers, a lot less code, and a lot more automation when it comes to software development. These things may sound contradictory and I would like to dedicate a post to those ideas specifically, but the important bit is that one model that I see as a possibility is a well specified demarcation of whether you are writing application code or library code.

Application code should never know the underlying type and library code would implement the nitty gritty. Application code would be annotated by agents (performance engineers programs eventually) to select the proper data structures and algorithms.

I am imagining this in the context of a global code repository (hence the less code) and programs could either be run in an open-world assumption (ie. missing method triggers a "page fault" to look for a missing method from your neighbor) when playing around or a closed-world assumption when you want to lock in what the program does.

This lends itself towards a multiple dispatch paradigm and without getting too attached to any of those details, the main question of the day is how we use the word interface (trait, type classes, abstract base class etc.) today and what makes something a good interface.

~~I will start with the example I keep returning to that appears as a clearly correct and "good" interface: `sort` (or `sortable` etc. depending on who you ask, but what you "call" it isn't as important as what it is). The interface `sort` takes a collection and a binary operator which gives a `total-order` on the domain of the sequence and returns a sorted sequence (wrt. that order). The reason this is a good interface is because we know of many algorithms for sorting things (ie. multiple possible implementation) but the output of each should be exactly the same.~~

Okay scratch that reverse it, I hadn't thought about the stability of the sort (hence why I wrote these things down). I guess I will just modify the above with `stable-sort` which takes an ordered sequence (and not just a collection). Anyways, the output of each implementation will be exactly the same (wrt. equality on the output sequence) and this can be tested.

Compare this interface with something like the `show` type-class which returns a string representation of a thing. For a given type `a`, we might imagine many ways to give a string representation of something (and yes that wouldn't be accepted by Haskell). For example, floats might want a # of decimal places, leading zeros etc. If we expand the `show` interface definition to also take some format specifiers, would that be good? Is it okay for the output of multiple implementations of an interface for a given type (or set of types for multiple dispatch) to only be equivalent wrt. *some* function and not necessarily equality? Does that ruin the strength of an interface?

I think the place I keep coming back to is what I learned in electrical engineering about Karnaugh maps and the power of don't-care cells. By explicitly stating that you don't-care about the value of some pair of inputs, you gain a lot of flexibility in the design of your circuit. In programming, I'm less concerned about the flexibility (though that could also come in handy for optimizations) and more about specifying whether you care or not. Right now we freely use interfaces to mean "this interface should be exactly the same" and "this interface is the same wrt some equivalence class". We don't really have the chance to write down which of those we mean and I think this leads to a bunch of pain.

Perhaps the solution is to simply mandate that interfaces have at least 1 law which gives the equivalence class that any outputs from the same input must be in. Of course, it is also useful to specify laws relating interfaces, but we can't go around thinking that `sort` and `show` are similar interfaces.
