---
layout: post
title:  "On References"
date:   2018-02-13
categories:
---

In programming, a reference is a thing which stands-in for something else. They can be used for compression when you are referencing something very large and you don't want to include it verbatim every time you reference it. They can also provide a stable identity for a thing which may change over time, but retains the same semantic identity. References may be specified as an absolute value or in relation to some bigger thing (like the coordinate of a certain pixel in an image). Some references are only unique within their originating context while others may be freely transplanted without issue. A reference can be wasteful if it takes more bits to encode it than the referent would. References also give an escape hatch for stating that "even though these two things have the same structure and value, they are *somehow* different".

I would like to focus on 3 types of references and how they might fit into an information storage format.

## Global + Constant

A global reference can be placed in any context and resolve to the same referent -- ie. it is context-free. A constant reference will always resolve to the same referent no matter what. With these two together, it is natural to use a cryptographic hash like a SHA to *derive* the reference, which lets us verify the referent via `SHA(get(reference)) == reference`.

A consequence of using a cryptographic hash is that the referent cannot include a global+constant reference to itself.

## Local + Constant

A local reference is only valid within a given context (the bounds of that context are currently unspecified and will be addressed below). An example might be using dictionary compression for a given file; a reference to a dictionary word is constant throughout (assuming you don't change dictionaries), but two files using dictionary compression may be using different dictionaries catered to the characteristics of the file.

## Local + Varying

Local+varying references form the basis of function variables and software dependencies alike. They let us associate a stable name to a changing referent. Lambda terms form the context for which a reference is valid and either your OS or whatever package manager tool your language provides gives the context in which a library name like `left_pad` is valid. The whole benefit here is that we create a context which shouldn't need changing when the outside does and vice-versa. That being said, I don't think we as programmers make this a reality very often, but I digress.

It should be noted that a function variable can also be viewed as a local+constant variable when thinking solely about the structure of the code because it always refers to the same variable/binding site. This hints that the type of reference is based on interpretation.

## Global + Varying

This bonus reference type is pretty crazy and I'm not sure is very good for programming.


# Closing

References are a necessary part of encoding semantic meaning into data. Many serialization formats omit references altogether and while they can be layered on top of an existing format, they are ad-hoc and loses the intent of being a reference. In addition, I have laid out that there are 3 important classes of references that if we differentiate them from the beginning, should lead to a richer data format. They are also essential (okay not essential since you could use SK combinators et al...) for properly encoding programming languages since functions are rife with references in variables and function names (class names etc. -- even though you can view them as variables too, but they have a less well-defined context/binding-site). I would like to explore data formats which have first-class support for references in each form and see what they give us.
