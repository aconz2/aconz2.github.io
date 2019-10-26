---
layout: post
title:  "PL Annotations and Statements"
date:   2019-10-25
categories:
---

In a new programming language, I'd really like there to be a way to annotate programs and make statements about them from the outside.

I'm using "statement" instead of "fact" here because I also think its important to recognize that statements will be made that are provably false; these statements are an agent's (whether computer or human) belief at some point in time.

For the time being, disregard how these will be syntactically written or stored as its inconsequential. The most important (and hardest in my mind) implementation detail will be allowing some statements to be carried with a subject as it changes so we don't have to constantly restate things as programs change. But also keeping in mind that a changing subject my make a statement nonsensical/invalid.

# Examples

* The implementation `bubble-sort` implements the interface `inplace-sort`
* The implementation `quicksort` is equivalent to the implementation `bubble-sort`
* The implementation `quicksort` is the recommended implementation of the interface `sort` for lists longer than 20 elements
* The implementation `my-string-length#9280eaf2` has a bug when run with unicode strings, example: `"λ"`
* The interface `string-length` should return `1` when called with `"λ"`
* The benchmark results of all implementations of interface `matrix-multiplication` are (...) - statement made by `computer#beab0c39` running `function#37ce6072`
* A call to `check-if-key-is-inserted` must happen before the call to `launch-missiles`
* A call to `launch-missiles` can only happen with proof/token that `check-if-key-is-inserted` returned true
* `square(x) ≥ 0 ∀ x ∈ Real-Numbers`
* The interface `something-something` is deprecated
* The recommended replacement to the interface `something-something` is `newer-something-something`
* The interface `newer-something-something` is backwards compatible with `something-something`
* The interface `something-else` is deprecated
* The recommended successor to the interface `something-else` is `newer-something-else`
* The interface `newer-something-else` is NOT backwards compatible (shame!) with `something-something`
* The migration tool to move from `something-else` to `newer-something-else` is `migration-tool-something-else`
* We standard library implementers intend to remove `feature-x` from the language, does this break anyone?
* We standard library implementers intend to remove `feature-x` from the language and here's a migration tool `tentative-removal-feature-x`, does this break anyone?

I hope that gives some idea of the kinds of things we want to be able to state in a machine readable format. These statements would support the whole gamut of the tasks related to programming: documentation, tests, examples, bug reporting, benchmarking, migrations, code coverage, compatibility, model checking, proofs, fuzzing, version control, security, versioning, etc. A cohesive way to specify these things would go a long way to improving our tool set. Below is a brief sketch of what I think is necessary in a language to support such a tool set. I find existing languages obviously unfit for this approach but I would welcome a discussion to the contrary.

# Disclaimer

I don't really have great names for any of the following "things".

# Necessary Components to Support Annotations/Statements

## Ideas

An idea, in the sense of a Platonic ideal, gives us an unambiguous and permanent identifier to refer to something. These would be generated as needed with for example a GUID. They do not point to anything and only exist as a thing to be pointed at.

For example, we could generate a guid `@823133ef` and then attach a statement like `@823133ef` is "Bubble Sort". And then a statement like `bubble-sort` is an executable version of `@823133ef`.

## Immutable Identifiers

As in Unison, IPFS, etc. we want to have an easy way to refer to an exact value and be able to verify that upon receipt. These could be a SHA for example.

These references must be transitive by capturing the immutable reference of any identifier it contains and so forth.

This is notably useful in bug reports as we'd like these to be ideally 100% reproducible, modulo some hard questions on platforms, architectures, RNG, etc.

It is useful to think of immutable identifiers as a placeholder for an exact snippet of code (could be a function or just some expression, though you can also imagine only allowing functions and just wrapping expressions in an outer anonymous function).

It is not necessary to address concerns like ensuring two functions `function (x) {return x;}` and `function (y) {return y;}` have the same immutable identifier. There are much more varied equivalence relations that you might want to use so we needn't choose an arbitrary one up front.

## Mutable Identifiers

Similar to DNS, we need a way to have a stable identifier while allowing the underlying thing it refers to change. (Aside: the whole mantra about solving problems with indirection is so true but so misleading as it a) conveys the sense that you're being mislead and b) makes you think of C pointers or something; To me, the essence of indirection is partitioning things to allow them to change independently. Change is the root of many complexities we deal with and needs to be addressed with commensurate attention.)

An example of a mutable identifier might be `bubble-sort`. `bubble-sort` would then refer to an immutable identifier like `#d2d8e453`. If a different implementation of `bubble-sort` were written (see [Wikipedia](https://en.wikipedia.org/wiki/Bubble_sort#Implementation), they give 3 implementations of `bubble-sort`), a new statement of `bubble-sort` points to `#9928beed` could be published. Other statements would be needed to specify if the old referent is for example a buggy implementation and in some sense thus retracts the old statement, or whether its just for example a performance improvement.

Mutable identifiers would be stored with a revision, timestamp, logical clock, or other mechanism that captures some notion of its history and determining what the current state is.

It would be useful to be able to state a function, in terms of another mutable identifier, that dictates whether the target of the identifier is valid. This could be any or all of a type, a test-suite, an arbitrary function, etc. This would prevent you changing the identifier `bubble-sort` to point to an implementation of reverse. The check/chaperone identifier is itself mutable because we will not state the right type, test-suite, arb function the first time; we just won't. The rules for updating the chaperone are basically take less, return more, except bug-fixes, security vulnerabilities, and TBD on Hyrum's law.

## Interfaces

Just like an algorithm can have many executable implementations, there are many algorithms that satisfy some desired process. An interface is similar to a mutable identifier, but it points to a set of mutable identifier. It can also have a check/chaperone identifier that can specify the interface contract in executable format.

Interfaces are updated implicitly, by statements made by others.

Interfaces point to multiple mutable identifiers and would support semantics like multi-methods.

An interesting thing to note is that we can equally think about multiple implementations of an interface for the same type `List[T]` being implemented by `bubble-sort`, `merge-sort`, etc. (which is usually disallowed in multiple dispatch languages) as well as multiple implementations for different types, ie `addition` on `integers` vs `rationals`.

(Aside: in the section above on mutable identifiers, I refer to multiple valid implementations of `bubble-sort`, does this make it an interface instead? I don't know yet. At the end of the day, we do have to choose a single concrete thing to run).

## Schemas

TODO

Roughly I'm thinking of including many of the attributes on schema.org (or perhaps even having a compat layer with RDF attributes).

## Review

* Ideas: 1-nothing; Gives a unique spelling to every separate concept we want to refer to
* Immutable Identifier: 1-1 with a transitive code snippet
* Mutable Identifier: 1-1 with an Immutable Identifier; 1-many over time; Updated "in-place" by an agent; Chaperone sanity checks the referent
* Interfaces: 1-many; Updated out-of-place by statements; Chaperone sanity checks the implementation;

I hope to put down some follow-up thoughts on challenges surrounding distributed development, conflicts, security, and trust in another post.
